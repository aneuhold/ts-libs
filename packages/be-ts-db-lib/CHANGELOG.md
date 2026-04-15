# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 🔖 [4.2.23] (2026-04-15)

### ✅ Added

- `WorkoutExerciseRepository.buildExerciseCTOs` now runs a third parallel aggregation pipeline to populate `lastSessionExercise`/`lastSessionSets` from the true latest completed session (any cycle type, including deloads and free-form).

### 🏗️ Changed

- Repository now populates `lastAccumulationSessionExercise`/`lastAccumulationSessionSets` alongside `lastSessionExercise`/`lastSessionSets` in each `WorkoutExerciseCTO`.
- Updated dependencies on `@aneuhold/be-ts-lib` to `^3.1.10` and `@aneuhold/core-ts-db-lib` to `^5.0.5`.

## 🔖 [4.2.22] (2026-03-26)

### 🏗️ Changed

- Refactored `MigrationService` to migrate `DashboardUserConfig` records instead of `User.projectAccess` fields; now backfills `enableAdminPage` and `enabledFeatures.adminPage` with safe defaults.
- Updated dependencies on `@aneuhold/be-ts-lib` to `^3.1.9` and `@aneuhold/core-ts-db-lib` to `^5.0.4`.

## 🔖 [4.2.21] (2026-03-20)

### 🏗️ Changed

- `GoogleAuthService.verifyAndFindUser` and `verifyAndFindOrCreateUser` no longer return `apiKey` in their result.
- Updated dependencies on `@aneuhold/be-ts-lib` to `^3.1.8` and `@aneuhold/core-ts-db-lib` to `^5.0.3`.

### 🔥 Removed

- Removed `ApiKeyRepository` class, its tests, and its subscriber registration in `UserRepository`.
- Removed `ApiKeyValidator` class and its usage in `DbSchemaUpdater`.

## 🔖 [4.2.20] (2026-03-19)

### ✅ Added

- Added `GoogleAuthService.verifyAndFindUser` method that returns `null` when no matching user exists (does not create one).

### 🏗️ Changed

- Refactored `GoogleAuthService`: extracted private `verifyToken` helper and restructured `verifyAndFindOrCreateUser` to delegate to `verifyAndFindUser`.
- Refactored `MigrationService` to fill in missing `projectAccess` fields with safe defaults instead of patching `refreshTokenHashes`.
- Updated dependencies on `@aneuhold/be-ts-lib` to `^3.1.7` and `@aneuhold/core-ts-db-lib` to `^5.0.2`.

## 🔖 [4.2.19] (2026-03-18)

### ✅ Added

- Added `UserRepository.getUserByRefreshTokenHash()` to look up a user by a SHA-256 hashed refresh token stored in `auth.refreshTokenHashes`.

### 🏗️ Changed

- `MigrationService` updated to backfill `auth.refreshTokenHashes` for users missing the field; removed the previous large ObjectId-to-UUID migration logic.

## 🔖 [4.2.18] (2026-03-15)

### ✅ Added

- Added `GoogleAuthService` which verifies Google ID tokens and finds or creates the associated user, including email-based account linking.
- Added `google-auth-library` dependency for Google OAuth token verification.

### 🏗️ Changed

- `BaseRepository.get()` filter parameter type changed from `Partial<T>` to `DeepPartial<T>` to allow filtering on nested fields.

## 🔖 [4.2.17] (2026-03-13)

### 🏗️ Changed

- `WorkoutExerciseRepository` now fetches all sets from the last session exercise (not just the first) to populate `lastSessionSets` via an updated MongoDB aggregation pipeline.
- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.1.4` and `@aneuhold/core-ts-db-lib@^5.0.0`.

## 🔖 [4.2.16] (2026-03-12)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.1.3` and `@aneuhold/core-ts-db-lib@^4.1.15`.

## 🔖 [4.2.15] (2026-03-07)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.1.2` and `@aneuhold/core-ts-db-lib@^4.1.14`.

## 🔖 [4.2.14] (2026-02-28)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.1.1` and `@aneuhold/core-ts-db-lib@^4.1.13`.

## 🔖 [4.2.13] (2026-02-28)

### ✅ Added

- Added `WorkoutExerciseRepository.buildExerciseCTOsForUser()` to build `WorkoutExerciseCTO` objects for all of a user's exercises using parallel MongoDB aggregation pipelines (exercise + equipment + best calibration + best set; last accumulation session + first set).
- Added `WorkoutMuscleGroupRepository.buildMuscleGroupVolumeCTOsForUser()` to build `WorkoutMuscleGroupVolumeCTO` objects for all of a user's muscle groups using a volume aggregation pipeline across completed mesocycles.

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.1.0`, `@aneuhold/core-ts-db-lib@^4.1.12`, and `@aneuhold/core-ts-lib@^2.4.1`.

## 🔖 [4.2.12] (2026-02-23)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.22` and `@aneuhold/core-ts-db-lib@^4.1.11`.

