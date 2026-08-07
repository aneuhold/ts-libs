# Part 1: store v2 and named locks

Part 1 of three. [The overview](./local-npm-registry-package-paths-plan.md) carries the design and
the reasoning behind the key, the slug, and the store shape. Read it first.

This part lays the foundation: a store keyed by package root path, a second lock so store writes are
safe between processes, and lock acquisition that waits instead of timing out. It ends with every
caller migrated onto the new store API, so the package builds and the existing suite passes.

No two-checkout behavior appears here. Both checkouts still publish under one version format and one
dist tag, so they still overwrite each other. Part 2 fixes that.

Everything happens inside `packages/local-npm-registry`.

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

## Step 3: migrate the callers

The shape change reaches every caller of the store, so this step is what keeps the package building.
Each item is the smallest correct change for the new API. Where part 2 or 3 replaces one of these
outright, it says so.

**`src/services/CommandUtil.service.ts`**: write through `updatePackageRootEntry` with the
`packageRootPath` it already takes, resolved through `resolvePackageRootPath`. Set
`publishedVersions` to `[currentVersion]`, which is accurate while publish still deletes the whole
package first. Part 2 turns that into an append plus a prune.

**`src/commands/PublishCommand.ts`**: resolve the path from `process.cwd()` and read that path's
entry, so `originalVersion` and the subscriber list come from this checkout rather than whichever
published last.

**`src/commands/SubscribeCommand.ts`**: resolve the package's publishing paths with
`getPackageRootPaths`. Use the sole path, otherwise throw listing every candidate path and its slug.
Part 2 adds `--path` and the rest of the binding rules.

**`src/commands/UnpublishCommand.ts`**: same sole-path-or-throw rule, then `removePackageRoot`
instead of `removePackage`. Part 3 replaces this with full target resolution.

**`src/commands/UnsubscribeCommand.ts`**: drive both paths off `getSubscriptions(currentProjectPath)`
so a binding is found regardless of which directory published it, and remove the subscriber from the
entry holding it.

**`src/commands/ClearStoreCommand.ts`**: walk packages, then paths, then subscribers. Group resets by
subscriber path and run one install per consumer instead of one per binding. The loop is being
rewritten for the new shape anyway, so it does the grouping now rather than twice. This also fixes
the `clear-store` bullet in problem 2 of
[the hardening doc](./local-npm-registry-hardening.md#problem-2-multiple-subscriptions-in-one-consumer).

**`src/services/PackageManagerService/PackageManagerCli.service.ts`**:
`#resolvePackageOrganizations` maps `getSubscriptions(projectPath)` to package names.

**`src/index.ts`**: `list` groups by package, then path, printing each path, its slug, current
version, and subscribers, and marking the one matching the current directory.

**`test-utils/TestProjectUtils.ts`**: `createSubscribedProjects` writes a v2 entry.

## Step 4: tests

**New `src/services/LocalPackageStore.service.spec.ts`**: slug derivation, parallel mutations across
processes asserting no lost updates, and the invalid-store path: a v1 shape, unparseable JSON, and a
malformed entry each get set aside and yield an empty store.

**Existing specs**: update `PublishCommand.spec.ts`, `SubscribeCommand.spec.ts`,
`UnpublishCommand.spec.ts`, `UnsubscribeCommand.spec.ts`, `ClearStoreCommand.spec.ts`,
`PackageManagerCli.service.spec.ts`, and `Verdaccio.service.spec.ts` for the v2 shape and the
`MutexLockName` argument.

## Step 5: documentation

**`packages/local-npm-registry/README.md`**: replace the "Local JSON Store Structure" block with the
v2 shape.

## Validation

From `packages/local-npm-registry`:

```bash
pnpm check
pnpm lint
pnpm test
```

Run `/changelog` before merging so `CHANGELOG.md` picks the branch up.

## What this part leaves

- The version format has no slug and the dist tag is still the shared `local`, so two checkouts still
  overwrite each other. Part 2.
- `publishPackage` still deletes the whole package from the registry before publishing. Part 2.
- `subscribe` and `unpublish` have no `--path`, so a package with two publishing paths can only be
  reported, not chosen. Parts 2 and 3.
- Nothing walks dead publishing directories. Part 3.
