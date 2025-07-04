# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

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

[0.2.10]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.9...local-npm-registry-v0.2.10
[0.2.9]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.8...local-npm-registry-v0.2.9
[0.2.8]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.7...local-npm-registry-v0.2.8
[0.2.7]: https://github.com/aneuhold/ts-libs/compare/local-npm-registry-v0.2.6...local-npm-registry-v0.2.7
[0.2.6]: https://github.com/aneuhold/ts-libs/releases/tag/local-npm-registry-v0.2.6