## 🔖 [4.2.11] (2026-02-23)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.21` and `@aneuhold/core-ts-db-lib@^4.1.10`.

## 🔖 [4.2.10] (2026-02-22)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-db-lib@^4.1.9`.

## 🔖 [4.2.9] (2026-02-22)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.19`, `@aneuhold/core-ts-db-lib@^4.1.8`, and `@aneuhold/core-ts-lib@^2.4.0`.

## 🔖 [4.2.8] (2026-02-21)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.18` and `@aneuhold/core-ts-db-lib@^4.1.7`.

## 🔖 [4.2.7] (2026-02-21)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.17`, `@aneuhold/core-ts-db-lib@^4.1.6`, and `@aneuhold/local-npm-registry@^0.2.26`.

## 🔖 [4.2.6] (2026-02-21)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.16`, `@aneuhold/core-ts-db-lib@^4.1.5`, `@aneuhold/core-ts-lib@^2.3.18`, and `@aneuhold/local-npm-registry@^0.2.25`.

## 🔖 [4.2.5] (2026-02-20)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.15` and `@aneuhold/core-ts-db-lib@^4.1.4`.

## 🔖 [4.2.4] (2026-02-17)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.14` and `@aneuhold/core-ts-db-lib@^4.1.3`.

### 🔥 Removed

- Removed outdated `WORKOUT_IMPLEMENTATION_PLAN.md` documentation file.

## 🔖 [4.2.3] (2026-02-15)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.13` and `@aneuhold/core-ts-db-lib@^4.1.2`.

## 🔖 [4.2.2] (2026-02-07)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/be-ts-lib@^3.0.12`.
- Enhanced workout validators to support pending document creation via new `DbOperationMetaData` parameter (microcycle, session, session exercise, set validators).
- Improved error handling and validation logic for workout document relationships.

## 🔖 [4.2.1] (2026-02-06)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/be-ts-lib@^3.0.11`.

### 🩹 Fixed

- No direct code changes; version bump for compatibility with new major versions of dependencies.

## 🔖 [4.2.0] (2026-02-06)

### ✅ Added

- Added Phase 5 repository implementations and several additional repositories for dashboard and workout domains.
- Added new validators and lifecycle tests to improve data integrity and repository behavior.
- Added listeners for user repository events to support reactive workflows.

### 🏗️ Changed

- Cleaned up repository implementations and subscriber logic; refactored tests to run faster and more reliably.
- Added `check` script (`tsc --noEmit`) to package.json for TypeScript checks.

### 🩹 Fixed

- Fixed test configuration issues and various repository logic bugs uncovered during refactors and new tests.

## 🔖 [4.1.2] (2025-12-21)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/be-ts-lib@^3.0.9`.

## 🔖 [4.1.1] (2025-12-14)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.8`, `@aneuhold/core-ts-db-lib@^4.0.4`, `@aneuhold/core-ts-lib@^2.3.16`, and `@aneuhold/local-npm-registry@^0.2.23`.

## 🔖 [4.1.0] (2025-12-14)

### ✅ Added

- Added doc caching and retrieval strategy to repositories
- Created base user ID repository for dashboard

### 🏗️ Changed

- Updated test scripts to include coverage
- Updated dependencies for compatibility

### 🩹 Fixed

- Fixed import paths in dashboard repositories

## 🔖 [4.0.2] (2025-12-13)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.6` and `@aneuhold/core-ts-db-lib@^4.0.2` for latest schema and validation improvements.

## 🔖 [4.0.1] (2025-12-08)

### 🏗️ Changed

- Updated dependency: now requires `@aneuhold/core-ts-db-lib@^4.0.1` for latest schema and validation improvements.

## 🔖 [4.0.0] (2025-12-07)

### ✅ Added

- Added Zod-based schemas and validation for all document and repository types.
- Added new tests for repository and validator logic using Zod schemas.

### 🏗️ Changed

- _Breaking Change:_ Migrated all document, repository, and validator code from legacy validation utilities to Zod schemas.
- _Breaking Change:_ All type-only imports now use `import type` for clarity and build performance.
- Refactored repository, service, and validator files to use new Zod-based validation and schemas.
- Updated dependencies: now requires `@aneuhold/core-ts-db-lib@^4.0.0`, `@aneuhold/core-ts-lib@^2.3.14`, `@aneuhold/be-ts-lib@^3.0.4`, `zod@^4.1.13`, and `@aneuhold/local-npm-registry@^0.2.21`.
- Updated dev dependencies for compatibility: `prettier`, `tsx`, and `vitest`.
- Improved test coverage for partial updates and edge cases in repositories.

### 🩹 Fixed

- Fixed issues with partial updates not clearing or preserving fields as expected.
- Fixed bugs in migration and document creation logic for user-related entities.

### 🔥 Removed

- _Breaking Change:_ Removed all legacy validation utilities and type-guard helpers in favor of Zod schemas.
- Removed unused files and legacy test utilities.

