# Hardening `local-npm-registry`

Open problems, and the correctness gaps found while tracing them.

## Problem 1: a killed publish leaves its mutations behind

`nodemon --exec "pnpm build && local-npm publish"` sends `SIGTERM` to the running publish on the next
save. No signal handlers exist, so `finally` never runs. Left behind:

- The publishing package's own `package.json` still on the timestamped version, since
  `publishAndUpdateSubscribers`
  [restores it only at the end](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L121).
- A subscriber pinned to a version the next publish deletes from Verdaccio, so a plain `pnpm install`
  there fails.
- The Verdaccio lock file. `proper-lockfile` cleans up on process `exit`, which an unhandled
  `SIGTERM` skips, so the next publish waits out the full stale window.

### Making mutations crash safe

- **Journal before mutating.** `<dataDir>/pending-mutations.json` holding
  `{ id, pid, startedAt, kind, targetPath, originalContent }` per in-flight change, cleared on
  successful restore. Sits next to the
  [store file](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L223).
- **Self heal on startup.** Every command replays entries whose `pid` is dead before doing anything
  else.
- **`local-npm doctor [--fix]`.** Replays the journal on demand, so a stale timestamped
  `package.json` recovers without another publish.
- **Signal handlers.** `SIGINT`, `SIGTERM`, `SIGHUP`, and `uncaughtException` restore synchronously
  (`fs.writeFileSync`), release the lock, and re-raise. Async cleanup in a signal handler is
  unreliable. [`index.ts`](../packages/local-npm-registry/src/index.ts) registers none.

### Stopping the pile-up at the source

- Per package publish lock, with a supersede rule: a newer queued publish for the same package
  replaces the waiting one rather than joining the queue.
- Consider `local-npm watch` owning the debounce instead of nodemon's kill-and-restart.

## Problem 2: multiple subscriptions in one consumer

- **Two watchers run two installs in one consumer.** Both call `runInstallWithRegistry` against the
  same directory, racing on its lockfile and `node_modules`.
