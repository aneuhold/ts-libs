# Part 3: path aware sweeps and prune

Part 3 of three, on top of
[part 2](./local-npm-registry-package-paths-2-publish-and-subscribe.md).
[The overview](./local-npm-registry-package-paths-plan.md) carries the design and the reasoning
behind the key, the slug, and the store shape.

Everything that has to act across publishing paths rather than on one: choosing what `unpublish`
targets, reconciling the store with what is actually on disk, reusing that reconciliation from
`clear-store`, and the CLI surface for it all.

Everything happens inside `packages/local-npm-registry`.

## Step 1: path aware unpublish

**`src/commands/UnpublishCommand.ts`**

`execute(packageName?, options?)` with `packagePath` and `allPaths`. Target resolution:
`allPaths` wins, then an explicit path, then the current directory if it publishes that package, then
the sole path, otherwise throw listing them. This replaces the interim sole-path rule from part 1.

Per target: reset its subscribers, start Verdaccio, `unpublishVersions` every version
`listPublishedVersions` reports that carries the target's slug, stop, `removePackagePath`. Restore
the package's own `package.json` version only when the current directory is the target.

## Step 2: prune, and the sweep that reuses it

**`src/commands/PruneCommand.ts`** (new): for every package path that no longer exists, restore
each live subscriber's `originalSpecifier`, unpublish the versions carrying that path's slug, and
remove the entry. The path is gone but the store still holds it as a key, so its slug is still
derivable.

Restoring subscribers is not particular to prune. `clear-store` does the same thing to every entry
rather than only the dead ones, so collecting the subscribers of a set of entries, restoring each
specifier, and running one install per consumer moves to **`src/services/CommandUtil.service.ts`**
with the `SubscriberReset` shape beside it. Prune calls it for the dead paths and `clear-store` for
the rest, which is also where the grouping that the `clear-store` bullet in problem 2 of
[the hardening doc](./local-npm-registry-hardening.md#problem-2-multiple-subscriptions-in-one-consumer)
asks for ends up living, once rather than copied into both.

**`src/commands/ClearStoreCommand.ts`** then prunes before it sweeps, so every path it walks is one
that still exists and the dead path repair has a single implementation. Handing the walk off leaves
the command smaller three ways: the nested package, path, subscriber loop that builds
`resetsBySubscriber` goes with the helper; `clearStore` and `writeStore` run once at the end rather
than there and again in the no-subscribers early return, which drops the duplicated success log with
it; and `Promise.allSettled` becomes `Promise.all`, since each reset already catches its own failure
and returns a boolean, so nothing in that array can reject.

Dead subscriber records are handled during publish, so this is only about dead publishing paths, and
prune stays a command of its own. Nothing else walks every path: publish runs from `cwd`, which by
definition exists, so a deleted checkout is never visited again and leaves its consumers pinned to
versions that can never resolve. `clear-store` is the one caller that gets to invoke it without being
asked, because a command already committed to discarding the whole store is committed to rewriting
consumer `package.json` files and running installs anyway. Anywhere else that repair is too
consequential to fire as a side effect.

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

**`src/commands/ClearStoreCommand.spec.ts`**: a store holding one dead publishing path and one live
one, where the dead path's consumer is restored by the prune and the live path's consumer by the
sweep, and both end up with a single install.

**`src/commands/UnpublishCommand.spec.ts`**: two publishing paths for one package, where `--path`
removes one and leaves the other's consumer resolvable, `--all-paths` removes both, and no argument
from a directory that does not publish the package throws listing the candidates.

## Step 5: documentation

**`packages/local-npm-registry/README.md`**: document `--path`, `--all-paths`, and `prune`, and note
that `clear-store` prunes first.

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

**`unpublish`, `prune`, and with it `clear-store` require a running Verdaccio.** Per version removal
is what the design needs and what the server already implements, but it makes them slower than a file
delete and makes them contend for the Verdaccio lock. `clear-store` inherits the requirement by
pruning first, so a command that touches nothing but the store file today starts needing the server
up, and skipping the prune while it is down would strand the dead paths' versions in the registry
with nothing left in the store pointing at them. Visible change for anyone used to `unpublish` or
`clear-store` working with the server down.