## 🔖 [3.0.4] (2025-12-07)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.3`, `@aneuhold/core-ts-db-lib@^3.0.3`, `@aneuhold/core-ts-lib@^2.3.13`, and `@aneuhold/local-npm-registry@^0.2.20`.

## 🔖 [3.0.3] (2025-11-29)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/be-ts-lib@^3.0.2`, `@aneuhold/core-ts-db-lib@^3.0.2`, `@aneuhold/core-ts-lib@^2.3.12`, and `@aneuhold/local-npm-registry@^0.2.19`.
- Development dependencies updated for compatibility: `@types/node`, `prettier`, `rimraf`, and `vitest`.
- Migration logic in `MigrationService` refactored to delete legacy documents (ObjectId) instead of migrated documents (string IDs).
- Improved migration mapping and document creation for user-related entities.

## 🔖 [3.0.2] (2025-11-26)

### 🏗️ Changed

- Updated all type signatures and internal logic to use `UUID` instead of `string` for document IDs in repository and migration services.
- Updated dependency: now requires `@aneuhold/core-ts-db-lib@^3.0.1` and `@aneuhold/local-npm-registry@^0.2.18`.

## 🔖 [3.0.1] (2025-11-25)

### 🏗️ Changed

- All dashboard repositories now require `docType` in delete and update queries for stricter document targeting.
- Improved internal filtering in `getAllForUser` and similar methods to use repository-level collection access and default filters.
- Refactored `DashboardUserConfigRepository` to ensure collaborator and userId references always include `docType`.
- Updated migration logic in `MigrationService` for more robust and complete UUID migration, including all dashboard-related document types.
- Added `uuid` as a dependency in `package.json`.

## 🔖 [3.0.0] (2025-11-23)

### 🏗️ Changed

_Breaking Change:_ Migrated all document, repository, and validator code from using `ObjectId` (from `bson`) to native `UUID` (from `crypto`), including all type signatures, constructors, and internal logic.
_Breaking Change:_ Updated all references, tests, and utility functions to use `UUID` instead of `ObjectId`.
Added migration utilities and scripts to support conversion of existing data from `ObjectId` to `UUID v7`.
Updated dependencies: now requires `@aneuhold/core-ts-db-lib@^3.0.0`, `@aneuhold/core-ts-lib@^2.3.11`, and `@aneuhold/be-ts-lib@^3.0.0`.

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
[4.2.23]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.22...be-ts-db-lib-v4.2.23
[4.2.22]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.21...be-ts-db-lib-v4.2.22
[4.2.21]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.20...be-ts-db-lib-v4.2.21
[4.2.20]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.19...be-ts-db-lib-v4.2.20
[4.2.19]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.18...be-ts-db-lib-v4.2.19
[4.2.18]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.17...be-ts-db-lib-v4.2.18
[4.2.17]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.16...be-ts-db-lib-v4.2.17
[4.2.16]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.15...be-ts-db-lib-v4.2.16
[4.2.15]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.14...be-ts-db-lib-v4.2.15
[4.2.14]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.13...be-ts-db-lib-v4.2.14
[4.2.13]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.12...be-ts-db-lib-v4.2.13
[4.2.12]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.11...be-ts-db-lib-v4.2.12
[4.2.11]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.10...be-ts-db-lib-v4.2.11
[4.2.10]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.9...be-ts-db-lib-v4.2.10
[4.2.9]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.8...be-ts-db-lib-v4.2.9
[4.2.8]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.7...be-ts-db-lib-v4.2.8
[4.2.7]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.6...be-ts-db-lib-v4.2.7
[4.2.6]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.5...be-ts-db-lib-v4.2.6
[4.2.5]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.4...be-ts-db-lib-v4.2.5
[4.2.4]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.3...be-ts-db-lib-v4.2.4
[4.2.3]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.2...be-ts-db-lib-v4.2.3
[4.2.2]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.1...be-ts-db-lib-v4.2.2
[4.2.1]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.2.0...be-ts-db-lib-v4.2.1
[4.2.0]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.1.2...be-ts-db-lib-v4.2.0
[4.1.2]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.1.1...be-ts-db-lib-v4.1.2
[4.1.1]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.1.0...be-ts-db-lib-v4.1.1
[4.1.0]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.0.2...be-ts-db-lib-v4.1.0
[4.0.2]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.0.1...be-ts-db-lib-v4.0.2
[4.0.1]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v4.0.0...be-ts-db-lib-v4.0.1
[4.0.0]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v3.0.4...be-ts-db-lib-v4.0.0
[3.0.4]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v3.0.3...be-ts-db-lib-v3.0.4
[3.0.3]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v3.0.2...be-ts-db-lib-v3.0.3
[3.0.2]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v3.0.1...be-ts-db-lib-v3.0.2
[3.0.1]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v3.0.0...be-ts-db-lib-v3.0.1
[3.0.0]: https://github.com/aneuhold/ts-libs/compare/be-ts-db-lib-v2.0.85...be-ts-db-lib-v3.0.0
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
