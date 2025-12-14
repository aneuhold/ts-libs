# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 🔖 [3.0.7] (2025-12-14)

### ✅ Added
- Added websocket types for dashboard communication

### 🏗️ Changed
- Updated dependencies for compatibility


## 🔖 [3.0.6] (2025-12-13)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/core-ts-db-lib@^4.0.2` for latest schema and validation improvements.

## 🔖 [3.0.5] (2025-12-08)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/core-ts-db-lib@^4.0.1` for latest schema and validation improvements.

## 🔖 [3.0.4] (2025-12-07)

### 🏗️ Changed

- Updated all type imports to use `import type` for improved clarity and build performance.
- Updated dev dependencies for compatibility: `prettier`, `tsx`, and `vitest`.
- Minor refactor in `AuthValidateUser.ts` and `ProjectDashboard.ts` to use explicit type-only imports.

## 🔖 [3.0.3] (2025-12-07)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-db-lib@^3.0.3`, `@aneuhold/core-ts-lib@^2.3.13`, and `@aneuhold/local-npm-registry@^0.2.20`.

## 🔖 [3.0.2] (2025-12-03)

### ✅ Added

- New unit tests for `GCloudAPIService` covering API calls, date parsing, and error handling.
- Added types: `AuthCheckPasswordInput`, `AuthCheckPasswordOutput`, `AuthValidateUserInput`, `AuthValidateUserOutput`, and `ProjectDashboardInput`/`Output` to `src/types/`.

### 🏗️ Changed

- API service now uses JSON for requests/responses instead of BSON.
- Refactored APIService and GCloudAPIService to use new type locations and improved error handling.
- Updated dependencies: now requires `@aneuhold/core-ts-api-lib@^3.0.2`, `@aneuhold/core-ts-lib@^2.3.12`, and `@aneuhold/local-npm-registry@^0.2.19`.
- Development dependencies updated for compatibility: `@types/node`, `prettier`, `rimraf`, and `vitest`.

### 🔥 Removed

- Removed Digital Ocean function classes and related service files from `src/services/DOFunctionService/`.
- Removed legacy test utilities and example function files.

## 🔖 [3.0.1] (2025-11-26)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/core-ts-db-lib@^3.0.1` and `@aneuhold/local-npm-registry@^0.2.18`.

### 🏗️ Changed

_Breaking Change:_ Updated all dependencies to require `@aneuhold/core-ts-db-lib@^3.0.0` and `@aneuhold/core-ts-lib@^2.3.11`.
Updated build scripts and exports for compatibility with new dependency versions.
No direct code changes; version bump for compatibility.

## 🔖 [2.2.8] (2025-11-09)

### 🏗️ Changed

- Refactored all service, function, and test files to use `import type` for type-only imports, improving build performance and clarity.
- Updated internal imports to separate type and value imports from dependencies and internal modules.
- No breaking changes; all updates are internal refactors for TypeScript best practices.

## 🔖 [2.2.7] (2025-11-08)

### 🏗️ Changed

- Refactored `APIService.validateUser` to use `GCloudAPIService` directly (removes dependency on DOFunctionService)
- Renamed `setDashboardAPIUrl` to `setAPIUrl` for clarity and updated JSDoc
- Set default base URL for GCloud API in `GCloudAPIService`
- Moved user validation logic to `GCloudAPIService.authValidateUser`

## 🔖 [2.2.6] (2025-11-07)

### 🏗️ Changed

- Updated package.json: added `unpub:local` script for local unpublishing
- Changed `main` and `types` fields to use browser entry points
- Removed unused `module` field from package.json

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
[3.0.7]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v3.0.6...core-ts-api-lib-v3.0.7
[3.0.6]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v3.0.5...core-ts-api-lib-v3.0.6
[3.0.5]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v3.0.4...core-ts-api-lib-v3.0.5
[3.0.4]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v3.0.3...core-ts-api-lib-v3.0.4
[3.0.3]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v3.0.2...core-ts-api-lib-v3.0.3
[3.0.2]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v3.0.1...core-ts-api-lib-v3.0.2
[3.0.1]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.8...core-ts-api-lib-v3.0.1
[2.2.8]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.7...core-ts-api-lib-v2.2.8
[2.2.7]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.6...core-ts-api-lib-v2.2.7
[2.2.6]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.5...core-ts-api-lib-v2.2.6
[2.2.5]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.5...core-ts-api-lib-v2.2.5
[2.2.5]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.1...core-ts-api-lib-v2.2.5
[2.2.1]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.2.0...core-ts-api-lib-v2.2.1
[2.2.0]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.1.25...core-ts-api-lib-v2.2.0
[2.1.25]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.1.24...core-ts-api-lib-v2.1.25
[2.1.24]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.1.23...core-ts-api-lib-v2.1.24
[2.1.23]: https://github.com/aneuhold/ts-libs/compare/core-ts-api-lib-v2.1.22...core-ts-api-lib-v2.1.23
[2.1.22]: https://github.com/aneuhold/ts-libs/releases/tag/core-ts-api-lib-v2.1.22
