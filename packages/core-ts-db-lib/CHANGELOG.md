# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 🔖 [4.0.3] (2025-12-14)

### 🏗️ Changed
- Updated dependencies for compatibility


## 🔖 [4.0.2] (2025-12-13)

### 🏗️ Changed

- Updated all dashboard filter, sort, and tag schemas to use `z.partialRecord` for improved type safety and flexibility.
- Improved documentation for dashboard user config and embedded types.

### 🩹 Fixed

- Fixed dashboard schemas to ensure correct default values and prevent undefined errors for tags and filter settings.

## 🔖 [4.0.1] (2025-12-08)

### 🏗️ Changed

- Updated all dashboard filter, sort, and recurrence schemas to use Zod defaults for improved type safety and usability.
- Refactored `NonogramKatanaUpgradeSchema` to use `NonogramKatanaItemNameSchema` for `currentItemAmounts` for better schema consistency.
- Added missing schema exports to `src/browser.ts` for dashboard and embedded types.
- Improved type and schema imports/exports in `src/browser.ts` for maintainability.

### 🩹 Fixed

- Fixed default values in dashboard filter settings schemas to ensure correct behavior for completed and grandChildrenTasks fields.
- Fixed dashboard filter settings to default tags to an empty object, preventing undefined errors.

## 🔖 [4.0.0] (2025-12-07)

### ✅ Added

- Added Zod-based schemas for all document, embedded, and type files.
- Added new and updated tests for all document and service logic using Zod schemas.

### 🏗️ Changed

- _Breaking Change:_ Migrated all document, type, and service code from legacy validation and type-guards to Zod schemas.
- _Breaking Change:_ All type-only imports now use `import type` for clarity and build performance.
- Refactored all document, embedded, and service files to use new Zod-based validation and schemas.
- Updated dependencies: now requires `@aneuhold/core-ts-lib@^2.3.13`, `zod@^4.1.13`, and `@aneuhold/local-npm-registry@^0.2.20`.
- Updated dev dependencies for compatibility: `prettier`, `tsx`, and `vitest`.
- Improved test coverage for all document and embedded types.

### 🩹 Fixed

- Fixed issues with partial updates and field validation in document schemas.
- Fixed bugs in document creation and migration logic for dashboard-related entities.

### 🔥 Removed

- _Breaking Change:_ Removed all legacy validation utilities, type-guards, and helper files in favor of Zod schemas.
- Removed unused files and legacy test utilities.

## 🔖 [3.0.3] (2025-12-07)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-lib@^2.3.13` and `@aneuhold/local-npm-registry@^0.2.20`.

## 🔖 [3.0.2] (2025-12-03)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-lib@^2.3.12`, `zod@^4.1.13`, and `@aneuhold/local-npm-registry@^0.2.19`.
- Development dependencies updated for compatibility: `@types/node`, `prettier`, `rimraf`, and `vitest`.
- `DocumentService.deepCopy` now uses `structuredClone` instead of BSON EJSON for deep copying objects.

## 🔖 [3.0.1] (2025-11-26)

### 🏗️ Changed

- Refactored all dashboard task, filter, and sort types and services to use `UUID` instead of `string` for user and document IDs.
- Updated dependency: now requires `@aneuhold/local-npm-registry@^0.2.18`.

## 🔖 [3.0.0] (2025-11-23)

### 🏗️ Changed

_Breaking Change:_ Migrated all document, type, and service code from using `ObjectId` (from `bson`) to native `UUID` (from `crypto`), including all type signatures, constructors, and internal logic.
_Breaking Change:_ Updated all references, tests, and utility functions to use `UUID` instead of `ObjectId`.
Added `uuid` and `zod` as dependencies.
Updated build scripts and exports for compatibility.
Updated dependency: now requires `@aneuhold/core-ts-lib@^2.3.11`.

## 🔖 [2.0.90] (2025-11-09)

### 🏗️ Changed

