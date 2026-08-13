# Implementation plan: `local-npm-registry` hardening

Steps for [the hardening doc](./local-npm-registry-hardening.md), in dependency order. Every step
leaves the package checking, linting, and testing clean.

## Step 1: package.json write primitives

`src/services/PackageJson.service.ts`.

- Replace `updatePackageVersion` with two methods, since every call site means one or the other and
  the cascade rewrites several specifiers of one file in one pass:
  - `updateVersionField(projectPath, version)`
  - `updateDependencySpecifiers(projectPath, specifiersByPackageName)`
- `updateVersionField` writes the top-level `version` key, located by scanning the raw text with a
  brace depth counter, so a nested `"version"` is left alone.
- `updateDependencySpecifiers` covers `dependencies`, `devDependencies`, and `peerDependencies`, the
  same three sections `getCurrentSpecifier` reads.
- `updatePackageVersionIfLocal` becomes `updateVersionFieldIfLocal(projectPath, version)` and loses
  its `packageName` parameter. Its only caller, `UnpublishCommand`, passes a publishing directory and
  that directory's own package name, so what it reverts is the `version` field.
- `getCurrentSpecifier` loses its fallback to the project's own `version` field, since
  `updateVersionFieldIfLocal` is the only caller that reaches it and it reads `getPackageInfo`
  directly.

## Step 2: the publish graph

One new file, `src/services/LocalPackageGraph.service.ts`, alongside the `LocalPackage` services it
joins. It cannot sit in `LocalPackageStoreService`, whose every method apart from `getStore` and
`writeStore` works against a store the caller holds with no file system access, and putting it in
`LocalPackagePublisherService` would make one service both derive the graph and run the publishes.
It is also what the graph unit tests target.

No new type file. `PublishedPackage = { packageName, packagePath }` goes in
`src/types/LocalPackageStore.ts`, which already carries that pair inside `PackageSubscription`, so
`PackageSubscription` becomes `PackageSubscriber & PublishedPackage`.

`LocalPackageGraphService.getPublishOrderStartingFrom(store, rootPackage)`, shaped like
`VerdaccioService.removeVersionsPublishedFrom`:

1. Every `PublishedPackage` in the store is a node of the graph.
2. Edges come from reading each one's `dependencies`; a name matching another `PublishedPackage` is
   an edge. An unreadable package.json warns and contributes no edges.
3. A dependency name registered from several paths resolves to the path sharing the longest
   segment-wise common ancestor with the dependent. A tie warns and drops the edge.
4. Walk dependent edges from the root collecting a set, then topologically sort that set with the
   root first.
5. A cycle throws naming the packages in it.
6. Prune to packages that reach a live subscriber through dependent edges. The root is always
   published, since `publish` in a directory is what puts that package in the store.

Rebuilt per publish and never stored.

## Step 3: cascade publish

`src/services/LocalPackagePublisher.service.ts` renames `publishAndUpdateSubscribers` to
`publishWithDependentsAndUpdateSubscribers(store, rootPackage, originalVersion, { additionalSubscriber, additionalPublishArgs })`,
since publishing the dependents is a caller visible effect rather than an implementation detail.
`rootPackage` is the `PublishedPackage` the command ran in.

1. Get the publish order.
2. Publish each package in order: pin its own version to a fresh timestamp version, pin every
   dependency specifier naming another `PublishedPackage` to that package's `currentVersion`,
   publish from its directory, restore the version field and every pinned specifier, then write its
   store entry.
3. Settle: hand every published package's subscribers to the subscriber service in one call.
4. Sweep: `removeVersionsPublishedFrom` per published package, only once every install is done.
5. On failure, restore package.json for every directory already touched before rethrowing.

Every package but the root takes `originalVersion` and `publishArgs` from its own store entry.
Pinning first is what keeps a committed `^2.4.6` out of a tarball, since `npm publish` packs the
package.json as it sits on disk, and restoring afterwards is what keeps the pin out of the working
tree. `PublishCommand` and `SubscribeCommand` both call it, as they call
`publishAndUpdateSubscribers` now.

## Step 4: one install per subscriber

`src/services/LocalPackageSubscriber.service.ts`.

Both directions do the same three things, so they go through one private method rather than two
copies of it. `#updateSubscriberSpecifiersAndInstall(store, specifiersBySubscriberPath)` reuses the
existing `#groupBySubscriberPath`, writes each directory's specifiers in one
`updateDependencySpecifiers`, runs one install per directory, and throws listing every directory that
failed. Which install it runs is the rule `resetPackageSubscriptions` already applies: the registry
when that directory still holds subscriptions, a plain install when it holds none.

- `updateSubscribersToVersion` becomes
  `updateSubscribersToPublishedVersions(store, publishedPackages)`, pruning subscribers whose
  directory is gone once for the whole cascade and then calling the shared method.
- `resetPackageSubscriptions` keeps its store removal and Verdaccio lifecycle and calls the shared
  method for the rest, which is what makes it throw rather than log, so `unsubscribe`, `unpublish`,
  `prune`, and `clear-store` exit non-zero when they leave a project pinned.

## Step 5: drop `propagateVersion` from builds

Remove `&& pnpm propagateVersion` from `build:withoutClean` in `core-ts-lib`, `core-ts-db-lib`,
`core-ts-api-lib`, `be-ts-lib`, `be-ts-db-lib`, and `local-npm-registry`. The `propagateVersion`
script stays for `prepareAllPackages` and `versionPropagation:validate`.

## Step 6: tests

Unit, against `LocalPackageGraphService` alone:

- Publish order for a known graph, plus dedupe of a diamond and the subscriber prune.
- A cycle throws, and a `devDependencies` edge does not create one.
- Two publishing paths for one name resolve by common ancestor, and a tie drops the edge.

Integration, with no addition to `TestProjectUtils`. `createTestPackage` already takes a dependencies
map, so a chain composes out of it and the commands the way `publishFromTwoDirectories` does, and a
helper is worth adding only once a second spec needs the same chain.

- `lib` → `midLib` → `consumer`: publishing `lib` re-publishes `midLib`, the consumer resolves
  exactly one copy of `lib`, and a second `lib` publish does not break its install.
- An unpinned range in `midLib`: the consumer never ends up with two versions of `lib`.
- A consumer subscribed to two packages of one cascade installs once, asserted by spying on
  `PackageManagerService.runInstallWithRegistry`.
- A subscriber of two packages installs once on `clear-store`, asserted the same way.
- A reset that fails makes the command reject.
- Two concurrent publishes on one shared subscriber leave a correct lockfile, through
  `ConcurrentTestProjectUtils`.

## Notes

- Every watch script is already `nodemon --ignore lib/ -e ts`, so the cascade's requirement that
  nothing watches package.json holds with no change.
