# Part 1: store v2 and named locks

Part 1 of three. [The overview](./local-npm-registry-package-paths-plan.md) carries the design and
the reasoning behind the key, the slug, and the store shape. Read it first.

This part lays the foundation: a store keyed by package path, a second lock so store writes are safe
between processes, lock acquisition that waits instead of timing out, and the version format that
carries the publishing directory. It ends with every caller migrated onto the new store API, so the
package builds and the existing suite passes.

Two publishing directories get distinct versions after this, but a publish still deletes the whole
package from the registry first, so they still overwrite each other there. Part 2 fixes that.

Everything happens inside `packages/local-npm-registry`.

## Step 1: named locks that wait

**`src/types/MutexLockName.ts`** (new)

A `MutexLockName` enum: `Verdaccio = 'verdaccio-lock'` and `Store = 'local-package-store-lock'`.

**`src/services/Mutex.service.ts`**

- `#lockReleases: Map<MutexLockName, () => Promise<void>>` in place of a single release slot, and
  `lockName` as the first parameter of `acquireLock`, `releaseLock`, `isLocked`, and
  `forceReleaseLock`. One static slot cannot hold both locks at once, which publish needs.
- `withLock(lockName, operation)` acquires, runs, and releases in a `finally`. Everything that needs
  a lock for the length of an operation goes through it. `acquireLock` and `releaseLock` stay public
  for `VerdaccioService`, which acquires in `start()` and releases in `stop()` and so has no single
  scope to wrap.
- No `stale` is passed at all. It and the acquire window used to come off one `timeoutMs` parameter,
  so raising the 10s acquire window to something a publish plus installs can finish inside also
  extended how long an abandoned lock blocks the next run. They are unrelated questions:
  proper-lockfile re-touches the lockfile every `stale/2` while the holder lives, so a live holder
  never goes stale however long it runs, and `stale` only decides how fast a dead one is noticed.
  Leaving it unset takes proper-lockfile's 10s default.
- The acquire side waits indefinitely. proper-lockfile passes a `retries` object straight to
  `retry.operation`, which supports `forever`:

  ```ts
  retries: { forever: true, minTimeout: 100, maxTimeout: 100 };
  ```

  A 500ms interval leaves a waiter sitting up to half a second after the holder has already
  released. That never shows up uncontended, where acquiring measures 0.5ms median, but it is dead
  time on every queued publish in the two-watcher case. Polling a lockfile stat at 100ms is cheap.

- While waiting, elapsed time is logged on a 5s interval started before `lockfile.lock` and cleared
  in a `finally`, so the first tick only fires under contention. proper-lockfile exposes no per-retry
  hook. That plus `forceReleaseLock` covers a holder that is alive but wedged, which `stale` never
  reclaims.
- `forceReleaseAllLocks()` walks every name, for test teardown.

**`src/services/Verdaccio.service.ts`**: the lock name on the `acquireLock` call in `start()` and the
`releaseLock` calls in `start()` and `stop()`.

## Step 2: store v2, keyed by package path

**`src/types/LocalPackageStore.ts`**

```ts
export type LocalPackageStore = {
  version: number;
  packages: { [packageName: string]: PackagePathEntries | undefined };
};

export type PackagePathEntries = { [packagePath: string]: PackageEntry | undefined };

export type PackageEntry = {
  originalVersion: string;
  currentVersion: string;
  subscribers: PackageSubscriber[];
  publishArgs?: string[];
};
```

`isLocalPackageStore` validates every entry rather than only checking that `packages` is an object,
so a malformed entry cannot pass as valid. Which version a store has to declare is the reader's
decision, so the guard only requires that it declares one.

**`src/services/LocalPackageStore.service.ts`**

The service holds no store of its own. `getStore` and `writeStore` are the only methods that touch
disk, and every other method takes the store the caller already holds, so one read serves a whole
operation and one write ends it. A caller that reads and later writes holds `MutexLockName.Store`
across both through `MutexService.withLock`, which is what closes the lost-update race between
processes.

Reads and writes:

- `getStore()` deprecates a store that does not declare version 2 by renaming it to
  `<store>.deprecated-<timestamp>`, logging where it went, and continuing from an empty store. No
  migration, and no second shape for the rest of the codebase to know about. The set-aside file still
  holds the old subscriber paths and `originalSpecifier` values, so a consumer left on a timestamped
  pin can be recovered by hand or with `git checkout package.json`. Re-subscribing is the normal path.
- A store file that does not parse throws, before any version is read from it, and so does one that
  declares version 2 but holds a malformed entry. An older version is a known shape this tool wrote
  and moved past; a corrupt store is a fact about the system worth stopping on, and discarding it
  silently would take live subscriber bindings with it.
- `writeStore(store)` throws instead of logging and returning, so a failed write cannot look like a
  successful mutation.

Public API:

- `getPackageEntry(store, packageName, packagePath)`
- `getPackagePathEntries(store, packageName)` for disambiguation and `list`
- `getPackagePath(store, packageName, explicitPath?)`, resolving to the requested path when given one
  and the sole path otherwise, throwing and listing the candidates when neither applies. Part 3 adds
  the `--path` flag that reaches the `explicitPath` argument.
