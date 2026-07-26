# Hardening `local-npm-registry`

Working document. The driving problems, plus the correctness gaps found while tracing them.

> Assumption: the "leftover `.nvmrc`" issue means leftover `.npmrc` (and `.npmrc.tmp`). Nothing in the
> package touches `.nvmrc`.

## Problem 1: leftover `.npmrc` files in consumers

[Registry redirection](#registry-redirection) goes to the install command rather than to the
filesystem, so no consumer receives a generated `.npmrc`, there is no `.npmrc.tmp` sentinel, and there
is no create/restore pair for two concurrent operations to interleave. Two related causes remain.

### Nothing survives a killed process

`nodemon --exec "pnpm build && local-npm publish"` sends `SIGTERM` to the running publish on the next
file save. There are no signal handlers anywhere in the package, so `finally` never runs. Left behind:

- The publishing library's own `package.json` still holding the timestamped version, because
  `publishAndUpdateSubscribers`
  [restores it only at the end](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L121).
- A subscriber `package.json` pinned to a version that the next publish deletes from Verdaccio, so
  the next plain `pnpm install` in that consumer fails.
- The Verdaccio lock file, since `proper-lockfile` cleans up on process `exit` and an unhandled
  `SIGTERM` does not run `exit` handlers. The next publish then waits out the full stale window before
  it can acquire.

"Rapid updates" is exactly the case that produces this: the watcher kills the previous run mid-install.

### A leftover generated `.npmrc` makes Verdaccio proxy itself

[`#parseNpmrcForVerdaccio`](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L393)
turns every `@org:registry=URL` line found up the directory tree into a Verdaccio uplink. A file left
behind by an older version of the tool contains `@org:registry=http://localhost:4873`, so Verdaccio
gets an uplink pointing at itself, which means hangs and timeouts that look unrelated to the leftover
file. Guard against this by skipping any registry URL equal to the local registry URL when
[building uplinks](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L414).

### Registry redirection

Every install gets the redirection on its own command line, mirroring what
[`#buildPublishArgs`](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L481) does for
publish:

- npm / pnpm: `--registry=<url>`, plus one `--@<org>:registry=<url>` per scoped org, plus
  `--//<host>/:_authToken=fake`
- Yarn Classic: `--registry=<url>`, plus one `npm_config_@<org>:registry=<url>` env var per scoped org
- Yarn Berry: `YARN_NPM_REGISTRY_SERVER`, `YARN_UNSAFE_HTTP_WHITELIST=<hostname>` env vars

CLI flags sit above project `.npmrc` in npm's config precedence, which is required, since the point is
to override a scoped registry the consumer already configures. Env vars alone sit *below* project
`.npmrc`, so `npm_config_*` is not sufficient on its own for npm and pnpm. Yarn Classic inverts that
ordering and ranks env vars above a project `.npmrc`, which is what makes its entry above work.

There is no file to leak and no race to lose.
[`PackageManagerCliService`](../packages/local-npm-registry/src/services/PackageManagerService/PackageManagerCli.service.ts)
resolves the scope list and runs the install, and each package manager's own form of the redirection
sits in
[`PACKAGE_MANAGER_INFO.getRegistryOverrideCliOptions`](../packages/local-npm-registry/src/types/PackageManager.ts).
The scope list comes from the store: every package the consumer is subscribed to, per
[`getSubscribedPackages`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L164).

#### Spike results

Verified against npm 11.6.2, pnpm 10.25.0, Yarn 1.22.22, and Yarn 4.6.0. The discriminating test
installs a package that exists only in the local Verdaccio while the consumer's `.npmrc` points that
scope at `registry.npmjs.org`, so a successful install proves the override outranked the file. Each
mechanism was also negative-controlled by removing it and confirming the install falls through to
`registry.npmjs.org`.

| Package manager | Result | Mechanism that is load bearing |
| --- | --- | --- |
| npm | Works | `--@<org>:registry`. `--registry` alone loses to the project `.npmrc` |
| pnpm | Works | Same as npm. Accepts `--@<org>:registry` directly, no `--config.` prefix needed |
| Yarn Classic | Works | `npm_config_@<org>:registry` env var. `--@<org>:registry` is *silently ignored*, and `--registry` alone loses to the project `.npmrc` |
| Yarn Berry | Works | `YARN_NPM_REGISTRY_SERVER` plus `YARN_UNSAFE_HTTP_WHITELIST`. Berry ignores `.npmrc` entirely, and refuses plain http without the whitelist |

No unrecognized flag hard-errors: pnpm accepts the npm-style scoped flag, and Yarn Classic parses
`--@<org>:registry` without complaint even though it does nothing with it. Two findings worth keeping
in mind:

1. **Yarn Classic needs an env var, not a flag.** A flags-only implementation resolves scoped packages
   from the consumer's configured registry with no warning. This is the one place where the mechanism
   genuinely differs per package manager.
2. **Yarn Berry's `npmScopes` cannot be overridden.** A consumer `.yarnrc.yml` that sets
   `npmScopes.<scope>.npmRegistryServer` beats `YARN_NPM_REGISTRY_SERVER`, and Berry rejects
   `YARN_NPM_SCOPES` outright: `Map configuration settings "npmScopes" must be an object in
   <environment>`. `PackageManagerCliService` warns when a Yarn Berry consumer has an `npmScopes`
   entry for a scope being redirected.

### Making mutations crash safe

`package.json` still gets mutated, so the recovery machinery is worth building on its own:

- **Journal before mutating.** `<dataDir>/pending-mutations.json` holding
  `{ id, pid, startedAt, kind, targetPath, originalContent }` per in-flight change, cleared on
  successful restore. Sits next to the
  [existing store file](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L223).
- **Self heal on startup.** Every command replays journal entries whose `pid` is no longer alive
  before doing anything else.
- **`local-npm doctor [--fix]`.** Replays the journal, and sweeps every known subscriber path for a
  `.npmrc` carrying the `# Created by local-npm-registry` header plus any `.npmrc.tmp`, both of which
  older versions of the tool can leave behind.
- **Signal handlers.** `SIGINT`, `SIGTERM`, `SIGHUP`, and `uncaughtException` restore synchronously
  (`fs.writeFileSync`), release the Verdaccio lock, and re-raise. Async cleanup in a signal handler is
  not reliable. Nothing in [`index.ts`](../packages/local-npm-registry/src/index.ts) registers any
  handler today.

### Stopping the pile-up at the source

- Per package publish lock so overlapping publishes queue instead of interleave, with a supersede
  rule: a newer queued publish for the same package replaces the waiting one rather than adding to
  the queue.
- Consider `local-npm watch` owning the debounce, instead of relying on nodemon's kill-and-restart.

## Problem 2: multiple subscriptions in one consumer

One consumer subscribing to several local packages at once is a first-class case, and several places
assume otherwise:

- **Two watchers still run two installs in one consumer.** Two libraries with watchers running both
  call `runInstallWithRegistry` against the same consumer directory. Nothing is written to that
  directory any more, but the two installs still race on its lockfile and `node_modules`.
- **`clear-store` runs N concurrent installs in the same directory.** Reset operations are collected
  per package and per subscriber, then
  [mapped in parallel](../packages/local-npm-registry/src/commands/ClearStoreCommand.ts#L59) with
  [one install each](../packages/local-npm-registry/src/commands/ClearStoreCommand.ts#L66). A consumer
  subscribed to three packages gets three simultaneous installs in one directory, which can corrupt
  its lockfile.
  [`UnsubscribeCommand`](../packages/local-npm-registry/src/commands/UnsubscribeCommand.ts#L136)
  already does the right thing by grouping and installing once. Group by subscriber path here too.
- **Sweeps must cross both dimensions.** `unsubscribe` with no argument, `clear-store`, and `prune`
  have to walk every package and every branch to find the consumer's bindings.

## Problem 3: chains of locally published packages

A locally published package that itself depends on another locally published package. The tool has no
model for this, and it breaks constantly in this monorepo because sibling packages depend on each other
by published version range rather than by `workspace:`, for example
[`core-ts-api-lib` depends on `@aneuhold/core-ts-lib: ^2.4.6`](../packages/core-ts-api-lib/package.json).

### Worked example

`gcloud-backend` depends on `core-ts-api-lib`, `core-ts-lib`, `core-ts-db-lib`, `be-ts-lib`, and
`be-ts-db-lib`, and most of those depend on `core-ts-lib` too, so the graph is a diamond rather than a
chain.

1. Publish `core-ts-lib`. It becomes `2.4.6-<ts1>`. Every subscriber's specifier is
   [rewritten to that exact version](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L92),
   including `packages/core-ts-api-lib`, whose `package.json` on disk now reads
   `"@aneuhold/core-ts-lib": "2.4.6-<ts1>"`.
2. Publish `core-ts-api-lib`. `npm publish` packs the `package.json` **as it currently sits on disk**,
   so the tarball `core-ts-api-lib@3.0.41-<ts2>` carries a hard exact dependency on
   `core-ts-lib@2.4.6-<ts1>`. `gcloud-backend` installs and resolves fine, because `<ts1>` still
   exists and the top-level pin and the transitive pin are the same version.
3. Save a file in `core-ts-lib`. The watcher publishes `2.4.6-<ts3>`, and
   [`#clearPublishedPackagesLocally`](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L274)
   **deletes every existing version of `core-ts-lib` first, including `<ts1>`**. `gcloud-backend`'s own
   specifier is updated to `<ts3>`, then install runs. But `gcloud-backend` still has
   `core-ts-api-lib@3.0.41-<ts2>` pinned, and that tarball demands `core-ts-lib@2.4.6-<ts1>`, which no
   longer exists.

The install fails naming `core-ts-lib` while the user is thinking about `core-ts-api-lib`, which is
what makes it read as "the locally subscribed `core-ts-api-lib` doesn't have the right version".
Expected error text is pnpm's `ERR_PNPM_NO_MATCHING_VERSION` for
`@aneuhold/core-ts-lib@2.4.6-<timestamp>`. This also explains why subscribing `gcloud-backend` to
`core-ts-lib` as well does not help: that only rewrites `gcloud-backend`'s own direct specifier, and
the requirement baked into the `core-ts-api-lib` tarball is untouched.

### The silent variant

The same chain can fail without any error at all. Prerelease versions do not satisfy plain ranges, so
`2.4.6-<ts3>` does **not** satisfy `^2.4.6`. If `core-ts-api-lib` is published while its specifier for
`core-ts-lib` sits at `^2.4.6`, the tarball's transitive requirement resolves through Verdaccio's
npmjs uplink to the **real published** `2.4.6`. The consumer then ends up with two copies: the real
`core-ts-lib` nested under `core-ts-api-lib`, and the local build at the top level. Install succeeds,
and the consumer runs half-stale code with duplicated module state.

The monorepo's own tooling walks straight into this.
[`propagatePackageVersion`](../packages/core-ts-lib/src/services/Dependency.service.ts#L177) rewrites
every workspace dependent's specifier to
[`^${version}`](../packages/core-ts-lib/src/services/Dependency.service.ts#L241), and it runs as part
of `build:withoutClean` in [every package](../packages/local-npm-registry/package.json), so the
standard `pnpm build && local-npm publish` watch loop **clobbers the exact pin on every save** and then
re-pins it a moment later. Two watchers running in different packages can therefore publish a tarball
during the window where the specifier is back to `^2.4.6`.

There is a second hazard in the same area: if a build runs while a package's own version is temporarily
timestamped by an in-flight publish, propagation writes `^2.4.6-<ts>` into every dependent, which is a
range whose resolution depends on whatever else the registry happens to hold.

### Why this monorepo is special

[`linkWorkspacePackages` and `preferWorkspacePackages` are both true](../pnpm-workspace.yaml), so
inside `ts-libs` pnpm normally links sibling packages rather than fetching them. Once the tool pins an
exact timestamped version, the workspace sibling's version no longer satisfies it, so pnpm silently
switches to fetching that package from Verdaccio into the monorepo's own `node_modules`. A later plain
`pnpm install` at the `ts-libs` root then fails if that version has since been pruned. Consumers
outside the workspace never had the link in the first place, so they see different resolution behavior
from the monorepo, which is why the failure looks inconsistent.

### Fixes

- **Cascade publishes through the local dependency graph.** This is the missing piece. A subscriber
  that is itself a locally published package must be **re-published** after its dependency changes, not
  merely re-installed. Publishing `core-ts-lib` should re-publish `core-ts-api-lib`, `core-ts-db-lib`,
  `be-ts-lib`, and `be-ts-db-lib`, then update the leaf consumers once at the end. The store already
  holds everything needed to derive the graph: a subscriber is also a publisher when some package
  entry's `packageRootPath` equals that `subscriberPath`. Walk it in topological order, dedupe packages
  reached by several paths, and detect cycles.
- **Batch the leaf installs.** A cascade must not run one install per level in the same consumer. Do a
  single install per consumer after the whole cascade settles, which is the same grouping fix problem 2
  needs.
- **Prune after the cascade succeeds, rather than before the publish.** Today
  [every version is deleted first](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L170),
  which is safe only if the cascade then completes. An interrupted cascade leaves consumers pinned to
  versions that no longer exist, and the blast radius grows with the depth of the graph. Deleting is
  only about bounding storage growth, and each publish already gets a unique version, so nothing
  requires it to happen first. Move it to the end of a successful cascade and keep the newest.
- **Check pins before packing.** Before packing any package, assert that every dependency which is
  itself locally published is pinned to that package's current local version, and re-pin it if not.
  This is what closes the
  [propagation race](../packages/core-ts-lib/src/services/Dependency.service.ts#L241): a dependent's
  own watcher can fire during the window where `propagateVersion` has reset the specifier to `^2.4.6`
  but the publish has not re-pinned it yet, and without this check that window ships a tarball that
  resolves to the real npmjs version.
- **Restore dependency rewrites after packing.** `publishAndUpdateSubscribers` restores only the
  `version` field of the package it published, so a package that is both publisher and subscriber keeps
  a timestamped dependency specifier in its working tree forever. That dirties the repo, breaks a later
  plain install once the version is pruned, and leaks a timestamped specifier into any real npm
  publish. With the pin check above, the pin can be treated as transient state applied at pack time and
  restored afterwards, instead of permanent state the working tree has to carry.

A cascade re-publish does **not** need to rebuild the dependent. Compiled output does not embed the
dependency, so only the specifier and the version change, which keeps the cascade cheap and avoids
re-triggering `propagateVersion` partway through.

Topological order is load-bearing rather than a nicety. `be-ts-db-lib` depends on `core-ts-db-lib`,
which depends on `core-ts-lib`, so publishing `be-ts-db-lib` before `core-ts-db-lib` would bake a stale
`core-ts-db-lib` pin into its tarball and reproduce the same bug one level up.

## Problem 4: two worktrees publishing and consuming the same package at once

### What blocks it today

| Blocker | Location |
| --- | --- |
| Store is keyed by package name only: one `currentVersion`, one `packageRootPath`, one subscriber list | [`LocalPackageStore.service.ts:44`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L44) |
| Every publish [deletes the whole package](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L170) from Verdaccio storage first, destroying the version the other worktree's consumer is pinned to | [`Verdaccio.service.ts:274`](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L274) |
| Single shared `local` dist-tag | [`Verdaccio.service.ts:504`](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L504) |
| Every subscriber of the name is updated on any publish, so worktree A's consumer receives worktree B's build | [`CommandUtil.service.ts:92`](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L92) |
| `publish` inherits `originalVersion` from the single shared entry, so the second worktree's baseline comes from the first | [`PublishCommand.ts:28`](../packages/local-npm-registry/src/commands/PublishCommand.ts#L28) |
| `subscribe` resolves `entry.packageRootPath`, which points at whichever worktree published last | [`SubscribeCommand.ts:49`](../packages/local-npm-registry/src/commands/SubscribeCommand.ts#L49) |
| The Verdaccio lock's acquire window is roughly 10s, far shorter than a publish plus installs, so the second worktree's publish fails instead of waiting | [`Mutex.service.ts:19`](../packages/local-npm-registry/src/services/Mutex.service.ts#L19), [`:51`](../packages/local-npm-registry/src/services/Mutex.service.ts#L51) |

### Design: key everything by branch name

The isolation key is the **git branch name** of the package being published. Git does not allow two
worktrees on the same branch, so the branch name alone identifies a worktree. No hash or generated id
is added to it.

Resolution:

1. `git rev-parse --abbrev-ref HEAD` in the package root
2. `--branch <name>` flag or `LOCAL_NPM_BRANCH` env var as an override
3. Detached HEAD (mid-rebase, a checked-out tag) or a non-git directory has no branch, so fail with a
   message telling the user to pass `--branch`. Do not invent a fallback id.

Branch names need slugging before they can go in a version string: lowercase, replace anything outside
`[0-9a-z-]` with `-`, collapse repeats, trim. So `feature/Fix_Bug-2` becomes `feature-fix-bug-2`. The
store keys on the real branch name and the slug is only used for the version and the dist tag. Two
branches can slug to the same value (`feat/x` and `feat-x`), so detect a slug collision against the
store at publish time and fail rather than silently sharing a version namespace.

### Store v2 shape

Replaces the [current flat shape](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L25):

```json
{
  "version": 2,
  "packages": {
    "@aneuhold/core-ts-lib": {
      "branches": {
        "HardenLocalNpmRegistry": {
          "originalVersion": "2.4.6",
          "currentVersion": "2.4.6-hardenlocalnpmregistry.20250726123456789",
          "packageRootPath": "/Users/x/dev/ts-libs-harden/packages/core-ts-lib",
          "publishArgs": ["--ignore-scripts"],
          "publishedVersions": ["2.4.6-hardenlocalnpmregistry.20250726123456789"],
          "subscribers": [
            {
              "subscriberPath": "/Users/x/dev/app-worktree",
              "originalSpecifier": "^2.4.6"
            }
          ]
        },
        "main": { "...": "..." }
      }
    }
  }
}
```

Add a `version` field and a migration that folds existing flat entries into a single branch so the
current store keeps working. The
[`README` store documentation](../packages/local-npm-registry/README.md#local-json-store-structure)
needs the same update.

### Version format

`<originalVersion>-<branchSlug>.<timestamp>`, for example
`2.4.6-hardenlocalnpmregistry.20250726123456789`, generated by
[`generateTimestampVersion`](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L21).

Valid semver: prerelease identifiers are dot-separated alphanumerics and hyphens, and the numeric
timestamp has no leading zero. Long branch names make long versions, which is legal but ugly, so
consider truncating the slug.

[`timestampPattern`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L61)
becomes roughly `/-(?<branch>[0-9a-z][0-9a-z-]*)\.(?<timestamp>\d{17})$/`, and should still recognize
the old `-\d{17}` form so pre-existing timestamped `package.json` files can be detected and reset.

Ordering between branches does not matter, because subscribers pin exact versions. Dist tags become
per branch: `--tag local-<branchSlug>` instead of
[`--tag local`](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L504).

### Subscribe binding

Record the publisher's branch on the
[subscriber record](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L12). The
consumer's own branch is irrelevant, since the consumer repo can be on any branch, so the binding is
recorded explicitly at subscribe time rather than inferred.

When [`subscribe`](../packages/local-npm-registry/src/commands/SubscribeCommand.ts#L16) is run without
`--branch`: bind to the only published branch if there is exactly one, otherwise fail and list the
branches. A publish then only updates the subscribers bound to its own branch. A consumer has a single
specifier slot per dependency, so it cannot be bound to two branches of the same package at once.

### Registry retention

Replace "delete the package before every publish" with "prune only this branch's versions, and never
touch another branch's versions". Problem 3 moves the same prune to the end of a successful cascade, so
the two combine into one rule: prune this branch's older versions once the publish and any cascade have
succeeded.

Prefer doing this through the running server (`npm unpublish <pkg>@<version> --registry=<url>`, which
needs `unpublish: ['$all']` added to the
[Verdaccio `packages` config](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L352))
rather than
[hand-editing `.verdaccio-db.json` and deleting storage directories](../packages/local-npm-registry/src/services/Verdaccio.service.ts#L274)
underneath a live server. The current approach races with Verdaccio's own in-memory metadata.

### Making two worktrees able to run at the same time

Verdaccio keeps starting and stopping per command, so the two worktrees serialize on the existing
lock. The only thing needed is for the second one to **wait** rather than fail:

- Separate `stale` from the acquire timeout. They are
  [currently the same value](../packages/local-npm-registry/src/services/Mutex.service.ts#L48), which
  is what caps the wait at roughly 10s.
- Give the acquire timeout a budget that matches a real publish plus installs, and log periodically
  while waiting so a queued publish does not look hung.
- Store writes need to be safe across processes independently of this lock, because
  `unpublish`, `unsubscribe`, and `clear-store` never take it. See hardening item 1.

### Worktree lifecycle

Worktrees get deleted, which the current model has no answer for:

- `local-npm prune`: drop branches whose `packageRootPath` no longer exists, unpublish their versions,
  and restore then drop subscribers whose paths no longer exist. Without this, every publish
  [logs failures](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L102) for dead
  paths forever. A live consumer bound to a deleted branch needs its `originalSpecifier` restored, not
  just its record dropped.
- `local-npm unpublish --branch <name>` and `--all-branches`, extending
  [`UnpublishCommand`](../packages/local-npm-registry/src/commands/UnpublishCommand.ts#L16).
- [`local-npm list`](../packages/local-npm-registry/src/index.ts#L103) groups by package, then branch,
  and marks the branch matching the current directory.

## Other hardening items

1. **Store read-modify-write is a lost-update race.** Every mutator does `getStore()`, edits, then
   `#writeStore()`:
   [`updatePackageEntry`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L93),
   [`removePackage`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L114),
   [`addSubscriber`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L128),
   [`removeSubscriber`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L150).
   Publish and subscribe happen to be serialized by the Verdaccio lock, but `unpublish`,
   `unsubscribe`, and `clear-store` never acquire it, and `publish`
   [reads the entry](../packages/local-npm-registry/src/commands/PublishCommand.ts#L24) before the lock
   exists. Needs its own lock around the read-modify-write plus atomic writes (temp file and rename).
2. **A corrupt store silently becomes an empty store.**
   [`getStore`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L83) returns
   `{ packages: {} }` on any read or parse error, and
   [`#isLocalPackageStore`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L210)
   only checks that `packages` is an object, so malformed entries pass through as well. Every
   subscriber is orphaned at that point, since the `originalSpecifier` values needed to reset them are
   gone. Back up the bad file, validate and normalize entries, and refuse destructive operations
   instead of proceeding on an empty store.
3. **`#writeStore` swallows write errors**
   ([`:241`](../packages/local-npm-registry/src/services/LocalPackageStore.service.ts#L241)), so
   callers believe a mutation succeeded. Should throw.
4. **`stale` doubles as the acquire timeout.** See the concurrency section above. The same conflation
   also sets how long a publish waits after a previous run is hard-killed, since the abandoned lock
   only becomes reclaimable once `stale` elapses.
5. **Skip self-referential Verdaccio uplinks.** See the self-proxying uplink above.
6. **`updatePackageVersion` rewrites every `"version":` in the file.** The
   [regex is global](../packages/local-npm-registry/src/services/PackageJson.service.ts#L80), so a
   nested `"version"` key anywhere in the `package.json` is rewritten too. Latent rather than live,
   but destructive if hit and cheap to anchor to the top-level key.
7. **Failures do not affect the exit code.** Subscriber update failures are logged and the process
   still exits 0
   ([`CommandUtil.service.ts:110`](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L110),
   [`ClearStoreCommand.ts:77`](../packages/local-npm-registry/src/commands/ClearStoreCommand.ts#L77)).
   In a watch loop that makes real breakage invisible.
8. **`publishArgs` merge semantics are unclear.** `subscribe`
   [reuses stored args](../packages/local-npm-registry/src/commands/SubscribeCommand.ts#L53) while
   `publish`
   [overwrites them](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L73) with
   whatever the current invocation passes. Decide and document one rule.

## Suggested phases

**Phase 1, stop the bleeding.** Hardening items 1, 2, 3, and 5. Journal plus signal handlers plus
`local-npm doctor --fix`. Small, independent, and each one removes a class of leftover.

**Phase 2, chains and multiple subscriptions.** The topological cascade walk, moving the prune to
after a successful cascade, the pre-pack pin check, restoring dependency rewrites, and the grouping
fixes so a consumer gets one install per operation. This is the phase that fixes the
dependency-of-a-dependency failures.

**Phase 3, branches.** Store v2 plus migration, branch-scoped versions and dist tags, per-branch
retention, subscriber branch binding, the lock wait budget, `prune`, and the CLI surface in
[`index.ts`](../packages/local-npm-registry/src/index.ts).

**Phase 4, tests.**
[`TestProjectUtils`](../packages/local-npm-registry/test-utils/TestProjectUtils.ts) is a good base.
Add:

- Two concurrent publishes touching one shared subscriber, asserting a correct final lockfile in the
  consumer.
- A three-level chain (`lib` to `midLib` to `consumer`) asserting that publishing `lib` re-publishes
  `midLib`, that the consumer resolves exactly one copy of `lib`, and that a second `lib` publish does
  not break the consumer's install.
- The silent variant specifically: assert the consumer never ends up with two versions of the same
  local package in its tree.
- One consumer subscribed to two packages, asserting a single install per consumer on `clear-store`
  and correct resets across both.
- Kill mid-install (`SIGTERM` a child process), then assert the next command self-heals.
- Two branches of one package with two consumers, asserting each consumer resolves its own build and
  that publishing on one branch does not touch the other. Extends
  [`PublishCommand.spec.ts`](../packages/local-npm-registry/src/commands/PublishCommand.spec.ts) and
  [`SubscribeCommand.spec.ts`](../packages/local-npm-registry/src/commands/SubscribeCommand.spec.ts).
- Store concurrency: parallel mutations, asserting no lost updates.

## Rejected

- **A persistent or daemonized Verdaccio.** Design requirement: the registry does not sit in the
  background consuming resources. It starts and stops per command.
- **Tarball URL specifiers instead of registry redirection.** All four package managers support remote
  tarball URLs, but this relocates the leak into the consumer's lockfile rather than removing it, and
  a committed lockfile pointing at `http://localhost:4873` breaks CI for everyone rather than one
  machine.

## Open questions

1. Should a cascade publish be automatic, or opt-in per package? Automatic is correct, and skipping the
   dependent rebuild keeps it cheap, but one save in `core-ts-lib` still means four pack-and-publish
   round trips before the consumer install.
2. Should `propagateVersion` stay in the build script that the watch loop runs? The pre-pack pin check
   makes it survivable either way, so this is now about noise rather than correctness.
