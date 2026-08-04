# Plan: one package published from two directories at once

Addresses "Problem 4" in [`local-npm-registry-hardening.md`](./local-npm-registry-hardening.md) and
carries the design for it. Every published package is keyed by the absolute path of the directory it
is published from, so two checkouts of one repository can publish and be consumed at the same time.
Nothing depends on git, so a second clone works like a `git worktree`.

Everything happens inside `packages/local-npm-registry`.

## Scope

- Store v2 (package name, then package root path) plus a migration from the flat v1 shape.
- Per path version slugs and dist tags.
- Per path registry retention, replacing "delete the whole package before every publish".
- Explicit subscriber binding at subscribe time.
- An unbounded lock wait, so the second publish queues instead of failing.
- Cross-process safe store writes, and a `#writeStore` that throws. Both are hardening items in their
  own right, and the rest of this is built on them.
- `prune`, path-aware `unpublish`, and grouped `list`.

Out of scope: the journal, signal handlers, `doctor`, the topological cascade (problem 3), and the
corrupt store handling. Nothing here blocks them.

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
        "publishedVersions": ["2.4.6-pa1b2c3d4.20250726123456789"],
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

`packageRootPath` stops being a field, since it is the key. `publishedVersions` is what lets
retention stay per path. Two maps deep with no wrapper between them, at the cost that every key under
a package name has to be a path.

### Two locks

The Verdaccio lock serializes whole commands. A new store lock guards each read-modify-write, so
commands that never start Verdaccio still write the store safely.

---

## Step 1: named locks that wait

**`src/services/Mutex.service.ts`**

- Export a `MutexLockName` enum (`Verdaccio = 'verdaccio-lock'`, `Store = 'local-package-store-lock'`).
- Replace `#lockRelease` with `#lockReleases: Map<MutexLockName, () => Promise<void>>`, and take
  `lockName` as the first parameter of `acquireLock`, `releaseLock`, `isLocked`, and
  `forceReleaseLock`. A single static slot cannot hold both locks at once, which publish needs.