- `updatePackageEntry(store, packageName, packagePath, entry)`
- `removePackagePath(store, packageName, packagePath)`, dropping the package key with its last path
- `removeSubscriber(store, packageName, packagePath, subscriberPath)`
- `getSubscriptionsForSubscriber(store, subscriberPath)` returning
  `Array<{ packageName, packagePath, subscribersOriginalSpecifier }>`, serving both scope resolution
  and unsubscribe
- `removePackagesByPattern(store, pattern)` and `clearStore(store)`, operating on package names
- `generateTimestampVersion(originalVersion, packagePath)`, covered in step 3

Every method takes the store first. `addSubscriber` and `removePackage` are gone: neither had a
caller, and subscribe writes the whole entry.

## Step 3: the version format

**`src/services/LocalPackageStore.service.ts`**

`generateTimestampVersion(originalVersion, packagePath)` produces `<original>-<slug>.<timestamp>`,
for example `2.4.6-pa1b2c3d4.20250726123456789`, replacing any suffix the original version already
carries.

The slug is `p` plus the first eight hex characters of the SHA-256 of the package path, derived
inside this method. Nothing else needs it: it is never shown to a user, never typed by one, and never
stored, so it has no reason to be its own public method.

`#TIMESTAMP_PATTERN` is `/-p[0-9a-f]{8}\.\d{17}$/`, matching that form and nothing else. There is no
older form to match, because a store from an older version is set aside rather than migrated.

Valid semver: prerelease identifiers are dot-separated alphanumerics and hyphens, and the numeric
timestamp has no leading zero. The slug is fixed width, so versions stay short however deep the
directory sits. Ordering between paths does not matter, because subscribers pin exact versions.

## Step 4: the callers

The shape change reaches every caller of the store. Each command opens `MutexService.withLock` at the
first read and closes it after the last write, so the whole read-modify-write is one critical
section. Where part 2 or 3 replaces one of these outright, it says so.

**`src/services/CommandUtil.service.ts`**: `publishAndUpdateSubscribers` takes the store, writes
through `updatePackageEntry`, and persists before touching subscribers so an install that fails
partway still leaves the published version recorded.

**`src/commands/PublishCommand.ts`**: resolves the path from `process.cwd()` and reads that path's
entry, so `originalVersion` and the subscriber list come from this directory rather than whichever
published last.

**`src/commands/SubscribeCommand.ts`**: resolves the publishing path with `getPackagePath`. Part 2
adds `--path` and the rest of the binding rules.

**`src/commands/UnpublishCommand.ts`**: `getPackagePath`, then `removePackagePath`. Part 3 replaces
this with full target resolution.

**`src/commands/UnsubscribeCommand.ts`**: drives both paths off
`getSubscriptionsForSubscriber(store, currentProjectPath)` so a binding is found regardless of which
directory published it. The store lock spans the read and the removals, and the `package.json` resets
and the install run after it is released.

**`src/commands/ClearStoreCommand.ts`**: walks packages, then paths, then subscribers, grouping
resets by subscriber path so each consumer gets one install instead of one per binding. This also
fixes the `clear-store` bullet in problem 2 of
[the hardening doc](./local-npm-registry-hardening.md#problem-2-multiple-subscriptions-in-one-consumer).
Part 3 has it prune first and share the grouping.

**`src/services/PackageManagerService/PackageManagerCli.service.ts`**: `#resolvePackageOrganizations`
takes the store rather than reading one of its own, so `runInstallWithRegistry` threads it down from
the command that holds the lock.

**`src/index.ts`**: `list` groups by package, then path, printing each path, its current version, and
its subscribers, and marking the one matching the current directory.

## Step 5: tests

**`src/services/LocalPackageStore.service.spec.ts`** (new): the version format, and the store file
lifecycle. A v1 shape is set aside and yields an empty store; unparseable JSON and a malformed entry
each throw and leave the file alone.

**`test-utils/ConcurrentTestProjectUtils.ts`** (new), with `concurrentRunner.ts`, `ConcurrentWorker.ts`,
and a `concurrent-executables/` directory: runs one executable in several processes at once. The
store lock only ever contends between processes, since a second acquisition inside one process is
handed the lock that process already holds, and Vitest isolates test files rather than individual
tests. Every worker is spawned through the runner, which holds it at a rendezvous until its fellows
arrive, so a run cannot pass because the processes never overlapped. `concurrent-executables/writeStoreEntry.ts`
is the first of these, asserting no lost updates.

**`test-utils/TestProjectUtils.ts`**: `mutateStore(mutator)` takes the store lock around a read,
apply, write, for test setup that changes the store.

**Existing specs**: the v2 shape, the `MutexLockName` argument, the store-first API, and the new
version format.

## Step 6: documentation

**`packages/local-npm-registry/README.md`**: the "Local JSON Store Structure" block carries the v2
shape and the version format.

## Validation

From `packages/local-npm-registry`:

```bash
pnpm check
pnpm lint
pnpm test
```

Run `/changelog` before merging so `CHANGELOG.md` picks the branch up.

## What this part leaves

- `publishPackage` still deletes the whole package from the registry before publishing, so two
  publishing directories still overwrite each other there. Part 2.
- `subscribe` and `unpublish` have no `--path`, so a package with two publishing paths can only be
  reported, not chosen, even though the store resolves an explicit path already. Parts 2 and 3.
- Nothing walks dead publishing directories. Part 3.
