# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 🔖 [2.0.86] (2025-11-23)

### ✅ Added

### 🏗️ Changed

### 🩹 Fixed

### 🔥 Removed

## 🔖 [2.0.85] (2025-11-09)

### 🏗️ Changed

- Refactored all repository and validator files to use `import type` for type-only imports, improving build performance and clarity.
- Updated internal imports to separate type and value imports from `bson`, `mongodb`, and internal services.
- No breaking changes; all updates are internal refactors for TypeScript best practices.

## 🔖 [2.0.84] (2025-11-08)

### 🏗️ Changed

- Updated dependencies for compatibility and security improvements

## 🔖 [2.0.83] (2025-11-07)

### 🏗️ Changed

- Updated package.json: added `unpub:local` script for local unpublishing
- Removed unused `module` field from package.json

## 🔖 [2.0.82] (2025-11-06)

### 🏗️ Changed

- Marked package as side-effect free in package.json ("sideEffects": false) for improved tree-shaking.

## 🔖 [2.0.81] (2025-10-25)

### 🏗️ Changed

- Updated dependencies in package.json for compatibility and security improvements

## 🔖 [2.0.80] (2025-10-17)

### 🏗️ Changed

- Improved and expanded JSDoc comments and documentation for public types and methods throughout the package

## 🔖 [2.0.79] (2025-08-18)

### ✅ Added

- Added `DemoAccountsService` and `DashboardDemoAccountsService` for seeding demo accounts and demo data for dashboard users
- Utilities to create, reset, and seed demo users with example tasks, collaborators, and user configs
- Shared and non-shared demo task creation logic for onboarding/testing

## 🔖 [2.0.78] (2025-07-04)

### 🏗️ Changed

- Updated dependencies including @aneuhold/core-ts-lib and @aneuhold/main-scripts

## 🔖 [2.0.77] (2025-06-26)

### 🏗️ Changed

- Added directory field to repository configuration in package.json

## 🔖 [2.0.76] (2025-06-25)

### ✅ Added

- CHANGELOG.md file now included in published package

## 🔖 [2.0.75] (2025-06-19)

### 🏗️ Changed

- Updated dependencies: `@types/node` to ^22.15.32, `eslint` to ^9.29.0, `tsx` to ^4.20.3, `vitest` to ^3.2.4
- Updated package.json scripts and configurations

### 🩹 Fixed

- Fixed GitHub Actions deployment workflow authentication issues
- Added proper GitHub token configuration for git tag creation
- Updated workflow permissions to allow repository write access

<!-- Link References -->
[2.0.86]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.85...be-ts-db-lib-v2.0.86
[2.0.85]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.84...be-ts-db-lib-v2.0.85
[2.0.84]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.83...be-ts-db-lib-v2.0.84
[2.0.83]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.82...be-ts-db-lib-v2.0.83
[2.0.82]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.81...be-ts-db-lib-v2.0.82
[2.0.81]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.80...be-ts-db-lib-v2.0.81
[2.0.80]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.79...be-ts-db-lib-v2.0.80
[2.0.79]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.78...be-ts-db-lib-v2.0.79
[2.0.78]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.77...be-ts-db-lib-v2.0.78
[2.0.77]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.76...be-ts-db-lib-v2.0.77
[2.0.76]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.75...be-ts-db-lib-v2.0.76
[2.0.75]: https://github.com/aneuhold/ts-libs/releases/tag/be-ts-db-lib-v2.0.75