- Drop `#LOCK_TIMEOUT`, and stop passing `stale` at all. Both currently come off the one `timeoutMs`
  parameter ([`:48`](../packages/local-npm-registry/src/services/Mutex.service.ts#L48) and
  [`:51`](../packages/local-npm-registry/src/services/Mutex.service.ts#L51)), so raising the 10s
  acquire window to something a publish plus installs can finish inside also extends how long an
  abandoned lock blocks the next run. They are unrelated questions: proper-lockfile re-touches the
  lockfile every `stale/2` while the holder lives, so a live holder never goes stale however long it
  runs, and `stale` only decides how fast a dead one is noticed. Leaving it unset takes
  proper-lockfile's 10s default, which is what we want and removes the last timing constant here.
- The acquire side then waits indefinitely. proper-lockfile passes a `retries` object straight to
  `retry.operation`, which supports `forever`:

  ```ts
  retries: { forever: true, minTimeout: 500, maxTimeout: 500 };
  ```

- While waiting, log elapsed time on a 5s interval started before `lockfile.lock` and cleared in a
  `finally`, so the first tick only fires under contention. proper-lockfile exposes no per-retry
  hook. That plus `forceReleaseLock` covers a holder that is alive but wedged, which `stale` never
  reclaims.

**`src/services/Verdaccio.service.ts`**

- Add the lock name to the `acquireLock` call in `start()` and the `releaseLock` calls in `start()`
  and `stop()`.

## Step 2: store v2, keyed by package root path

**`src/services/LocalPackageStore.service.ts`**

```ts
export type PackageRootEntry = {
  originalVersion: string;
  currentVersion: string;
  subscribers: PackageSubscriber[];
  publishedVersions: string[];
  publishArgs?: string[];
};

export type PackageRoots = { [packageRootPath: string]: PackageRootEntry | undefined };

export type LocalPackageStore = {
  version: number;
  packages: { [packageName: string]: PackageRoots | undefined };
};
```

Key helpers, public statics here because the key semantics belong with the thing keyed:

- `resolvePackageRootPath(directoryPath)`: `fs.realpath`, falling back to `path.resolve` when the
  path is gone, so `prune` can still resolve a dead directory to its stored key.
- `getPathSlug(packageRootPath)`: `p` + `createHash('sha256').update(packageRootPath).digest('hex').slice(0, 8)`.

`timestampPattern` becomes `/-(?:[0-9a-z][0-9a-z-]*\.)?\d{17}$/`, which still matches the old form on
`package.json` files written by earlier versions.

Reads and writes:

- `getStore()` normalizes after reading: a store with no `version` field is folded to v2 in memory by
  moving each flat entry under its recorded `packageRootPath` with
  `publishedVersions: [currentVersion]`. Nothing is written during a read; the first mutation
  persists the migrated shape.
- New private `#withStore(mutator)`: acquire `MutexLockName.Store`, read, apply, write, release in a
  `finally`. Every mutator goes through it, closing the lost-update race between processes.
- `#writeStore` writes to a temp file and renames over the store, and throws instead of logging and
  returning, so a failed write cannot look like a successful mutation.

Public API, replacing the name-only methods:

- `getPackageRootEntry(packageName, packageRootPath)`
- `getPackageRootPaths(packageName)` for disambiguation and `list`
- `updatePackageRootEntry(packageName, packageRootPath, entry)`
- `removePackageRoot(packageName, packageRootPath)`, dropping the package key with its last path
- `removeSubscriber(packageName, packageRootPath, subscriberPath)`
- `getSubscriptions(subscriberPath)` returning
  `Array<{ packageName: string; packageRootPath: string; subscriber: PackageSubscriber }>`, replacing
  `getSubscribedPackages` and serving both scope resolution and unsubscribe
- `removePackage`, `removePackagesByPattern`, and `clearStore` stay, operating on package names

Delete `addSubscriber`: no callers, and subscribe writes the whole entry.

## Step 3: publish path

**`src/services/CommandUtil.service.ts`**

- `generateTimestampVersion(originalVersion, pathSlug)` produces `<original>-<slug>.<timestamp>`,
  replacing any existing suffix matching `timestampPattern`.
- `publishAndUpdateSubscribers` takes the resolved `packageRootPath` and, in order: derives the slug,
  writes the timestamped version into `package.json`, publishes, writes the entry with
  `publishedVersions` appended, updates only that path's subscribers, prunes that path's older
  versions, restores the original version.
- Pruning sits here so both `publish` and `subscribe` get it, and it runs before the caller stops the
  server because it needs the server. Versions that fail to unpublish stay in `publishedVersions` and
  retry on the next publish. Problem 3 later moves this prune to the end of a cascade.

**`src/services/Verdaccio.service.ts`**

- `publishPackage(packagePath, additionalPublishArgs, distTag)`, with `#buildPublishArgs` emitting
  `--tag <distTag>`; callers pass `local-<slug>` instead of the shared `local`. Passing the tag in
  keeps this service from having to know about the store.
- Delete the `#clearPublishedPackagesLocally` call from `publishPackage`, so one directory cannot
  destroy the version the other directory's consumer is pinned to.
- New `unpublishVersions(packageName, versions)`: one
  `npm unpublish <pkg>@<version> --registry=<url> --//<host>/:_authToken=fake --force` per version,
  logging and continuing on failure, returning the versions actually removed.
- Add `unpublish: ['$all']` to both base `packages` entries in `#createVerdaccioConfig`, without which
  Verdaccio refuses the request.
- Delete `#clearPublishedPackagesLocally` and `unpublishPackage`, then `src/types/VerdaccioDb.ts`,
  which has no other consumer. Both checkouts publish under one package name and share one storage
  directory, so `fs.remove()` on it cannot express "this path's versions but not the other's". Doing
  that at the file level means editing Verdaccio's metadata document by hand (`versions`, `time`,
  `dist-tags`, the `_distfiles`/`_attachments` bookkeeping) and deleting the matching tarball, which
  reimplements unpublish against an internal on-disk format. Secondarily, the prune runs while the
  server is up, and Verdaccio holds the `.verdaccio-db.json` package list in memory.
- In `stop()`, call `server.closeIdleConnections()` before `server.close()`. Package managers leave
  their connection open after the install that used it, so `close` otherwise waits for those to time
  out, delaying the next process's turn at the lock.

**`src/commands/PublishCommand.ts`**

- Resolve the path from `process.cwd()` and read that path's entry, so `originalVersion` and the
  subscriber list come from this checkout rather than whichever published last.

## Step 4: subscribe binding

**`src/commands/SubscribeCommand.ts`**

- `execute(packageName, packageRootPath?)`. With a path, resolve it and require it to be a publishing
  path for the package. Without one, use the sole path if there is exactly one, otherwise throw
  listing every path and its slug. Which checkout the consumer wants cannot be inferred from the
  consumer.
- Before binding, look for an existing subscription for this consumer and package on another path.
  Carry its `originalSpecifier` over and remove the old binding, so moving a consumer between
  checkouts cannot record a timestamped version as the original specifier. A consumer has one
  specifier slot per dependency, so it cannot be bound to two paths at once.
- Pass the resolved path through to `publishAndUpdateSubscribers`.

## Step 5: path-aware unpublish, unsubscribe, clear-store, prune

**`src/commands/UnpublishCommand.ts`** — `execute(packageName?, options?)` with `packageRootPath` and
`allPaths`. Target resolution: `allPaths` wins, then an explicit path, then the current directory if
it publishes that package, then the sole path, otherwise throw listing them. Per target: reset its
subscribers, start Verdaccio, `unpublishVersions` its `publishedVersions`, stop, `removePackageRoot`.
Restore the package's own `package.json` version only when the current directory is the target.

**`src/commands/UnsubscribeCommand.ts`** — drive both paths off `getSubscriptions(currentProjectPath)`
so a binding is found regardless of which directory published it, and remove the subscriber from the
entry holding it.

**`src/commands/ClearStoreCommand.ts`** — walk packages, then paths, then subscribers. Group resets by
subscriber path and run one install per consumer instead of one per binding. This also fixes the
`clear-store` bullet in problem 2.

**`src/commands/PruneCommand.ts`** (new) — per package and path: if the directory is gone, restore
each live subscriber's `originalSpecifier`, unpublish its `publishedVersions`, and remove the entry.
For surviving paths, drop subscriber records whose paths are gone. Group restores by subscriber path,
one install per consumer. Without this, every publish logs failures for dead paths forever, and a
consumer bound to a deleted checkout keeps a pin it can never resolve.

**`src/services/Command.service.ts`** — add `prune`, thread the new arguments through `subscribe` and
`unpublish`.

**`src/services/PackageManagerService/PackageManagerCli.service.ts`** —
`#resolvePackageOrganizations` maps `getSubscriptions(projectPath)` to package names.

## Step 6: CLI surface

**`src/index.ts`**

- `subscribe <package-name> [--path <path>]`
- `unpublish [package-name] [--path <path>] [--all-paths]`
- `prune`, described as dropping publishing directories that no longer exist
- `list` groups by package, then path, printing each path, its slug, current version, and
  subscribers, and marking the one matching the current directory

## Step 7: tests

**`test-utils/TestProjectUtils.ts`**

- `createTestPackage` takes an optional directory name; two checkouts of one package name currently
  collide on a directory derived from the name.
- `createSubscribedProjects` writes a v2 entry.
- A helper that creates a second checkout of an existing test package and publishes from it.

**New `src/services/LocalPackageStore.service.spec.ts`** — slug derivation, the v1 to v2 migration
folding a flat entry onto its recorded `packageRootPath`, and parallel mutations across processes
asserting no lost updates.

**New `src/commands/PruneCommand.spec.ts`** — a deleted publishing directory with a live subscriber:
the specifier is restored, the entry is dropped, a surviving path is untouched.

**`src/commands/PublishCommand.spec.ts`** and **`SubscribeCommand.spec.ts`** — two checkouts of one
package with two consumers: each consumer resolves its own build, publishing from one checkout leaves
the other's version installed and resolvable, and subscribing with two candidate paths and no
`--path` fails and lists them.

**Existing specs** — update `PublishCommand.spec.ts`, `SubscribeCommand.spec.ts`,
`UnpublishCommand.spec.ts`, `UnsubscribeCommand.spec.ts`, `ClearStoreCommand.spec.ts`,
`PackageManagerCli.service.spec.ts`, and `Verdaccio.service.spec.ts` for the v2 shape, the
`MutexLockName` argument, and the new version pattern.

## Step 8: documentation

**`packages/local-npm-registry/README.md`**

- Replace the "Local JSON Store Structure" block with the v2 shape.
- Document `--path`, `--all-paths`, and `prune`.
- Correct the note grouping `unpublish` with `unsubscribe` as commands that do not require Verdaccio
  running. `unsubscribe` does not; `unpublish` does, because removal goes through the server.
- Describe per path versions and dist tags in the technical details.

Run `/changelog` before merging so `CHANGELOG.md` picks the branch up.

## Validation

From `packages/local-npm-registry`:

```bash
pnpm check
pnpm lint
pnpm test
```

The suite runs serially (`fileParallelism: false`) and starts a real Verdaccio, so the two-checkout
tests should reuse the existing per-test temp instance rather than spawning parallel vitest workers.

## Trade-offs and open questions

1. **`unpublish` and `prune` require a running Verdaccio.** Per version removal is what the design
   needs and what the server already implements, but it makes both slower than a file delete and
   makes them contend for the Verdaccio lock. Visible change for anyone used to `unpublish` working
   with the server down.
2. **One `npm unpublish` subprocess per pruned version.** Normally one per publish, growing only if
   earlier prunes failed.
3. **Subscriber paths get `realpath` treatment too.** Migration leaves already-stored subscriber
   paths untouched, so a consumer recorded through a symlink keeps its old path until it resubscribes.
4. **`--path` takes a path, not a slug**, even though `list` prints slugs. Accepting either is a small
   addition if the paths are annoying to type.
