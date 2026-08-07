# Part 2: per path publish and subscribe

Part 2 of three, on top of
[part 1](./local-npm-registry-package-paths-1-store-and-locks.md).
[The overview](./local-npm-registry-package-paths-plan.md) carries the design and the reasoning
behind the key, the slug, and the store shape.

This is the part that makes two checkouts of one package work at the same time. A published version
carries the slug of the directory it came from, each directory gets its own dist tag, retention
happens per path instead of by deleting the whole package, and a consumer states which directory it
is subscribing to.

Everything happens inside `packages/local-npm-registry`.

## Step 1: the version format

**`src/services/CommandUtil.service.ts`**

`generateTimestampVersion(originalVersion, pathSlug)` produces `<original>-<slug>.<timestamp>`, for
example `2.4.6-pa1b2c3d4.20250726123456789`, replacing any existing suffix matching
`timestampPattern`.

Valid semver: prerelease identifiers are dot-separated alphanumerics and hyphens, and the numeric
timestamp has no leading zero. The slug is fixed width, so versions stay short however deep the
directory sits. Ordering between paths does not matter, because subscribers pin exact versions.

## Step 2: the publish path

**`src/services/CommandUtil.service.ts`**

- `publishAndUpdateSubscribers` takes the resolved `packagePath` and, in order: derives the slug,
  writes the timestamped version into `package.json`, publishes, writes the entry, updates only that
  path's subscribers, prunes that path's older versions, restores the original version.
- The prune lists the package's versions from the registry and removes every one carrying this path's
  slug except the one just published. Nothing has to be stored for this: the slug inside a version
  already says which path published it, and reading the registry means a version whose earlier
  removal failed is found and retried rather than leaking. Pruning sits here so both `publish` and
  `subscribe` get it, and it runs before the caller stops the server because it needs the server.
  Problem 3 later moves this prune to the end of a cascade.
- Drop a subscriber whose directory no longer exists instead of logging it. The loop already visits
  every subscriber and already swallows the failure
  ([`:102`](../packages/local-npm-registry/src/services/CommandUtil.service.ts#L102)), so the record
  otherwise survives every future publish. Key this on the directory being missing, not on the update
  failing, so a transient install error cannot silently unsubscribe a live consumer.

## Step 3: registry retention

**`src/services/Verdaccio.service.ts`**

- `publishPackage(packagePath, additionalPublishArgs, distTag)`, with `#buildPublishArgs` emitting
  `--tag <distTag>`; callers pass `local-<slug>` instead of the shared `local`. Passing the tag in
  keeps this service from having to know about the store.
- Delete the `#clearPublishedPackagesLocally` call from `publishPackage`, so one directory cannot
  destroy the version the other directory's consumer is pinned to.
- New `listPublishedVersions(packageName)`: the versions the registry currently holds for a package,
  empty when it holds none. Every caller that needs one path's versions filters this on that path's
  slug, which is what keeps retention per path without the store tracking it.
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

**`src/commands/UnpublishCommand.ts`**

`unpublishPackage` is gone, so the command starts Verdaccio, calls `unpublishVersions` with the
versions `listPublishedVersions` reports that carry its target's slug, then stops it. Removal now
goes through the server
rather than the filesystem, so `unpublish` requires a running Verdaccio from here on. Part 3 adds the
target resolution on top of this.

## Step 4: subscribe binding

**`src/commands/SubscribeCommand.ts`**

- `execute(packageName, packagePath?)`. With a path, resolve it and require it to be a publishing
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

**`src/services/Command.service.ts`** and **`src/index.ts`**: thread the path through `subscribe`,
and register `subscribe <package-name> [--path <path>]`.

## Step 5: tests

**`test-utils/TestProjectUtils.ts`**

- `createTestPackage` takes an optional directory name; two checkouts of one package name currently
  collide on a directory derived from the name.
- A helper that creates a second checkout of an existing test package and publishes from it.

**`src/commands/PublishCommand.spec.ts`** and **`SubscribeCommand.spec.ts`**: two checkouts of one
package with two consumers: each consumer resolves its own build, publishing from one checkout leaves
the other's version installed and resolvable, and subscribing with two candidate paths and no
`--path` fails and lists them. Separately, that a publish drops a subscriber whose directory is gone
but keeps one whose install merely failed.

**`src/services/Verdaccio.service.spec.ts`**: the new version pattern, the per path dist tag, and
`unpublishVersions` removing one version while leaving the other path's version resolvable.

## Step 6: documentation

**`packages/local-npm-registry/README.md`**

- Describe per path versions and dist tags in the technical details.
- Correct the note grouping `unpublish` with `unsubscribe` as commands that do not require Verdaccio
  running. `unsubscribe` does not; `unpublish` does, because removal goes through the server.

## Validation

From `packages/local-npm-registry`:

```bash
pnpm check
pnpm lint
pnpm test
```

The suite runs serially (`fileParallelism: false`) and starts a real Verdaccio, so the two-checkout
tests should reuse the existing per-test temp instance rather than spawning parallel vitest workers.

Run `/changelog` before merging so `CHANGELOG.md` picks the branch up.

## What this part leaves

- `unpublish` still acts on one path chosen by the interim sole-path rule, with no `--path` or
  `--all-paths`. Part 3.
- Nothing walks a publishing directory that no longer exists, so its consumers stay pinned to versions
  that can never resolve. Part 3 adds `prune`.
