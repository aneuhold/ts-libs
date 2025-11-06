# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 🔖 [2.2.5] (2025-11-04)

### 🏗️ Changed

- Switched `GCloudAPIService` to use BSON serialization for requests and responses
- Updated request and response `Content-Type` headers to `application/octet-stream`
- Added private `decodeResponse` helper for decoding API responses
- Improved error handling for non-BSON responses in `GCloudAPIService`

## 🔖 [2.2.5] (2025-11-04)

### ✅ Added

- New browser-safe bundle: added src/browser.ts and updated exports for browser/node compatibility.

### 🏗️ Changed

- Refactored exports in package.json for browser/node/default support.
- Marked package as side-effect free in package.json ("sideEffects": false).
- Refactored src/index.ts to re-export from browser.ts.

## 🔖 [2.2.1] (2025-09-08)

### ✅ Added

- Added new automation URL `lowLightsUpstairs` to `DashboardConfig.automationUrls` type.

## 🔖 [2.2.0] (2025-07-12)

### ✅ Added

- Added new `APIResponse<T>` generic type for standardized API responses
- Added `GCloudAPIService` for interacting with Google Cloud API endpoints
- Added `gcloudBackendUrl` field to `DashboardConfig` type

### 🏗️ Changed

- _Breaking Change:_ Replaced `DOFunctionCallOutput<T>` with `APIResponse<T>` throughout the codebase
- Updated `APIService.callDashboardAPI()` to use `GCloudAPIService` instead of `DOFunctionService`
- Updated `APIService.setDashboardAPIUrl()` to set URL on `GCloudAPIService`
- Enhanced JSDoc comment for `setDashboardAPIUrl()` to clarify URL format requirements

### 🔥 Removed

- _Breaking Change:_ Removed `DOFunctionCallOutput` type from public exports

## 🔖 [2.1.25] (2025-07-04)

### 🏗️ Changed

- Updated dependencies including @aneuhold/core-ts-lib and @aneuhold/main-scripts

## 🔖 [2.1.24] (2025-06-26)

### 🏗️ Changed

- Added directory field to repository configuration in package.json

## 🔖 [2.1.23] (2025-06-25)

### ✅ Added

- CHANGELOG.md file now included in published package

## 🔖 [2.1.22] (2025-06-19)

### 🏗️ Changed

- Updated dependencies: `@types/node` to ^22.15.32, `eslint` to ^9.29.0, `tsx` to ^4.20.3, `vitest` to ^3.2.4
- Updated package.json scripts and configurations

### 🩹 Fixed

- Fixed GitHub Actions deployment workflow authentication issues
- Added proper GitHub token configuration for git tag creation
- Updated workflow permissions to allow repository write access

<!-- Link References -->

[2.2.5]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.3...core-ts-api-lib-v2.2.5
[2.2.3]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.2...core-ts-api-lib-v2.2.3
[2.2.2]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.1...core-ts-api-lib-v2.2.2
[2.2.1]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.0...core-ts-api-lib-v2.2.1
[2.2.0]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.1.25...core-ts-api-lib-v2.2.0
[2.1.25]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.1.24...core-ts-api-lib-v2.1.25
[2.1.24]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.1.23...core-ts-api-lib-v2.1.24
[2.1.23]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.1.22...core-ts-api-lib-v2.1.23
[2.1.22]: https://github.com/aneuhold/ts-libs/releases/tag/core-ts-api-lib-v2.1.22
