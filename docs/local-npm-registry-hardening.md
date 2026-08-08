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
  else, so recovery needs no separate command. `prune` picks up the same replay as its manual
  trigger, since a dead `pid` and a dead directory are the same fact: the thing this record points at
  is gone.
- **Signal handlers.** `SIGINT`, `SIGTERM`, `SIGHUP`, and `uncaughtException` restore synchronously
  (`fs.writeFileSync`), release the lock, and re-raise. Async cleanup in a signal handler is
  unreliable. [`index.ts`](../packages/local-npm-registry/src/index.ts) registers none.

### Stopping the pile-up at the source

A per package publish lock, with a supersede rule: a newer queued publish for the same package
replaces the waiting one rather than joining the queue. Queued work for one package is identical
work, so dropping the older one is unambiguously correct.

That is as far out as it goes. Watching belongs to the consumer, so independent watchers stay
independent and two edits at one moment still cost two full runs.

## Problem 2: multiple subscriptions in one consumer

- **N watched packages means N installs in one consumer.** Two publishes cannot overlap, since both
  hold the Verdaccio lock across their installs
  ([`PublishCommand.ts:33`](../packages/local-npm-registry/src/commands/PublishCommand.ts#L33) through
  [`CommandUtil.service.ts:99`](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L99)),
  so this is a throughput problem rather than a race: a consumer subscribed to five local packages
  gets five sequential full installs when all five are touched. The dominant source is the problem 3
  cascade, which can rewrite several of one consumer's specifiers in a single run. That case is in one
  process, which knows the whole set up front, so grouping fixes it. Nothing groups across watchers,
  and two libraries being touched at once is the rare case.
- **Installs outside the lock can still collide.**
  [`ClearStoreCommand.ts:66`](../packages/local-npm-registry/src/commands/ClearStoreCommand.ts#L66) and
  [`UnsubscribeCommand.ts:58`](../packages/local-npm-registry/src/commands/UnsubscribeCommand.ts#L58),
  [`:136`](../packages/local-npm-registry/src/commands/UnsubscribeCommand.ts#L136) call `runInstall`
  without acquiring anything, so one of them racing a publish in the same consumer is the real
  lockfile hazard.
- **`clear-store` runs N concurrent installs in the same directory.** Resets are collected per
  package and per subscriber, then
  [mapped in parallel](../packages/local-npm-registry/src/commands/ClearStoreCommand.ts#L59) with
  [one install each](../packages/local-npm-registry/src/commands/ClearStoreCommand.ts#L66), so a
  consumer subscribed to three packages gets three simultaneous installs.
  [`UnsubscribeCommand`](../packages/local-npm-registry/src/commands/UnsubscribeCommand.ts#L136)
  groups and installs once. [The package paths plan](./local-npm-registry-package-paths-plan.md)
  rewrites this loop and does the grouping there.
- **Sweeps must cross both dimensions.** `unsubscribe` with no argument, `clear-store`, and `prune`
  walk every package and every publishing directory. Publish only ever sees its own path's
  subscribers, so nothing else covers this.

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

### The fix: cascade through a derived graph

A dependent that is itself locally published must be **re-published** after its dependency changes,
not just re-installed. Publishing `core-ts-lib` re-publishes `core-ts-db-lib`, `core-ts-api-lib`,
`be-ts-lib`, and `be-ts-db-lib`, then updates leaf consumers once at the end. It rebuilds none of
them: compiled output does not embed the dependency, so only the specifier and the version change.

A subscription is an intent and must be explicit. A dependency edge is a fact already in package.json
and must never be re-declared. Expressing both through subscriptions costs ts-libs 10 `subscribe`
calls where 1 carries information, and a missed one silently drops a package from the cascade.

So on every publish, read each publishing package root's `dependencies` and `optionalDependencies`; a
name matching another publishing root is an edge. `devDependencies` and `peerDependencies` do not
count, since neither is carried in a dependent's tarball and the cascade exists to keep tarballs
consistent. That leaves 1 subscription in the consumer and 0 inside the monorepo, and works outside a
workspace, unlike reading `pnpm-workspace.yaml`.

The nodes are the `(name, path)` pairs already in the store, which is every package set up to publish
and nothing else. `pnpm watch` fills it at startup, since nodemon runs its exec command immediately
rather than only on change. The window before a watcher's first publish closes itself: a dependent
publishing before its dependency is re-pinned by that dependency's cascade a moment later, and one
publishing after is pinned by its own pre-pack pin check. With two publishing directories of one package
registered, a dependency name resolves to the path sharing the longest **segment-wise** common
ancestor with the dependent, so `~/dev/ts-libs` cannot match `~/dev/ts-libs-hotfix` on a string
prefix, and a tie warns and drops the edge rather than guessing.

The graph is never stored. Building it costs 0.172ms median against ~370ms per `npm publish`, so a
cached copy saves nothing worth an invalidation rule, and recomputing is stricter anyway because **an
edge is the presence of a dependency key, never its value**: neither `propagateVersion` rewriting a
specifier nor a transient pin mid-cascade can change what it sees. Caching each entry's outgoing
edges instead leaves a dependent's edges short until that dependent itself publishes, which is the
same silent drop one layer down.

### The walk

One process runs all of it. The `publish` the edited folder's watcher started derives the graph,
sorts it, and packs each dependent itself, by writing that dependent's version and pins, publishing
from its folder, and restoring the file. No other watcher takes part and none is notified.

The publishing node goes first, then its dependents in topological order, deduped, pruned to nodes
that reach a live subscriber through dependent edges. Dedupe and order are one mechanism rather than
two: the dependents walk collects a set, so a node reached by several routes is added once, and the
order comes from topologically sorting that set afterwards. Deduping on first arrival during an
ordered traversal packs a node at its earliest route rather than its latest, which is the stale pin
the ordering exists to prevent.

Order is load bearing because each node is packed once and a tarball's requirements are frozen at
pack time, so a node packed too early keeps a stale pin that no later install repairs. Sorting is
still an optimization rather than the correctness mechanism: re-triggering every dependent to
quiescence converges on the same tarballs without a sort, at one pack per **path** rather than per
node, 12 against 5 for the chain above.

A cycle has no correct pack order, so throw naming it. Counting `devDependencies` would manufacture
one immediately, since `core-ts-lib` devDepends on `local-npm-registry` which depends on
`core-ts-lib`, and only the second of those is an edge. An unreadable package.json contributes no
edges and is logged, with `prune` as the repair.

### Watchers must not watch package.json

The walk packs each node once because one process is the only thing publishing. A watcher triggering
on `package.json` breaks that outright, and not just by wasting publishes: the cascade writes each
dependent's file twice, once to pin and once to restore, so every dependent it touches would start a
publish that cascades and writes again. It sustains itself.

Every watch script is `nodemon -e ts`, which is what makes this safe. Watching `package.json`, or
dropping `-e`, reintroduces it.

### The rest of the cascade

- **Batch the leaf installs.** One install per consumer after the cascade settles, the same grouping
  problem 2 needs.
- **Prune after the cascade succeeds.** An interrupted cascade otherwise leaves consumers pinned to
  deleted versions, and the blast radius grows with graph depth. Each publish gets a unique version,
  so nothing requires deleting first. [The package paths plan](./local-npm-registry-package-paths-plan.md)
  already turns delete-before-publish into a per path prune after the publish; what remains is moving
  it out to the end of the cascade.
- **Check pins before packing.** Assert every locally published dependency is pinned to its current
  local version, and re-pin if not. Restoring the rewrite after packing leaves a dependent's
  specifier sitting at `^2.4.6`, which no prerelease satisfies, so packing without pinning first
  ships a tarball that resolves through the npmjs uplink to the real published version. This is the
  silent variant above, reached from the other direction.
- **Restore dependency rewrites after packing.** `publishAndUpdateSubscribers` restores only the
  `version` field, so a package that both publishes and subscribes keeps a timestamped specifier in
  its working tree forever. That dirties the repo, breaks a later plain install, and leaks into any
  real npm publish. With the pin check, the pin becomes transient pack-time state.
- **Write package.json atomically**, temp file and rename, matching `#writeStore` in the paths plan.
  A reader must see the old file or the new one and never a torn one.
- **Drop `pnpm propagateVersion` from `build:withoutClean`** in all six packages. It exists to keep
  workspace dependents' declared ranges in sync with bumped versions for the real npm publish, which
  [`prepareAllPackages`](../scripts/prepareAllPackages.ts) already does by running it after
  `preparePkg` until checksums settle, and which CI enforces through `versionPropagation:validate`.
  The cascade needs none of it, since it re-pins dependents itself before packing. Running it on
  every build is what clobbers the exact pin on every save, and what propagates `^2.4.6-<ts>` into
  every dependent when a build lands while a version is timestamped. The script itself stays.

Transient pins left behind by a cascade killed partway are the journal's problem, in problem 1.

## Problem 4: one package published from two directories at once

Two copies of one package publishing and being consumed at the same time. Nothing looks at git, so
how the second directory got there does not matter: a clone, a worktree, and a copied directory are
all the same thing here.

[`local-npm-registry-package-paths-plan.md`](./local-npm-registry-package-paths-plan.md) carries the
design and the steps. It also owns the store concurrency, write error, and invalid store items, since
a store that is not v2 and a store that is corrupt get the same treatment there.

## Other hardening items

1. **`updatePackageVersion` rewrites every `"version":` in the file.** The
   [regex is global](../packages/local-npm-registry/src/services/PackageJson.service.ts#L80), so a
   nested `"version"` key is rewritten too. Latent, but destructive if hit and cheap to anchor to the
   top-level key.
2. **Failures do not affect the exit code.** Subscriber update failures are logged and the process
   exits 0
   ([`CommandUtil.service.ts:110`](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L110),
   [`ClearStoreCommand.ts:77`](../packages/local-npm-registry/src/commands/ClearStoreCommand.ts#L77)).
   In a watch loop that makes breakage invisible.

## Suggested phases

**Phase 1.** The journal and signal handlers, plus extending `prune` to replay it.

**Phase 2.** Deriving the graph and the topological cascade walk, moving the prune to the end of it,
the pre-pack pin check, restoring dependency rewrites, and the grouping fixes.

**Phase 3.** [The package paths plan](./local-npm-registry-package-paths-plan.md), which carries its
own tests.

**Phase 4, tests.** [`TestProjectUtils`](../packages/local-npm-registry/test-utils/TestProjectUtils.ts)
is the base.

- Two concurrent publishes on one shared subscriber, asserting a correct final lockfile.
- A three-level chain (`lib` → `midLib` → `consumer`): publishing `lib` re-publishes `midLib`, the
  consumer resolves exactly one copy of `lib`, and a second `lib` publish does not break its install.
- The emitted publish order for a known graph, plus dedupe and the subscriber prune. Nothing at
  runtime guards any of the three.
- The silent variant: the consumer never ends up with two versions of one local package.
- One consumer subscribed to two packages: a single install per consumer on `clear-store`, and
  correct resets across both.
- Kill mid-install (`SIGTERM` a child process), then assert the next command self-heals.

## Rejected

- **A persistent or daemonized Verdaccio.** The registry does not sit in the background consuming
  resources; it starts and stops per command. Everything else has to work inside that.
- **A `local-npm watch` that owns the build.** Watching stays in the consumer's hands. Owning it
  means supporting every option and parameter someone's build might need, which is not coverable.

## Open questions

None. The cascade is automatic with no opt-out, since the subscriber prune already bounds it and a
package nobody can reach is never packed.
