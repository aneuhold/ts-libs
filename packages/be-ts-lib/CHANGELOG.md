# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 🔖 [3.0.10] (2026-02-06)

### ✅ Added

- Added `check` script (`tsc --noEmit`) to run TypeScript checks locally and in CI.

### 🏗️ Changed

- Bumped package version to `3.0.10` and updated dev scripts for type checking.

## 🔖 [3.0.9] (2025-12-21)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/core-ts-api-lib@^3.0.9`.

## 🔖 [3.0.8] (2025-12-14)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-api-lib@^3.0.8`, `@aneuhold/core-ts-lib@^2.3.16`, and `@aneuhold/local-npm-registry@^0.2.23`.

## 🔖 [3.0.7] (2025-12-14)

### 🏗️ Changed

- Updated dependencies for compatibility

## 🔖 [3.0.6] (2025-12-13)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/core-ts-api-lib@^3.0.6` for latest schema and validation improvements.

## 🔖 [3.0.5] (2025-12-08)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/core-ts-api-lib@^3.0.5` for latest schema and validation improvements.

## 🔖 [3.0.4] (2025-12-07)

### 🏗️ Changed

- Updated all type imports to use `import type` for improved clarity and build performance.
- Updated dependencies: now requires `@aneuhold/core-ts-api-lib@^3.0.3`, `@aneuhold/core-ts-lib@^2.3.13`, and `@aneuhold/local-npm-registry@^0.2.20`.
- Updated dev dependencies for compatibility: `prettier`, `tsx`, and `vitest`.

## 🔖 [3.0.3] (2025-12-07)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-api-lib@^3.0.3`, `@aneuhold/core-ts-lib@^2.3.13`, and `@aneuhold/local-npm-registry@^0.2.20`.

## 🔖 [3.0.2] (2025-12-03)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-api-lib@^3.0.2`, `@aneuhold/core-ts-lib@^2.3.12`, and `@aneuhold/local-npm-registry@^0.2.19`.
- Development dependencies updated for compatibility: `@types/node`, `prettier`, `rimraf`, and `vitest`.

## 🔖 [3.0.1] (2025-11-26)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/core-ts-api-lib@^3.0.1` and `@aneuhold/local-npm-registry@^0.2.18`.

## 🔖 [3.0.0] (2025-11-23)

### 🏗️ Changed

_Breaking Change:_ Updated peer and direct dependencies to require `@aneuhold/core-ts-api-lib@^3.0.0` and `@aneuhold/core-ts-lib@^2.3.11`.
Updated build scripts to use new version propagation and build flow.
No direct code changes; version bump for compatibility with new major versions of dependencies.

## 🔖 [2.0.91] (2025-11-09)

### 🏗️ Changed

- Refactored all service and utility files to use `import type` for type-only imports, improving build performance and clarity.
- Updated internal imports to separate type and value imports from dependencies and internal modules.
- No breaking changes; all updates are internal refactors for TypeScript best practices.

## 🔖 [2.0.90] (2025-11-08)

### 🏗️ Changed

- Updated dependencies for compatibility and security improvements

## 🔖 [2.0.89] (2025-11-07)

### 🏗️ Changed

- Updated package.json: added `unpub:local` script for local unpublishing
- Removed unused `module` field from package.json

## 🔖 [2.0.88] (2025-11-06)

### 🏗️ Changed

- Marked package as having side effects in package.json ("sideEffects": true) and added explanatory comment.

## 🔖 [2.0.87] (2025-10-25)

### 🏗️ Changed

- Updated dependencies in package.json for compatibility and security improvements

## 🔖 [2.0.86] (2025-10-17)

### 🏗️ Changed

- Improved and expanded JSDoc comments and documentation for public types and methods throughout the package

## 🔖 [2.0.85] (2025-07-04)

### 🏗️ Changed

- Updated dependencies including @aneuhold/core-ts-lib and @aneuhold/main-scripts

## 🔖 [2.0.84] (2025-06-26)

### 🏗️ Changed

- Added directory field to repository configuration in package.json

## 🔖 [2.0.83] (2025-06-25)

### ✅ Added

- CHANGELOG.md file now included in published package

## 🔖 [2.0.82] (2025-06-19)

### 🏗️ Changed

- Updated dependencies: `@types/node` to ^22.15.32, `eslint` to ^9.29.0, `tsx` to ^4.20.3, `vitest` to ^3.2.4
- Updated package.json scripts and configurations

### 🩹 Fixed

- Fixed GitHub Actions deployment workflow authentication issues
- Added proper GitHub token configuration for git tag creation
- Updated workflow permissions to allow repository write access

<!-- Link References -->

[3.0.10]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v3.0.9...be-ts-lib-v3.0.10
[3.0.9]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v3.0.8...be-ts-lib-v3.0.9
[3.0.8]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v3.0.7...be-ts-lib-v3.0.8
[3.0.7]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v3.0.6...be-ts-lib-v3.0.7
[3.0.6]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v3.0.5...be-ts-lib-v3.0.6
[3.0.5]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v3.0.4...be-ts-lib-v3.0.5
[3.0.4]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v3.0.3...be-ts-lib-v3.0.4
[3.0.3]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v3.0.2...be-ts-lib-v3.0.3
[3.0.2]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v3.0.1...be-ts-lib-v3.0.2
[3.0.1]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v3.0.0...be-ts-lib-v3.0.1
[3.0.0]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v2.0.91...be-ts-lib-v3.0.0
[2.0.91]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v2.0.90...be-ts-lib-v2.0.91
[2.0.90]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v2.0.89...be-ts-lib-v2.0.90
[2.0.89]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v2.0.88...be-ts-lib-v2.0.89
[2.0.88]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v2.0.87...be-ts-lib-v2.0.88
[2.0.87]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v2.0.86...be-ts-lib-v2.0.87
[2.0.86]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v2.0.85...be-ts-lib-v2.0.86
[2.0.85]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v2.0.84...be-ts-lib-v2.0.85
[2.0.84]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v2.0.83...be-ts-lib-v2.0.84
[2.0.83]: https://github.com/aneuhold/ts-libs/compare/be-ts-lib-v2.0.82...be-ts-lib-v2.0.83
[2.0.82]: https://github.com/aneuhold/ts-libs/releases/tag/be-ts-lib-v2.0.82
