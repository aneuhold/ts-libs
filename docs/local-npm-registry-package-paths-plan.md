# Plan: one package published from two directories at once

Addresses "Problem 4" in [`local-npm-registry-hardening.md`](./local-npm-registry-hardening.md) and
carries the design for it. Every published package is keyed by the absolute path of the directory it
is published from, so two checkouts of one repository can publish and be consumed at the same time.
Nothing depends on git, so a second clone works like a `git worktree`.

Everything happens inside `packages/local-npm-registry`.

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
  retries: { forever: true, minTimeout: 100, maxTimeout: 100 };
  ```

  The current 500ms interval means a waiter can sit up to half a second after the holder has already
  released. That never shows up uncontended, where acquiring measures 0.5ms median, but it is dead
  time on every queued publish in the two-watcher case. Polling a lockfile stat at 100ms is cheap.

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

- `getStore()` accepts `version: 2` and nothing else. A missing version, an older shape, a parse
  failure, and a structurally invalid store are one case with one outcome: rename the file to
  `<store>.invalid-<timestamp>`, log where it went, and continue from an empty store. No migration,
  and no second shape for the rest of the codebase to know about.
- `#isLocalPackageStore` checks `version === 2` and validates entries, rather than only checking that
  `packages` is an object, so a malformed entry cannot pass as valid. This also closes the "a corrupt
  store silently becomes an empty store" hardening item, since a corrupt store and a v1 store are now
  the same case on the same path.
- The set-aside file still holds the old subscriber paths and `originalSpecifier` values, so a
  consumer left on a timestamped pin can be recovered by hand or with `git checkout package.json`.
  Re-subscribing is the normal path.
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
- Drop a subscriber whose directory no longer exists instead of logging it. The loop already visits
  every subscriber and already swallows the failure
  ([`:102`](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L102)), so the record
  otherwise survives every future publish. Key this on the directory being missing, not on the update
  failing, so a transient install error cannot silently unsubscribe a live consumer.

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
- Leave `stop()` alone. `server.closeIdleConnections()` looks necessary on the theory that package
  managers hold their connection open past the install, but measurement says otherwise:
  `server.close()` runs in 0.1ms median over 95 samples, and the wait never reproduced. Every package
  manager runs as an execa subprocess, so its sockets are gone before `stop()` is reached and `close`
  has nothing to wait on. Do not add the call without a measurement showing it is needed.

**`src/commands/PublishCommand.ts`**

- Resolve the path from `process.cwd()` and read that path's entry, so `originalVersion` and the
  subscriber list come from this checkout rather than whichever published last.

## Step 4: subscribe binding

**`src/commands/SubscribeCommand.ts`**

- `execute(packageName, packageRootPath?)`. With a path, resolve it and require it to be a publishing
  path for the package. Without one, use the sole path if there is exactly one, otherwise throw
  listing every candidate path, its slug, and the exact command to re-run.
- Which checkout the consumer wants cannot be inferred from it, and a wrong guess is the worst
  outcome available, since the consumer then tests against the other checkout's build with nothing to
  indicate it. Ancestor matching does not transfer from the cascade's edge resolution, because a
  dependent sits inside one checkout while a consumer sits outside all of them, and picking by most
  recently published would rebind on timing.
- Throwing rather than prompting, since `subscribe` runs from setup scripts and CI as much as from a
  terminal, where a prompt hangs with no TTY, reads a piped stdin, or interleaves with others on one
  terminal. Only a `--path` written into a script survives to the next person.
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

**`src/commands/PruneCommand.ts`** (new) — for every package root path that no longer exists: restore
each live subscriber's `originalSpecifier`, unpublish its `publishedVersions`, and remove the entry.
Group restores by subscriber path, one install per consumer.

Dead subscriber records are handled during publish, so this is only about dead publishing paths, and
it stays an explicit command for two reasons. Nothing else walks every path: publish runs from `cwd`,
which by definition exists, so a deleted checkout is never visited again and leaves its consumers
pinned to versions that can never resolve. And the repair rewrites consumer `package.json` files,
runs installs, and removes versions from the registry, which is too consequential to fire as a side
effect of an unrelated command.

**`src/services/Command.service.ts`** — add `prune`, thread the new arguments through `subscribe` and
`unpublish`.

**`src/services/PackageManagerService/PackageManagerCli.service.ts`** —
`#resolvePackageOrganizations` maps `getSubscriptions(projectPath)` to package names.

## Step 6: CLI surface

**`src/index.ts`**

- `subscribe <package-name> [--path <path>]`
- `unpublish [package-name] [--path <path>] [--all-paths]`
- `prune`, described as reconciling the store with what is actually on disk
- `list` groups by package, then path, printing each path, its slug, current version, and
  subscribers, and marking the one matching the current directory

## Step 7: tests

**`test-utils/TestProjectUtils.ts`**

- `createTestPackage` takes an optional directory name; two checkouts of one package name currently
  collide on a directory derived from the name.
- `createSubscribedProjects` writes a v2 entry.
- A helper that creates a second checkout of an existing test package and publishes from it.

**New `src/services/LocalPackageStore.service.spec.ts`** — slug derivation, parallel mutations across
processes asserting no lost updates, and the invalid-store path: a v1 shape, unparseable JSON, and a
malformed entry each get set aside and yield an empty store.

**New `src/commands/PruneCommand.spec.ts`** — a deleted publishing directory with a live subscriber:
the specifier is restored, the entry is dropped, a surviving path is untouched. Separately, that a
publish drops a subscriber whose directory is gone but keeps one whose install merely failed.

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
2. **An existing store is discarded rather than migrated**, so everyone re-subscribes once. Subscriber
   paths get `realpath` treatment like package root paths, and with no migration every stored path is
   normalized the same way.