- **`clear-store` runs N concurrent installs in the same directory.** Resets are collected per
  package and per subscriber, then
  [mapped in parallel](../packages/local-npm-registry/src/commands/ClearStoreCommand.ts#L59) with
  [one install each](../packages/local-npm-registry/src/commands/ClearStoreCommand.ts#L66), so a
  consumer subscribed to three packages gets three simultaneous installs.
  [`UnsubscribeCommand`](../packages/local-npm-registry/src/commands/UnsubscribeCommand.ts#L136)
  groups and installs once. [The package paths plan](./local-npm-registry-package-paths-plan.md)
  rewrites this loop and does the grouping there.
- **Sweeps must cross both dimensions.** `unsubscribe` with no argument, `clear-store`, and `prune`
  walk every package and every publishing directory.

## Problem 3: chains of locally published packages

A locally published package depending on another. Sibling packages here depend on each other by
published range rather than `workspace:`, for example
[`core-ts-api-lib` on `@aneuhold/core-ts-lib: ^2.4.6`](../packages/core-ts-api-lib/package.json).

### Worked example

`gcloud-backend` depends on `core-ts-api-lib`, `core-ts-lib`, `core-ts-db-lib`, `be-ts-lib`, and
`be-ts-db-lib`, most of which depend on `core-ts-lib`, so the graph is a diamond.

1. Publish `core-ts-lib` → `2.4.6-<ts1>`. Every subscriber's specifier is
   [rewritten to that exact version](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L92),
   including `packages/core-ts-api-lib`.
2. Publish `core-ts-api-lib`. `npm publish` packs the `package.json` **as it sits on disk**, so
   `core-ts-api-lib@3.0.41-<ts2>` carries an exact dependency on `core-ts-lib@2.4.6-<ts1>`. Installs
   fine, since `<ts1>` still exists.
3. Save a file in `core-ts-lib`. The watcher publishes `2.4.6-<ts3>`, and
   [`#clearPublishedPackagesLocally`](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L274)
   **deletes every existing version first, including `<ts1>`**. `gcloud-backend` moves to `<ts3>` but
   still has `core-ts-api-lib@3.0.41-<ts2>` pinned, whose tarball demands the deleted `<ts1>`.

The install fails naming `core-ts-lib` while the user is thinking about `core-ts-api-lib`. Expect
pnpm's `ERR_PNPM_NO_MATCHING_VERSION`. Subscribing `gcloud-backend` to `core-ts-lib` does not help:
that rewrites only its own direct specifier, not the requirement baked into the tarball.

### The silent variant

Prerelease versions do not satisfy plain ranges, so `2.4.6-<ts3>` does not satisfy `^2.4.6`.
Publishing `core-ts-api-lib` while its specifier sits at `^2.4.6` makes the tarball's transitive
requirement resolve through Verdaccio's npmjs uplink to the **real published** `2.4.6`. The consumer
gets two copies: the real `core-ts-lib` nested under `core-ts-api-lib`, and the local build at top
level. Install succeeds, and the consumer runs half-stale code with duplicated module state.

The monorepo's own tooling walks into this.
[`propagatePackageVersion`](../packages/core-ts-lib/src/services/Dependency.service.ts#L177) rewrites
every workspace dependent's specifier to
[`^${version}`](../packages/core-ts-lib/src/services/Dependency.service.ts#L241) as part of
`build:withoutClean` in [every package](../packages/local-npm-registry/package.json), so
`pnpm build && local-npm publish` **clobbers the exact pin on every save** and re-pins a moment
later. A watcher in another package can publish during that window.

Second hazard: a build running while a package's version is temporarily timestamped propagates
`^2.4.6-<ts>` into every dependent, a range whose resolution depends on whatever the registry holds.

### Why this monorepo is special

[`linkWorkspacePackages` and `preferWorkspacePackages` are both true](../pnpm-workspace.yaml), so
pnpm normally links siblings rather than fetching them. An exact timestamped pin no longer matches
the sibling's version, so pnpm silently fetches from Verdaccio into the monorepo's own
`node_modules`, and a later plain `pnpm install` at the root fails once that version is pruned.
Consumers outside the workspace never had the link, so they resolve differently from the monorepo.

### Fixes

- **Cascade publishes through the local dependency graph.** A subscriber that is itself locally
  published must be **re-published** after its dependency changes, not just re-installed. Publishing
  `core-ts-lib` should re-publish `core-ts-api-lib`, `core-ts-db-lib`, `be-ts-lib`, and
  `be-ts-db-lib`, then update leaf consumers once at the end. The store already holds the graph: a
  subscriber is also a publisher when some entry's `packageRootPath` equals that `subscriberPath`.
  Walk in topological order, dedupe, detect cycles.
- **Batch the leaf installs.** One install per consumer after the cascade settles, the same grouping
  problem 2 needs.
- **Prune after the cascade succeeds.** An interrupted cascade otherwise leaves consumers pinned to
  deleted versions, and the blast radius grows with graph depth. Each publish gets a unique version,
  so nothing requires deleting first. [The package paths plan](./local-npm-registry-package-paths-plan.md)
  already turns delete-before-publish into a per path prune after the publish; what remains is moving
  it out to the end of the cascade.
- **Check pins before packing.** Assert every locally published dependency is pinned to its current
  local version, and re-pin if not. This closes the
  [propagation race](../packages/core-ts-lib/src/services/Dependency.service.ts#L241): a dependent's
  watcher can fire while `propagateVersion` has the specifier back at `^2.4.6`, shipping a tarball
  that resolves to the real npmjs version.
- **Restore dependency rewrites after packing.** `publishAndUpdateSubscribers` restores only the
  `version` field, so a package that both publishes and subscribes keeps a timestamped specifier in
  its working tree forever. That dirties the repo, breaks a later plain install, and leaks into any
  real npm publish. With the pin check, the pin becomes transient pack-time state.

A cascade re-publish does not need to rebuild the dependent: compiled output does not embed the
dependency, so only the specifier and the version change.

Topological order matters. `be-ts-db-lib` depends on `core-ts-db-lib` depends on `core-ts-lib`, so
publishing `be-ts-db-lib` first bakes a stale `core-ts-db-lib` pin into its tarball.

## Problem 4: one package published from two directories at once

Two checkouts of one repository publishing and being consumed at the same time. Nothing depends on
git, so a second clone behaves like a `git worktree`.

[`local-npm-registry-package-paths-plan.md`](./local-npm-registry-package-paths-plan.md) has the
design and the steps: the isolation key and its slug, store v2 and its migration, per path versions
and dist tags, subscriber binding, retention through the running server, the lock's stale window, and
the commands for paths that no longer exist. It also owns the store concurrency and write error
items.

## Other hardening items

1. **A corrupt store silently becomes an empty store.**
   [`getStore`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L83) returns
   `{ packages: {} }` on any read or parse error, and
   [`#isLocalPackageStore`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L210)
   only checks that `packages` is an object, so malformed entries pass too. Every subscriber is
   orphaned, since the `originalSpecifier` values needed to reset them are gone. Back up the bad
   file, validate entries, and refuse destructive operations.
2. **`updatePackageVersion` rewrites every `"version":` in the file.** The
   [regex is global](../packages/local-npm-registry/src/services/PackageJson.service.ts#L80), so a
   nested `"version"` key is rewritten too. Latent, but destructive if hit and cheap to anchor to the
   top-level key.
3. **Failures do not affect the exit code.** Subscriber update failures are logged and the process
   exits 0
   ([`CommandUtil.service.ts:110`](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L110),
   [`ClearStoreCommand.ts:77`](../packages/local-npm-registry/src/commands/ClearStoreCommand.ts#L77)).
   In a watch loop that makes breakage invisible.
4. **`publishArgs` merge semantics are unclear.** `subscribe`
   [reuses stored args](../packages/local-npm-registry/src/commands/SubscribeCommand.ts#L53),
   `publish`
   [overwrites them](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L73). Pick
   one rule.

## Suggested phases

**Phase 1.** Hardening item 1, the journal, signal handlers, and `local-npm doctor --fix`.

**Phase 2.** The topological cascade walk, moving the prune to the end of it, the pre-pack pin check,
restoring dependency rewrites, and the grouping fixes.

**Phase 3.** [The package paths plan](./local-npm-registry-package-paths-plan.md), which carries its
own tests.

**Phase 4, tests.** [`TestProjectUtils`](../packages/local-npm-registry/test-utils/TestProjectUtils.ts)
is the base.

- Two concurrent publishes on one shared subscriber, asserting a correct final lockfile.
- A three-level chain (`lib` → `midLib` → `consumer`): publishing `lib` re-publishes `midLib`, the
  consumer resolves exactly one copy of `lib`, and a second `lib` publish does not break its install.
- The silent variant: the consumer never ends up with two versions of one local package.
- One consumer subscribed to two packages: a single install per consumer on `clear-store`, and
  correct resets across both.
- Kill mid-install (`SIGTERM` a child process), then assert the next command self-heals.

## Rejected

- **A persistent or daemonized Verdaccio.** The registry does not sit in the background consuming
  resources; it starts and stops per command. Everything else has to work inside that.

## Open questions

1. Automatic cascade publish, or opt-in per package? Automatic is correct, and skipping the dependent
   rebuild keeps it cheap, but one save in `core-ts-lib` is still four pack-and-publish round trips
   before the consumer install.
2. Should `propagateVersion` stay in the build script the watch loop runs? The pre-pack pin check
   makes it survivable either way, so it is about noise rather than correctness.
