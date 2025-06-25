# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 🔖 [2.2.13] (2025-06-25)

### ✅ Added

### 🏗️ Changed

### 🩹 Fixed

### 🔥 Removed

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
[2.2.13]: https://github.com/aneuhold/ts-libs/compare/core-ts-lib-v2.2.12...core-ts-lib-v2.2.13
[2.2.12]: https://github.com/aneuhold/ts-libs/releases/tag/core-ts-lib-v2.2.12
