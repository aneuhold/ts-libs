# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 🔖 [0.2.20] (2025-12-07)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-lib@^2.3.13`.

## 🔖 [0.2.19] (2025-12-03)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-lib@^2.3.12`, `js-yaml@^4.1.1`, and `verdaccio@^6.2.3`.
- Development dependencies updated for compatibility: `@types/node`, `prettier`, `rimraf`, and `vitest`.

## 🔖 [0.2.18] (2025-11-26)

### 🏗️ Changed

- Updated type-only import for `PackageJson` in test files for improved clarity and build performance.
- Updated dependency: now requires `@aneuhold/core-ts-lib@^2.3.11`.

## 🔖 [0.2.17] (2025-11-23)

### 🏗️ Changed

Updated dependency: now requires `@aneuhold/core-ts-lib@^2.3.11`.
Updated build scripts to use new version propagation and build flow.
No direct code changes; version bump for compatibility.

## 🔖 [0.2.16] (2025-11-09)

### 🏗️ Changed

- Refactored all service and utility files to use `import type` for type-only imports, improving build performance and clarity.
- Updated internal imports to separate type and value imports from dependencies and internal modules.
- No breaking changes; all updates are internal refactors for TypeScript best practices.

## 🔖 [0.2.15] (2025-11-08)

### 🏗️ Changed

- Updated dependencies for compatibility and security improvements

## 🔖 [0.2.14] (2025-10-25)

### 🏗️ Changed

- Updated dependencies in package.json for compatibility and security improvements
- Updated test configuration: switched to serial test execution and improved Verdaccio logging config

## 🔖 [0.2.13] (2025-10-17)

### 🏗️ Changed

- Improved and expanded JSDoc comments and documentation for public types and methods throughout the package

## 🔖 [0.2.12] (2025-09-01)

### ✅ Added

- Added a project image to the README for improved documentation and visual identity.

## 🔖 [0.2.11] (2025-07-12)

### ✅ Added

- Added comment header "# Created by local-npm-registry" to generated configuration files
- Added `isConfigGenerated()` method to detect files created by local-npm-registry

### 🏗️ Changed

- Enhanced registry configuration restoration to properly handle generated files
- Improved test coverage for generated configuration file handling

### 🩹 Fixed

- Fixed bug where generated configuration files were not properly identified during restoration
- Fixed restoration process to correctly remove generated files when original didn't exist

## 🔖 [0.2.10] (2025-07-04)

### 🩹 Fixed

- Fixed missing option for execa to address the original `PackageManagerService.install()` problem in version 0.2.9.

## 🔖 [0.2.9] (2025-07-04)

### 🩹 Fixed

- Fixed environment variable interference in `PackageManagerService.install()` by cleaning npm*config* variables

## 🔖 [0.2.8] (2025-06-26)

### 🏗️ Changed

- Added directory field to repository configuration in package.json

## 🔖 [0.2.7] (2025-06-25)

### ✅ Added

- CHANGELOG.md file now included in published package

## 🔖 [0.2.6] (2025-06-19)

### 🏗️ Changed

- Updated dependencies: `@types/node` to ^22.15.32, `eslint` to ^9.29.0, `tsx` to ^4.20.3, `vitest` to ^3.2.4
- Updated package.json scripts and configurations

### 🩹 Fixed

- Fixed GitHub Actions deployment workflow authentication issues
- Added proper GitHub token configuration for git tag creation
- Updated workflow permissions to allow repository write access

<!-- Link References -->

[0.2.20]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.19...local-npm-registry-v0.2.20
[0.2.19]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.18...local-npm-registry-v0.2.19
[0.2.18]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.17...local-npm-registry-v0.2.18
[0.2.17]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.16...local-npm-registry-v0.2.17
[0.2.16]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.15...local-npm-registry-v0.2.16
[0.2.15]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.14...local-npm-registry-v0.2.15
[0.2.14]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.13...local-npm-registry-v0.2.14
[0.2.13]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.12...local-npm-registry-v0.2.13
[0.2.12]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.11...local-npm-registry-v0.2.12
[0.2.11]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.10...local-npm-registry-v0.2.11
[0.2.10]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.9...local-npm-registry-v0.2.10
[0.2.9]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.8...local-npm-registry-v0.2.9
[0.2.8]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.7...local-npm-registry-v0.2.8
[0.2.7]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.6...local-npm-registry-v0.2.7
[0.2.6]: https://github.com/aneuhold/ts-libs/releases/tag/local-npm-registry-v0.2.6