- Refactored type-only imports in `src/browser.ts` to use proper `import type` and value imports, improving clarity and build performance.
- Updated exports in `src/browser.ts` to separate type and value exports for Recurrence types.

## 🔖 [2.0.89] (2025-11-09)

### 🏗️ Changed

- Refactored all document, service, and type files to use `import type` for type-only imports, improving build performance and clarity.
- Updated internal imports to separate type and value imports from dependencies and internal modules.
- No breaking changes; all updates are internal refactors for TypeScript best practices.

## 🔖 [2.0.88] (2025-11-08)

### 🏗️ Changed

- Updated dependencies for compatibility and security improvements

## 🔖 [2.0.87] (2025-11-07)

### 🏗️ Changed

- Updated package.json: added `unpub:local` script for local unpublishing
- Changed `main` and `types` fields to use browser entry points
- Removed unused `module` field from package.json

## 🔖 [2.0.86] (2025-11-06)

### ✅ Added

- New browser-safe bundle: added src/browser.ts and updated exports for browser/node compatibility.

### 🏗️ Changed

- Refactored exports in package.json for browser/node/default support.
- Marked package as side-effect free in package.json ("sideEffects": false).
- Refactored src/index.ts to re-export from browser.ts.

## 🔖 [2.0.85] (2025-10-25)

### 🏗️ Changed

- Updated dependencies in package.json for compatibility and security improvements

## 🔖 [2.0.84] (2025-10-17)

### 🏗️ Changed

- Improved and expanded JSDoc comments and documentation for public types and methods throughout the package

## 🔖 [2.0.83] (2025-07-04)

### 🏗️ Changed

- Updated dependencies including @aneuhold/core-ts-lib and @aneuhold/main-scripts

## 🔖 [2.0.82] (2025-06-26)

### 🏗️ Changed

- Added directory field to repository configuration in package.json

## 🔖 [2.0.81] (2025-06-25)

### ✅ Added

- CHANGELOG.md file now included in published package

## 🔖 [2.0.80] (2025-06-19)

### 🏗️ Changed

- Updated dependencies: `@types/node` to ^22.15.32, `eslint` to ^9.29.0, `tsx` to ^4.20.3, `vitest` to ^3.2.4
- Updated package.json scripts and configurations

### 🩹 Fixed

- Fixed GitHub Actions deployment workflow authentication issues
- Added proper GitHub token configuration for git tag creation
- Updated workflow permissions to allow repository write access

<!-- Link References -->
[4.0.3]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.0.2...core-ts-db-lib-v4.0.3
[4.0.2]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.0.1...core-ts-db-lib-v4.0.2
[4.0.1]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.0.0...core-ts-db-lib-v4.0.1
[4.0.0]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v3.0.3...core-ts-db-lib-v4.0.0
[3.0.3]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v3.0.2...core-ts-db-lib-v3.0.3
[3.0.2]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v3.0.1...core-ts-db-lib-v3.0.2
[3.0.1]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v3.0.0...core-ts-db-lib-v3.0.1
[3.0.0]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.90...core-ts-db-lib-v3.0.0
[2.0.90]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.89...core-ts-db-lib-v2.0.90
[2.0.89]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.88...core-ts-db-lib-v2.0.89
[2.0.88]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.87...core-ts-db-lib-v2.0.88
[2.0.87]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.86...core-ts-db-lib-v2.0.87
[2.0.86]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.85...core-ts-db-lib-v2.0.86
[2.0.85]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.84...core-ts-db-lib-v2.0.85
[2.0.84]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.83...core-ts-db-lib-v2.0.84
[2.0.83]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.82...core-ts-db-lib-v2.0.83
[2.0.82]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.81...core-ts-db-lib-v2.0.82
[2.0.81]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v2.0.80...core-ts-db-lib-v2.0.81
[2.0.80]: https://github.com/aneuhold/ts-libs/releases/tag/core-ts-db-lib-v2.0.80
