# Plan: one package published from two directories at once

Addresses "Problem 4" in [`local-npm-registry-hardening.md`](./local-npm-registry-hardening.md) and
carries the design for it. Every published package is keyed by the absolute path of the directory it
is published from, so two checkouts of one repository can publish and be consumed at the same time.
Nothing depends on git, so a second clone works like a `git worktree`.

Everything happens inside `packages/local-npm-registry`.

This document holds the design and the ordering. The work itself is split across three parts, each
with its own document:

1. [Part 1: store v2 and named locks](./local-npm-registry-package-paths-1-store-and-locks.md)
2. [Part 2: per path publish and subscribe](./local-npm-registry-package-paths-2-publish-and-subscribe.md)
3. [Part 3: path aware sweeps and prune](./local-npm-registry-package-paths-3-sweeps-and-prune.md)

## Scope

- Store v2 (package name, then package root path). Anything that is not a v2 store is set aside and
  reset, never migrated.
- Per path version slugs and dist tags.
- Per path registry retention, replacing "delete the whole package before every publish".
- Explicit subscriber binding at subscribe time.
- An unbounded lock wait, so the second publish queues instead of failing.
- Cross-process safe store writes, and a `#writeStore` that throws. Both are hardening items in their
  own right, and the rest of this is built on them.
- `prune`, path-aware `unpublish`, and grouped `list`.

Out of scope: the journal, signal handlers, and the topological cascade (problem 3). Nothing here
blocks them. `prune` is the reconciliation command the journal work later extends.

## Design

### The key is the package root path

The **absolute path of the package root**, resolved through `fs.realpath` so a relative path or a
symlink lands on one entry. Two checkouts sit at two paths, so the path identifies the checkout on
its own. It comes from `process.cwd()` for `publish`, and from `--path <path>` or the sole publishing
path for `subscribe`. Nothing to configure, and no case where it cannot be determined.

### The slug

Versions and dist tags cannot hold a whole path, so they carry `p` plus the first eight hex
characters of the SHA-256 of the key, for example `pa1b2c3d4`. The `p` prefix stops the identifier
being read as a number, since semver rejects a numeric prerelease identifier with a leading zero and
a digest is occasionally all digits. Derived on demand, so the store cannot hold a slug that
disagrees with its key. `local-npm list` maps it back to the path.

### Version format

`<originalVersion>-<pathSlug>.<timestamp>`, for example `2.4.6-pa1b2c3d4.20250726123456789`.

Valid semver: prerelease identifiers are dot-separated alphanumerics and hyphens, and the numeric
timestamp has no leading zero. The slug is fixed width, so versions stay short however deep the
directory sits. Ordering between paths does not matter, because subscribers pin exact versions.

### Store v2 shape

Replaces the [current flat shape](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L25):

```json
{
  "version": 2,
  "packages": {
    "@aneuhold/core-ts-lib": {
      "/Users/x/dev/ts-libs-harden/packages/core-ts-lib": {
        "originalVersion": "2.4.6",
        "currentVersion": "2.4.6-pa1b2c3d4.20250726123456789",
        "publishArgs": ["--ignore-scripts"],
        "subscribers": [
          {
            "subscriberPath": "/Users/x/dev/app-checkout",
            "originalSpecifier": "^2.4.6"
          }
        ]
      },
      "/Users/x/dev/ts-libs/packages/core-ts-lib": { "...": "..." }
    }
  }
}
```

`packagePath` stops being a field, since it is the key. Nothing records which versions a path has
in the registry either, because the slug inside every version already says which path published it,
so retention asks the registry and filters on the slug rather than reading a stored list. Two maps
deep with no wrapper between them, at the cost that every key under a package name has to be a path.

### Two locks

The Verdaccio lock serializes whole commands. A new store lock guards each read-modify-write, so
commands that never start Verdaccio still write the store safely.

## The three parts

The split follows the layers: the data model and the locking underneath it, then the publish and
subscribe lifecycle built on that model, then the commands that sweep across it and the CLI surface.
Each part carries the tests and the README changes for what it touches, so each one lands complete.

### [Part 1: store v2 and named locks](./local-npm-registry-package-paths-1-store-and-locks.md)

Named locks that wait indefinitely, the v2 store keyed by package root path, cross-process safe
writes, invalid-store handling, and the migration of every caller onto the new store API.

Behavior after this part is what it is today for a single checkout, with three exceptions: a queued
command waits instead of timing out, a failed store write throws instead of being logged, and
`clear-store` runs one install per consumer instead of one per binding. Two checkouts still collide,
because both still publish under one version format and one dist tag.

### [Part 2: per path publish and subscribe](./local-npm-registry-package-paths-2-publish-and-subscribe.md)

The slug in the version, a dist tag per path, per path retention replacing delete-before-publish, and
explicit subscriber binding through `--path`.

This is the part that makes two checkouts work. It is also where the design decisions sit, so it is
the densest of the three to review even though it touches fewer files than part 1.

### [Part 3: path aware sweeps and prune](./local-npm-registry-package-paths-3-sweeps-and-prune.md)

Target resolution for `unpublish`, the new `prune` command, and the CLI surface for both.

Everything that has to walk every publishing path rather than act on one. `prune` is what repairs a
store whose publishing directory is deleted, which nothing else visits.

### Review order

Strictly 1, then 2, then 3. Part 1 defines the shape the other two read and write, and part 2 removes
the registry-level delete that part 3's `unpublish` replaces with per version removal. Run
`/changelog` on each branch before merging so `CHANGELOG.md` picks it up.

## Trade-offs and open questions

1. **`unpublish` and `prune` require a running Verdaccio.** Per version removal is what the design
   needs and what the server already implements, but it makes both slower than a file delete and
   makes them contend for the Verdaccio lock. Visible change for anyone used to `unpublish` working
   with the server down.
2. **An existing store is discarded rather than migrated**, so everyone re-subscribes once. Subscriber
   paths get `realpath` treatment like package root paths, and with no migration every stored path is
   normalized the same way.
