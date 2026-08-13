# Hardening `local-npm-registry`

Open problems and the correctness gaps behind them.

## Problem: chains of locally published packages

A locally published package depending on another. Sibling packages here depend on each other by
published range rather than `workspace:`, for example
[`core-ts-api-lib` on `@aneuhold/core-ts-lib: ^2.4.6`](../packages/core-ts-api-lib/package.json).

### Worked example

`gcloud-backend` depends on `core-ts-api-lib`, `core-ts-lib`, `core-ts-db-lib`, `be-ts-lib`, and
`be-ts-db-lib`, most of which depend on `core-ts-lib`, so the graph is a diamond.

1. Publish `core-ts-lib` → `2.4.6-<timestamp1>`. Every subscriber's specifier is
   [rewritten to that exact version](../packages/local-npm-registry/src/services/LocalPackageSubscriber.service.ts),
   including `packages/core-ts-api-lib`.
2. Publish `core-ts-api-lib`. `npm publish` packs the `package.json` **as it sits on disk**, so
   `core-ts-api-lib@3.0.41-<timestamp2>` carries an exact dependency on
   `core-ts-lib@2.4.6-<timestamp1>`. Installs fine, since `<timestamp1>` still exists.
3. Save a file in `core-ts-lib`. The watcher publishes `2.4.6-<timestamp3>`, and
   [`removeVersionsPublishedFrom`](../packages/local-npm-registry/src/services/Verdaccio.service.ts)
   **removes that directory's older versions, including `<timestamp1>`**, since a publishing directory
   keeps exactly one version. `gcloud-backend` moves to `<timestamp3>` but still has
   `core-ts-api-lib@3.0.41-<timestamp2>` pinned, whose tarball demands the removed `<timestamp1>`.

The install fails naming `core-ts-lib` while the user is thinking about `core-ts-api-lib`. Expect
pnpm's `ERR_PNPM_NO_MATCHING_VERSION`. Subscribing `gcloud-backend` to `core-ts-lib` does not help:
that rewrites only its own direct specifier, not the requirement baked into the tarball.

### An unpinned range pulls in the real published package

`core-ts-api-lib` declares `"@aneuhold/core-ts-lib": "^2.4.6"`, and only a subscription rewrites that
to an exact local version, so `npm publish` packs the committed range. No prerelease satisfies it, so
the tarball's transitive requirement resolves through Verdaccio's npmjs uplink to the **real
published** `2.4.6`. The consumer gets two copies: the real `core-ts-lib` nested under
`core-ts-api-lib`, and the local build at top level. Install succeeds, and the consumer runs
half-stale code with duplicated module state.

