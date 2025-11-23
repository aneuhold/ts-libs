# Local Development Tooling

This document explains the local development process for the `ts-libs` monorepo, detailing how to work with packages, handle dependencies, and prepare releases.

## Watch Mode & Live Development

The primary way to develop in this monorepo is using the root `watch` script.

### Root `watch` Script

Command: `pnpm watch`

This script executes `scripts/watchAll.ts`. Its function is to:

1.  Scan all directories in `packages/`.
2.  Identify packages that have a `watch` script defined in their `package.json`.
3.  Run all these package-level `watch` scripts in parallel using `concurrently`.

This allows you to work on multiple packages simultaneously (e.g., a library and a consumer) and have changes propagate instantly.

### Package-Level `watch`

Command: `pnpm --filter <package> watch`

Each package's `watch` script typically does the following:

1.  **Monitor Files**: Uses `nodemon` to watch for changes in source files (ignoring output directories like `lib/`).
2.  **Rebuild**: Runs `tsc` (TypeScript Compiler) and `copyTsFiles.ts` to build the project.
3.  **Publish Locally**: Runs `local-npm publish`.

### `local-npm` Registry

The `local-npm` tool is used to simulate an NPM registry locally.

- When a package is built in watch mode, it is "published" to this local registry.
- Other packages in the monorepo (or external projects configured to use `local-npm`) can then consume these "published" versions immediately without waiting for a real NPM release.

## Dependency Management

The monorepo uses **pnpm workspaces** to manage dependencies efficiently.

- **`pnpm-workspace.yaml`**: Defines the workspace structure (all folders in `packages/*`).
- **Symlinks**: `pnpm` automatically creates symlinks for dependencies that exist within the workspace.
  - If `Package A` depends on `Package B`, and both are in the workspace, `node_modules` in `Package A` will link directly to the local `Package B`.
- **`preferWorkspacePackages: true`**: This setting in `pnpm-workspace.yaml` ensures that if a package version exists locally, it is used instead of downloading it from the remote registry.

## Preparing for Release (`preparePkg`)

Before submitting a Pull Request, you should prepare your package for release.

Command: `pnpm preparePkg` (or `pnpm --filter <package> preparePkg`)

This command runs `tb pkg prepare` (from `@aneuhold/main-scripts`), which automates several tasks:

1.  **Change Detection**: Checks if there are actual file changes compared to the `main` branch.
1.  **Version Check**: Checks the NPM registry to see if the current version in `package.json` is already published.
1.  **Auto-Bump**: If changes are detected and the version conflicts (or if requested), it automatically bumps the version (default is `patch`).
1.  **Changelog**: It initializes or updates the `CHANGELOG.md` file, ensuring there is a section for the new version.
1.  **Version Propagation**: The version is propagated to consumers of the library within the mono-repo if necessary.
