# Plan: one package published from two directories at once

Addresses "Problem 4" in [`local-npm-registry-hardening.md`](./local-npm-registry-hardening.md) and
carries the design for it. Every published package is keyed by the absolute path of the directory it
is published from, so two copies of one package can publish and be consumed at the same time.
Nothing looks at git, so how the second directory got there does not matter: a clone, a worktree, and
a copied directory are all the same thing here.

Everything happens inside `packages/local-npm-registry`.

This document holds the design and the ordering. The work itself is split across three parts, each
with its own document:

1. [Part 1: store v2 and named locks](./local-npm-registry-package-paths-1-store-and-locks.md)
2. [Part 2: per path publish and subscribe](./local-npm-registry-package-paths-2-publish-and-subscribe.md)
3. [Part 3: path aware sweeps and prune](./local-npm-registry-package-paths-3-sweeps-and-prune.md)

## Scope

- Store v2 (package name, then package path). Anything that is not a v2 store is set aside and
  reset, never migrated.
- Per path version slugs.
- Per path registry retention, replacing "delete the whole package before every publish".
- Explicit subscriber binding at subscribe time.
- An unbounded lock wait, so the second publish queues instead of failing.
- Cross-process safe store writes, and a `writeStore` that throws. Both are hardening items in their
  own right, and the rest of this is built on them.
- `prune`, path-aware `unpublish`, and grouped `list`.

Out of scope: the journal, signal handlers, and the topological cascade (problem 3). Nothing here
blocks them. `prune` is the reconciliation command the journal work later extends.

## Design

### The key is the package path

The **absolute path of the package directory**. Two copies sit at two paths, so the path identifies
the publishing directory on its own. It comes from `process.cwd()` for `publish`, and from
`--path <path>` or the sole publishing path for `subscribe`. Nothing to configure, and no case where
it cannot be determined.

Paths are resolved with `path.resolve` and nothing further. Symlinks are left alone: every command
that reads a path also checks whether it still exists, which is what a symlink resolution would have
been protecting.

### The slug

A version cannot hold a whole path, so it carries `p` plus the first eight hex characters of the
SHA-256 of the key, for example `pa1b2c3d4`. The `p` prefix stops the identifier being read as a
number, since semver rejects a numeric prerelease identifier with a leading zero and a digest is
occasionally all digits. Derived on demand, so the store cannot hold a slug that disagrees with its
key.

The dist tag stays the shared `local` and carries no slug. Nothing reads a dist tag: subscribers are
pinned to exact versions and retention filters on the slug inside a version. The tag only exists
because npm writes one on every publish and defaults to `latest`.

The slug is an encoding, not an interface. It is never shown to a user and never typed by one:
`list` prints paths, and `--path` takes a path.

### Version format

`<originalVersion>-<pathSlug>.<timestamp>`, for example `2.4.6-pa1b2c3d4.20250726123456789`.

Valid semver: prerelease identifiers are dot-separated alphanumerics and hyphens, and the numeric
timestamp has no leading zero. The slug is fixed width, so versions stay short however deep the
directory sits. Ordering between paths does not matter, because subscribers pin exact versions.

### Store v2 shape

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
            "subscriberPath": "/Users/x/dev/app",
            "originalSpecifier": "^2.4.6"
          }
        ]
      },
      "/Users/x/dev/ts-libs/packages/core-ts-lib": { "...": "..." }
    }
  }
}
```

`packagePath` is not a field, since it is the key. Nothing records which versions a path has
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

Named locks that wait indefinitely, the v2 store keyed by package path, cross-process safe writes,
the version format that carries the publishing directory, and the migration of every caller onto the
new store API.

Behavior after this part is what it is for a single publishing directory, with four exceptions: a
queued command waits instead of timing out, a failed store write throws instead of being logged,
`clear-store` runs one install per consumer instead of one per binding, and published versions carry
a slug. Two directories get distinct versions, but a publish still deletes the whole package from the
registry first, so they still collide there.

### [Part 2: per path publish and subscribe](./local-npm-registry-package-paths-2-publish-and-subscribe.md)

Per path retention replacing delete-before-publish, and explicit subscriber binding through
`--path`.

This is the part that makes two publishing directories work. It is also where the design decisions sit, so it is
the densest of the three to review even though it touches fewer files than part 1.

### [Part 3: path aware sweeps and prune](./local-npm-registry-package-paths-3-sweeps-and-prune.md)

Target resolution for `unpublish`, the new `prune` command, `clear-store` reusing it, and the CLI
surface for all of it.

Everything that has to walk every publishing path rather than act on one. `prune` is what repairs a
store whose publishing directory is deleted, which nothing else visits.

### Review order

Strictly 1, then 2, then 3. Part 1 defines the shape the other two read and write, and part 2 removes
the registry-level delete that part 3's `unpublish` replaces with per version removal. Run
`/changelog` on each branch before merging so `CHANGELOG.md` picks it up.

## Trade-offs and open questions

1. **`unpublish`, `prune`, and with it `clear-store` require a running Verdaccio.** Per version
   removal is what the design needs and what the server already implements, but it makes them slower
   than a file delete and makes them contend for the Verdaccio lock. Visible change for anyone used
   to `unpublish` or `clear-store` working with the server down.
2. **An existing store is discarded rather than migrated**, so everyone re-subscribes once. A store
   that declares the current version but is corrupt throws instead, since discarding that one would
   take live subscriber bindings with it on what may be a recoverable fault.
