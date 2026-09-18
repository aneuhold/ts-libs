# pnpm 12 support

This plan has two parts:

- **local-npm-registry:** make its installs work in projects that use pnpm 12 (steps 1 to 4).
- **This monorepo:** move it to pnpm 12 (step 5).

## Problem

Every `local-npm` install into a pnpm 12 project fails. That covers most consumers already: `gcloud-backend`, `dashboard`, `workout`, `main-scripts`, and `robot-instructions` pin `pnpm@12.2.1`, and `portfolio` pins `12.4.1`.

pnpm 12 has a new CLI that accepts only the flags it defines. The npm-style config flags that `PACKAGE_MANAGER_INFO[PackageManager.Pnpm].getRegistryOverrideCliOptions` builds are rejected:

```txt
$ pnpm install --registry=http://localhost:4899/ --@lnrtest:registry=http://localhost:4899/ --//localhost:4899/:_authToken=fake
error: unexpected argument '--@lnrtest:registry' found
```

The auth token flag `--//<host>/:_authToken=fake` fails in the same way when used alone. `--registry=` is still accepted.

Sources: the commands above, run locally against pnpm 12.4.2. The [pnpm v12.1.0 release notes](https://github.com/pnpm/pnpm/releases/tag/v12.1.0) list the settings pnpm 12 accepts as CLI flags, and neither scoped registries nor auth tokens are on that list.

## Fix: the `--config.` prefix

pnpm 12 accepts the same keys when they are written as `--config.<key>=<value>`. I tested this against a scratch Verdaccio. The consumer's `.npmrc` sent the scope to a different registry (`@lnrtest:registry=https://npm.pkg.github.com/`), so an install could only succeed if the flag took priority over that file:

| pnpm version | `--config.@<scope>:registry=…` plus `--config.//<host>/:_authToken=fake` |
| --- | --- |
| 10.33.0 | Installs the local version |
| 11.21.0 | Installs the local version |
| 12.4.2 | Installs the local version |

One set of flags works for every pnpm version, so pnpm 12 does not need a version check or a new `PackageManager` enum value.

Nothing else in local-npm-registry needs to change. `PackageManagerService.#detectPackageManagerUncached` already matches `pnpm@12.x` through its `includes('pnpm')` check. The env vars that pnpm 12 injects into scripts (`pnpm_config_verify_deps_before_run`, `npm_config_user_agent`) have no effect on an install.

## Steps

### 1. Send the pnpm redirection flags with the `--config.` prefix

**File:** `packages/local-npm-registry/src/types/PackageManager.ts`

- In the `PackageManager.Pnpm` entry, keep `--registry=` as it is. Write the scoped registry flag as `--config.@<org>:registry=` and the auth token flag as `--config.//<host>/:_authToken=fake`.
- Replace the current comment ("pnpm accepts the npm style scoped flag directly, with no `--config.` prefix"), which is no longer true. The new comment should explain that pnpm 12 rejects flags it does not define, and that the `--config.` form works on pnpm 10 through 12 and takes priority over a project `.npmrc`.
- After this change, the npm and pnpm entries differ only in the flag prefix (`--` versus `--config.`). Move the shared argument building into one non-exported function in the same file that takes the prefix, and have both entries call it. This removes the duplicated `registryUrl.replace(/^https?:\/\//, '')` and the scope mapping. Name the function after the existing `getRegistryOverrideCliOptions` field, for example `getNpmrcRegistryOverrideCliOptions`.

### 2. Update the unit test for the pnpm flags

**File:** `packages/local-npm-registry/src/services/PackageManagerService/PackageManagerCli.service.spec.ts`

- The test `should pass the same flags for pnpm as for npm` no longer describes the behavior. Rename it (for example, `should pass pnpm scoped registry flags with the config prefix`) and expect `--config.@${organization}:registry=${registryUrl}` and the `--config.` form of the auth token argument.
- `authTokenArg` in `beforeAll` is the npm form. Build the pnpm form next to it instead of hard-coding it in the test.

### 3. Run the existing pnpm integration test on pnpm 12

**File:** `packages/local-npm-registry/test-utils/TestProjectUtils.ts`

- In `createTestPackage`, pin `packageManager: 'pnpm@12.4.1'` for `PackageManager.Pnpm`, the same way the Yarn and Yarn4 entries already pin their versions. This is the same version the repo moves to in step 5. It is also the newest 12.x release that is at least 7 days old, which matches the repo's `minimumReleaseAge`.
- With the pin in place, `PackageManager.service.spec.ts` › `runInstallWithRegistry` › `should successfully run install with pnpm` runs a real pnpm 12 install against Verdaccio, with a `.npmrc` that sends the scope to npmjs. That is the case that fails today, and the test did not catch it because the test projects never pinned a pnpm version.
- Trade-off: `should detect pnpm from pnpm-lock.yaml` would pass through the `packageManager` field rather than the lock file. The Yarn Classic detection test already works this way. After this change, no test covers the lock-file fallback for pnpm.

### 4. Document the release-age requirement for pnpm consumers

**File:** `packages/local-npm-registry/README.md`, in "2. Subscribe your frontend project to the library"

Every locally published version is seconds old when it is installed, so pnpm's `minimumReleaseAge` applies to it. I verified two outcomes against pnpm 12.4.2:

- **The consumer sets `minimumReleaseAge` explicitly.** Since [v12.3.0](https://github.com/pnpm/pnpm/releases/tag/v12.3.0), `minimumReleaseAgeStrict` defaults to `true` in this case, so the install fails with `1 version does not meet the minimumReleaseAge constraint`. pnpm 11 does not fail here.
- **The consumer relies on the built-in 1440-minute default.** On every install, pnpm (both 11 and 12) appends `@<scope>/<pkg>@<local version>` to `minimumReleaseAgeExclude` in the consumer's `pnpm-workspace.yaml`, adding one entry per publish. `gcloud-backend` and `dashboard` are in this group.

Listing the subscribed scope (for example `'@aneuhold/*'`) under `minimumReleaseAgeExclude` fixes both: the install succeeds, and the file stays unchanged. `workout` and `portfolio` already do this. Add a short note with that YAML snippet for pnpm consumers.

### 5. Upgrade the monorepo to pnpm 12

Follow the pattern of "Upgrade to pnpm 12 and migrate CI to pnpm/setup (#33)" in `main-scripts` and `gcloud-backend`.

- **`packageManager` fields:** change `pnpm@11.21.0` to `pnpm@12.4.1` in the root `package.json` and in all six `packages/*/package.json` files.
- **`pnpm-lock.yaml`:** run `pnpm install` and commit the result. pnpm 12 adds a YAML document to the top of the lockfile that records `packageManagerDependencies` (pnpm 12.4.1 and its per-platform `@pnpm/exe.*` binaries). I ran pnpm 12.4.1 against a copy of the current manifests and lockfile. That document was the only change, and the rest of the lockfile was already up to date.
- **`pnpm-workspace.yaml`:** no change. The same trial install reported no unrecognized settings (`ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`) and no ignored builds, because `allowBuilds` already lists `better-sqlite3` and `esbuild`.
- **`.github/actions/setup-node-pnpm/action.yml`:**
  - Replace the `pnpm/action-setup@v4` and `actions/setup-node@v4` steps with a single `pnpm/setup@v2` step that has `cache: true`. According to the [pnpm/setup README](https://github.com/pnpm/setup), that action reads the pnpm version from `packageManager`, installs Node.js LTS, and runs `pnpm install`, so the final "Install dependencies" step goes too.
  - Keep "Update NPM to latest" (needed for OIDC publishing) and the Yarn corepack step (needed by the local-npm-registry tests).
  - The `registry-url` input goes away with `actions/setup-node`. `main-scripts` made the same change and still publishes to npm over OIDC.
- **pnpm commands in scripts:** the commands used by the root scripts, the CI actions, and `scripts/*.ts` (`-r --stream`, `--parallel`, `--filter <pkg>...`, `update --latest`) all parse under pnpm 12.4.1.

### 6. Versions and changelogs

- Run `pnpm preparePkg` at the root. Step 5 changes every `package.json`, so this bumps the patch version of all six packages and propagates the new versions to their dependents.
- Generate the changelog entries with `/changelog`. The local-npm-registry entry is a Fixed item: installs into pnpm 12 projects no longer fail with `unexpected argument '--@<scope>:registry'`.

## Validation

At the repo root, with the global pnpm switching to 12.4.1 from `packageManager`:

- `pnpm install`, which should leave the lockfile unchanged after step 5
- `pnpm check`
- `pnpm lint`
- `pnpm test`. With step 3 in place, this includes a real pnpm 12 install.

Also check:

- The PR workflow run is the first real test of the `pnpm/setup@v2` composite action.
- The OIDC npm publish can only be checked on the main-branch run after merging.
- Manually, from a library checkout, run `local-npm publish` with `gcloud-backend` subscribed, and confirm that its install succeeds on pnpm 12.2.1.

## Open question

- **Step 4 or a code change.** Passing `--config.minimum-release-age-strict=false` on pnpm installs would avoid the failure on pnpm 12, but it brings back the behavior of appending entries to the consumer's `pnpm-workspace.yaml`. Passing `--config.minimum-release-age-exclude=…` would replace the project's own exclude list instead of adding to it. My recommendation is the README note, because it is the only option that leaves the consumer's release-age policy and its files untouched.
