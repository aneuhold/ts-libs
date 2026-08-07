# Part 3: path aware sweeps and prune

Part 3 of three, on top of
[part 2](./local-npm-registry-package-paths-2-publish-and-subscribe.md).
[The overview](./local-npm-registry-package-paths-plan.md) carries the design and the reasoning
behind the key, the slug, and the store shape.

Everything that has to act across publishing paths rather than on one: choosing what `unpublish`
targets, reconciling the store with what is actually on disk, and the CLI surface for both.

Everything happens inside `packages/local-npm-registry`.

## Step 1: path aware unpublish

**`src/commands/UnpublishCommand.ts`**

`execute(packageName?, options?)` with `packageRootPath` and `allPaths`. Target resolution:
`allPaths` wins, then an explicit path, then the current directory if it publishes that package, then
the sole path, otherwise throw listing them. This replaces the interim sole-path rule from part 1.

Per target: reset its subscribers, start Verdaccio, `unpublishVersions` every version
`listPublishedVersions` reports that carries the target's slug, stop, `removePackageRoot`. Restore
the package's own `package.json` version only when the current directory is the target.

## Step 2: prune

**`src/commands/PruneCommand.ts`** (new): for every package root path that no longer exists, restore
each live subscriber's `originalSpecifier`, unpublish the versions carrying that path's slug, and
remove the entry. The path is gone but the store still holds it as a key, so its slug is still
derivable. Group restores by subscriber path, one install per consumer.

Dead subscriber records are handled during publish, so this is only about dead publishing paths, and
it stays an explicit command for two reasons. Nothing else walks every path: publish runs from `cwd`,
which by definition exists, so a deleted checkout is never visited again and leaves its consumers
pinned to versions that can never resolve. And the repair rewrites consumer `package.json` files,
runs installs, and removes versions from the registry, which is too consequential to fire as a side
effect of an unrelated command.

`prune` is the reconciliation command the journal work in problem 1 of
[the hardening doc](./local-npm-registry-hardening.md#problem-1-a-killed-publish-leaves-its-mutations-behind)
later extends, since a dead `pid` and a dead directory are the same kind of fact.

## Step 3: command surface

**`src/services/Command.service.ts`**: add `prune`, and thread the new arguments through `unpublish`.

**`src/index.ts`**

- `unpublish [package-name] [--path <path>] [--all-paths]`
- `prune`, described as reconciling the store with what is actually on disk

## Step 4: tests

**New `src/commands/PruneCommand.spec.ts`**: a deleted publishing directory with a live subscriber:
the specifier is restored, the entry is dropped, a surviving path is untouched.

**`src/commands/UnpublishCommand.spec.ts`**: two publishing paths for one package, where `--path`
removes one and leaves the other's consumer resolvable, `--all-paths` removes both, and no argument
from a directory that does not publish the package throws listing the candidates.

## Step 5: documentation

**`packages/local-npm-registry/README.md`**: document `--path`, `--all-paths`, and `prune`.

## Validation

From `packages/local-npm-registry`:

```bash
pnpm check
pnpm lint
pnpm test
```

The suite runs serially (`fileParallelism: false`) and starts a real Verdaccio, so the multi-path
tests should reuse the existing per-test temp instance rather than spawning parallel vitest workers.

Run `/changelog` before merging so `CHANGELOG.md` picks the branch up.

## Trade-off

**`unpublish` and `prune` require a running Verdaccio.** Per version removal is what the design needs
and what the server already implements, but it makes both slower than a file delete and makes them
contend for the Verdaccio lock. Visible change for anyone used to `unpublish` working with the server
down.
