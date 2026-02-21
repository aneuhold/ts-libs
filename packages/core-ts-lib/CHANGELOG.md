# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 🔖 [2.3.18] (2026-02-21)

### ✅ Added

### 🏗️ Changed

### 🩹 Fixed

### 🔥 Removed

## 🔖 [2.3.17] (2026-02-06)

### ✅ Added

- Added `check` script (`tsc --noEmit`) to validate TypeScript types locally and in CI.

### 🏗️ Changed

- Bumped package version to `2.3.17`.

## 🔖 [2.3.16] (2025-12-14)

### ✅ Added

- Added `DateService.reviveDatesRecursive()` to recursively revive dates in objects.

## 🔖 [2.3.15] (2025-12-14)

### 🏗️ Changed

- Updated dependencies for compatibility

## 🔖 [2.3.14] (2025-12-07)

### 🏗️ Changed

- Updated all type imports to use `import type` for improved clarity and build performance.
- Updated dependencies: now requires `prettier@^3.7.4`, `tsx@^4.21.0`, and `vitest@^4.0.15`.

## 🔖 [2.3.13] (2025-12-07)

### 🏗️ Changed

- Updated development dependencies: `@types/node`, `nodemon`, `prettier`, `rimraf`, and `vitest` for compatibility.
- Added support for `allowSlowTypes` in JSR publish validation and publishing methods.

## 🔖 [2.3.12] (2025-12-03)

### ✅ Added

- Added `DateService.dateReviver` for automatic ISO date string parsing in JSON responses.
- Added unit tests for `dateReviver` covering date parsing and edge cases.

### 🏗️ Changed

- Updated development dependencies: `@types/node`, `nodemon`, `prettier`, `rimraf`, and `vitest` for compatibility.

## 🔖 [2.3.11] (2025-11-23)

### ✅ Added

- Added `propagatePackageVersion` and `validatePackageDependents` utilities to `DependencyService` for automated version propagation and validation across workspace packages.
- Updated type definitions for `PackageJson` to include `scripts` property.

## 🔖 [2.3.10] (2025-11-09)

### 🏗️ Changed

- Refactored type-only imports in `src/browser.ts` to use proper `import type` and value imports, improving clarity and build performance.
- Updated exports in `src/browser.ts` to move `VersionType` from type to value export, ensuring correct usage in browser builds.

## 🔖 [2.3.9] (2025-11-09)

### 🏗️ Changed

- Refactored all service, type, and utility files to use `import type` for type-only imports, improving build performance and clarity.
- Updated internal imports to separate type and value imports from dependencies and internal modules.
- No breaking changes; all updates are internal refactors for TypeScript best practices.

## 🔖 [2.3.8] (2025-11-08)

### 🏗️ Changed

- Updated dependencies for compatibility and security improvements

## 🔖 [2.3.7] (2025-11-07)

### 🏗️ Changed

- Updated package.json: changed `main` and `types` fields to use browser entry points
- Removed unused `module` field from package.json

## 🔖 [2.3.6] (2025-11-06)

### ✅ Added

- New browser-safe bundle: added src/browser.ts and updated exports for browser/node compatibility.

### 🏗️ Changed

- Refactored exports in package.json for browser/node/default support.
- Marked package as side-effect free in package.json ("sideEffects": false).
- Refactored src/index.ts to re-export from browser.ts and separate Node-specific exports.

## 🔖 [2.3.5] (2025-11-02)

### ✅ Added

- New tests for `FileSystemService.getAllFilePaths` and `getAllFilePathsRelative` to verify handling of circular symlinks

### 🏗️ Changed

- Refactored `getAllFilePaths` to use `readdir` with `recursive` and `withFileTypes` for improved performance and reliability
- Updated logic to skip symlinks and prevent infinite loops when traversing directories

### 🩹 Fixed

- Fixed infinite loop issue when traversing directories with circular symlinks in `FileSystemService`

## 🔖 [2.3.4] (2025-10-25)

### 🏗️ Changed

- Updated dependencies in package.json for compatibility and security improvements

## 🔖 [2.3.3] (2025-10-16)

### 🏗️ Changed

- Added JSDoc comments to all public types in `src/types` for improved documentation and clarity
- Updated `JsonWithVersionProperty`, `PackageJson`, `PackageJsonInfo`, and `PackageJsonMap` interfaces with detailed descriptions

## 🔖 [2.3.2] (2025-07-04)

### ✅ Added

- New `hasChangesComparedToMain` method in `FileSystemService` to check if directory has changes compared to main branch
- New `getGitDiffCommand` private method in `FileSystemService` to determine appropriate git diff command

### 🏗️ Changed

- Updated `PackageServiceUtils.bumpVersionAndInitializeChangelog` to check for changes before version bumping
- Package version bump now skips if no changes are detected compared to main branch

## 🔖 [2.2.14] (2025-06-26)

### 🏗️ Changed

- Added directory field to repository configuration in package.json

## 🔖 [2.2.13] (2025-06-25)

### ✅ Added

- CHANGELOG.md file now included in published package
- New `getChangelogContentForVersion` method in ChangelogService for extracting changelog content for releases

## 🔖 [2.2.12] (2025-06-19)

### ✅ Added

- New `ChangelogService` with comprehensive changelog management functionality
- Added `ChangelogFileService` for file operations and validation
- Added `ChangelogGenerator` for generating changelog entries
- Added `ChangelogParser` for parsing existing changelogs
- Added `ChangelogValidator` for validating changelog structure
- Added `GitTagService` for Git tag operations
- Added `RepositoryInfoService` for repository information
- New `DependencyService` for dependency management operations
- New `StringService` with utility string functions
- New `VersionType` enum for semantic version types
- Added `bumpVersionAndInitializeChangelog.ts` script for automated version management

### 🏗️ Changed

- Refactored `PackageService` with improved utilities and structure
- Updated dependencies: `@types/node` to ^22.15.32, `eslint` to ^9.29.0, `tsx` to ^4.20.3, `vitest` to ^3.2.4

### 🩹 Fixed

- Fixed GitHub Actions deployment workflow authentication issues
- Added proper GitHub token configuration for git tag creation
- Updated workflow permissions to allow repository write access

<!-- Link References -->
[2.3.18]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.17...core-ts-lib-v2.3.18
[2.3.17]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.16...core-ts-lib-v2.3.17
[2.3.16]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.15...core-ts-lib-v2.3.16
[2.3.15]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.14...core-ts-lib-v2.3.15
[2.3.14]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.13...core-ts-lib-v2.3.14
[2.3.13]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.12...core-ts-lib-v2.3.13
[2.3.12]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.11...core-ts-lib-v2.3.12
[2.3.11]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.10...core-ts-lib-v2.3.11
[2.3.10]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.9...core-ts-lib-v2.3.10
[2.3.9]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.8...core-ts-lib-v2.3.9
[2.3.8]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.7...core-ts-lib-v2.3.8
[2.3.7]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.6...core-ts-lib-v2.3.7
[2.3.6]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.5...core-ts-lib-v2.3.6
[2.3.5]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.4...core-ts-lib-v2.3.5
[2.3.4]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.3...core-ts-lib-v2.3.4
[2.3.3]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.3.2...core-ts-lib-v2.3.3
[2.3.2]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.2.14...core-ts-lib-v2.3.2
[2.2.14]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.2.13...core-ts-lib-v2.2.14
[2.2.13]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.2.12...core-ts-lib-v2.2.13
[2.2.12]: https://github.com/aneuhold/ts-libs/releases/tag/core-ts-lib-v2.2.12