The monorepo's own tooling walks into this.
[`propagatePackageVersion`](../packages/core-ts-lib/src/services/Dependency.service.ts#L177) rewrites
every workspace dependent's specifier to
[`^${version}`](../packages/core-ts-lib/src/services/Dependency.service.ts#L241) as part of
`build:withoutClean` in [every package](../packages/local-npm-registry/package.json), so
`pnpm build && local-npm publish` **clobbers the exact pin on every save** and re-pins a moment
later. A watcher in another package can publish during that window.

Second hazard: a build running while a package's version is temporarily timestamped propagates
`^2.4.6-<timestamp>` into every dependent, a range whose resolution depends on whatever the registry
holds.

### Why workspace linking makes it worse

[`linkWorkspacePackages` and `preferWorkspacePackages` are both true](../pnpm-workspace.yaml), so
pnpm normally links siblings rather than fetching them. An exact timestamped pin no longer matches
the sibling's version, so pnpm silently fetches from Verdaccio into the monorepo's own
`node_modules`, and a later plain `pnpm install` at the root fails once that version is pruned.
Consumers outside the workspace never had the link, so they resolve differently from the monorepo.

### Cascade through a derived graph

A dependent that is itself locally published must be **re-published** after its dependency changes,
not just re-installed. Publishing `core-ts-lib` re-publishes `core-ts-db-lib`, `core-ts-api-lib`,
`be-ts-lib`, and `be-ts-db-lib`, then updates leaf consumers once at the end. It rebuilds none of
them: compiled output does not embed the dependency, so only the specifier and the version change.

A subscription is explicit on purpose. A dependency edge is already in package.json, so re-declaring
it as a subscription is duplication: it costs ts-libs 10 `subscribe` calls where 1 carries
information, and a missed one silently drops a package from the cascade.

So on every publish, read each publishing package root's `dependencies`; a name matching another
publishing root is an edge. `devDependencies` and `peerDependencies` do not count, since neither is
carried in a dependent's tarball and the cascade exists to keep tarballs consistent.
`optionalDependencies` are carried, but an install tolerates one it cannot resolve, so nothing
breaks through that edge. That leaves 1 subscription in the consumer and 0 inside the monorepo, and
works outside a workspace, unlike reading `pnpm-workspace.yaml`.

The nodes are the `(name, path)` pairs already in the store, which is every package set up to publish
and nothing else. `pnpm watch` fills it at startup, since nodemon runs its exec command immediately
rather than only on change. Nothing has to cover the window before a watcher's first publish: a dependent
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

### Publish order

One process runs all of it. The `publish` the edited folder's watcher started derives the graph,
sorts it, and publishes each dependent itself, by writing that dependent's version and pins,
publishing from its folder, and restoring the file. No other watcher takes part and none is notified.

The edited package goes first, then its dependents in topological order, deduped, pruned to packages
that reach a live subscriber through dependent edges. Dedupe and order are one mechanism rather than
two: the dependents walk collects a set, so a package reached by several routes is added once, and
the order comes from topologically sorting that set afterwards. Deduping on first arrival during an
ordered traversal publishes a package at its earliest route rather than its latest, which is the
stale pin the ordering exists to prevent.

Order matters because each package is published once and a tarball's requirements are frozen at pack
time, so one published too early keeps a stale pin that no later install repairs. Sorting is still an
optimization rather than the correctness mechanism: re-triggering every dependent to quiescence
converges on the same tarballs without a sort, at one publish per **path** rather than per package,
12 against 5 for the chain above.

A cycle has no correct publish order, so throw naming it. Counting `devDependencies` would manufacture
one immediately, since `core-ts-lib` devDepends on `local-npm-registry` which depends on
`core-ts-lib`, and only the second of those is an edge. An unreadable package.json contributes no
edges and is logged, with `prune` as the repair.

### Watchers must not watch package.json

The cascade publishes each package once because one process is the only thing publishing. A watcher triggering
on `package.json` breaks that outright, and not just by wasting publishes: the cascade writes each
dependent's file twice, once to pin and once to restore, so every dependent it touches would start a
publish that cascades and writes again. The loop never stops.

Every watch script is `nodemon -e ts`, which is what makes this safe. Watching `package.json`, or
dropping `-e`, reintroduces it.

### One install per consumer

The cascade publishes several packages in one run, and a consumer subscribed to more than one of them
has a specifier rewritten by each.
[`publishAndUpdateSubscribers`](../packages/local-npm-registry/src/services/LocalPackagePublisher.service.ts)
installs in every `PackageSubscriber` as part of publishing one package, so `gcloud-backend`,
subscribed to all five packages of the diamond above, takes five sequential full installs from one
save. Two publishes cannot overlap, since both hold the mutex across their installs, so this is
throughput rather than a race.

One process runs the whole cascade and knows every rewrite up front, so grouping fixes it: publish
every package first, then rewrite each subscriber's specifiers and run one install per
`subscriberPath`. The reset direction already works that way.
[`resetPackageSubscriptions`](../packages/local-npm-registry/src/services/LocalPackageSubscriber.service.ts)
groups by `subscriberPath` and installs once per directory, which is what `unsubscribe`, `unpublish`,
`prune`, and `clear-store` use.

Nothing groups across watchers. Two unrelated packages saved at one moment are two publish processes,
each running its own install in a shared subscriber, and that is the rare case.

### Remaining cascade work

- **Batch the leaf installs.** One install per `subscriberPath` once the cascade settles, rather than
  one per published package.
- **Move the retention sweep to the end of the cascade.** A publish already removes only its own
  directory's older versions, after publishing rather than before. An interrupted cascade still leaves
  consumers pinned to removed versions, and the blast radius grows with graph depth, so the sweep has
  to wait until every package is published.
- **Check pins before publishing.** Assert every locally published dependency is pinned to its
  current local version, and re-pin if not. Restoring the rewrite afterwards leaves a dependent's
  specifier sitting at `^2.4.6`, which no prerelease satisfies, so publishing without pinning first
  ships a tarball that resolves through the npmjs uplink to the real published version. This is the
  unpinned range above, reached from the other direction.
- **Restore dependency rewrites after publishing.** `publishAndUpdateSubscribers` restores only the
  `version` field, so a package that both publishes and subscribes keeps a timestamped specifier in
  its working tree forever. That dirties the repo, breaks a later plain install, and leaks into any
  real npm publish. With the pin check, the pin only has to hold while the tarball is packed.
- **Drop `pnpm propagateVersion` from `build:withoutClean`** in all six packages. It exists to keep
  workspace dependents' declared ranges in sync with bumped versions for the real npm publish, which
  [`prepareAllPackages`](../scripts/prepareAllPackages.ts) already does by running it after
  `preparePkg` until checksums settle, and which CI enforces through `versionPropagation:validate`.
  The cascade needs none of it, since it re-pins dependents itself before publishing them. Running it on
  every build is what clobbers the exact pin on every save, and what propagates `^2.4.6-<timestamp>` into
  every dependent when a build lands while a version is timestamped. The script itself stays.

## Other hardening items

1. **`updatePackageVersion` rewrites every `"version":` in the file.** The
   [regex is global](../packages/local-npm-registry/src/services/PackageJson.service.ts#L108), so a
   nested `"version"` key is rewritten too. Latent, but destructive if hit and cheap to anchor to the
   top-level key.
2. **A reset that fails does not affect the exit code.**
   [`resetPackageSubscriptions`](../packages/local-npm-registry/src/services/LocalPackageSubscriber.service.ts)
   logs a subscriber it could not reset and moves to the next one, so `unsubscribe`, `unpublish`,
   `prune`, and `clear-store` exit 0 having left a project pinned to a version that no longer
   resolves. Publish is already the other way: a subscriber it cannot update throws.

## Phases

**Phase 1.** Deriving the graph and the topological cascade walk, moving the retention sweep to the
end of it, the pin check before publishing, restoring dependency rewrites, and grouping the leaf
installs.

**Phase 2, tests.** [`TestProjectUtils`](../packages/local-npm-registry/test-utils/TestProjectUtils.ts)
is the base, and
[`ConcurrentTestProjectUtils`](../packages/local-npm-registry/test-utils/ConcurrentTestProjectUtils.ts)
runs one executable in several processes at once for anything that only contends between them.

- Two concurrent publishes on one shared subscriber, asserting a correct final lockfile.
- A three-level chain (`lib` → `midLib` → `consumer`): publishing `lib` re-publishes `midLib`, the
  consumer resolves exactly one copy of `lib`, and a second `lib` publish does not break its install.
- The emitted publish order for a known graph, plus dedupe and the subscriber prune. Nothing at
  runtime guards any of the three.
- An unpinned range: the consumer never ends up with two versions of one local package.
- A single install per `subscriberPath` on `clear-store` when it is subscribed to two packages. The
  grouping is in place; nothing asserts it.
- A single install in a consumer subscribed to two packages of one cascade.

## Rejected

- **A persistent or daemonized Verdaccio.** The registry does not sit in the background consuming
  resources; it starts and stops per command. Everything else has to work inside that.
- **A `local-npm watch` that owns the build.** Watching stays in the consumer's hands. Owning it
  means supporting every option and parameter someone's build might need, which is not coverable.

## Open questions

None. The cascade is automatic with no opt-out, since the subscriber prune already bounds it and a
package nobody can reach is never packed.
