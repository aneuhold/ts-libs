# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## 🔖 [5.0.7] (2026-04-21)

### ✅ Added

- Added `UUIDSchema` — a shared Zod schema that validates a UUIDv7 string and narrows it to the branded `UUID` type without a type assertion.
- Added `DocumentService.toUUID` static method that safely narrows a validated UUID string to the branded `UUID` type.

### 🏗️ Changed

- All Zod schemas across `documents/`, `embedded-types/`, and `schemas/` now use the shared `UUIDSchema` instead of inline `z.uuidv7().transform((val) => val as UUID)` patterns.
- `DocumentService.deepCopy` type parameter no longer requires `T extends object`, accepting any `T`.
- `DocumentService.generateID` now uses `toUUID()` internally instead of a type cast.
- `TaskService` now uses `DocumentService.toUUID` when converting `Object.keys(taskMap)` to a `UUID[]` instead of a cast.

## 🔖 [5.0.6] (2026-04-17)

### 🏗️ Changed

- Updated set recommendation logic in `WorkoutSessionExerciseService`: soreness=1 + performance=1 now recommends +1 set (was +0).

## 🔖 [5.0.5] (2026-04-15)

### ✅ Added

- Added `lastSessionExercise` and `lastSessionSets` fields to `WorkoutExerciseCTO` representing the literal most recent completed session exercise (including deload and free-form sessions).

### 🏗️ Changed

- *Breaking Change:* Renamed `lastSessionExercise` → `lastAccumulationSessionExercise` and `lastSessionSets` → `lastAccumulationSessionSets` in `WorkoutExerciseCTO`; these fields now exclusively reflect the most recent non-deload accumulation session.
- `WorkoutSetService` now uses `lastAccumulationSessionSets` for first-microcycle progression and autoregulation calculations.

## 🔖 [5.0.4] (2026-03-26)

### ✅ Added

- Added `isSuperAdmin` boolean field to `User.auth` private details for granting super admin access to admin endpoints.
- Added `enableAdminPage` boolean field to `DashboardUserConfig` (defaults to `false`).
- Added `adminPage` feature flag to `DashboardUserConfig.enabledFeatures` (defaults to `false`).

## 🔖 [5.0.3] (2026-03-20)

### 🔥 Removed

- Removed `ApiKey` document type, schema, and associated spec.

## 🔖 [5.0.2] (2026-03-19)

### ✅ Added

- Added `ProjectName` enum (`Dashboard`, `Workout`) exported from the browser entry point.

### 🏗️ Changed

- `User.projectAccess` keys now use `ProjectName` enum values instead of plain string literals.

## 🔖 [5.0.1] (2026-03-15)

### ✅ Added

- Added `RefreshTokenHash` embedded type and `RefreshTokenHashSchema` for storing hashed refresh tokens on users.
- Added `GOOGLE_CLIENT_ID` constant (public Google OAuth 2.0 Client ID), exported from the browser entry point.
- Added `refreshTokenHashes` array field to `User.auth` to track active refresh token hashes per device/session.

## 🔖 [5.0.0] (2026-03-13)

### 🏗️ Changed

- _Breaking Change:_ `WorkoutExerciseCTO.lastFirstSet` (nullable `WorkoutSet`) replaced by `lastSessionSets` (array of `WorkoutSet`).
- _Breaking Change:_ `WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet` parameter `previousFirstSet?: WorkoutSet` replaced by `previousSets: WorkoutSet[]`.
- Autoregulation now averages surplus across all sets in a session exercise instead of using only the first set, providing a more representative performance signal.
- `WorkoutSessionExerciseService.calculateSetSurplus` is now private; the new public `calculateAverageSurplus(sets)` method handles multi-set aggregation.
- `WorkoutMesocycleService` performance-drop detection now averages surplus across all sets rather than using only the first set.
- `WorkoutSetService` now retrieves all sets from the previous microcycle for autoregulation instead of only the first set.
- Rep progression severe underperformance (average surplus < -3) now also reduces weight by one equipment increment.

## 🔖 [4.1.15] (2026-03-12)

### 🏗️ Changed

- `CompletedWorkoutSet` type refined to only require planned and actual performance fields (`plannedReps`, `plannedWeight`, `plannedRir`, `actualReps`, `actualWeight`, `rir`) to be non-nullable, rather than all fields.
- `WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet` no longer accepts a `microcycleIndex` parameter; all microcycle-to-microcycle progression is now handled by autoregulation/forecasting from the previous set.
- Replaced `hasCompleteAutoRegulationData` with `toCompletedSet`, which converts a `WorkoutSet` to a `CompletedWorkoutSet` and forecasts planned-only sets (surplus = 0) so progression continues smoothly even without actual performance data.
- `calculateCalibrationBasedTargets` now computes initial targets only (no microcycle loops); it is used exclusively when no previous set exists.
- `WorkoutSetService` no longer passes `microcycleIndex` to `calculateTargetRepsAndWeightForFirstSet`.

## 🔖 [4.1.14] (2026-03-07)

### 🏗️ Changed

- Refactored `WorkoutVolumePlanningService` into a cleaner multi-step pipeline with dedicated extracted methods: `getVolumeTargetsForMuscleGroup`, `calculateBaselineSetCounts`, `distributeEvenly`, `resolveHistoricalExerciseData`, `applyHistoricalSetCounts`, `evaluateSfrRecommendations`, `distributeSetsToExercises`, `sessionIsCapped`, `getSessionSetTotal`, and `addSetsToExercise`.
- `WorkoutMesocyclePlanContext` now exposes `accumulationMicrocycleCount` (total microcycles minus the deload, when applicable).
- `WorkoutVolumeLandmarkEstimate.estimatedMev` now represents total sets per microcycle for the muscle group, not per session.
- Default volume constants renamed: `DEFAULT_MEV` → `DEFAULT_MEV_PER_EXERCISE`, `DEFAULT_MRV` → `DEFAULT_MRV_PER_EXERCISE`.
- Cut cycle baseline progression now targets MAV (midpoint) instead of MRV.
- MAV for exercises returning from recovery is now distributed evenly across all exercises in the muscle group using floor-based distribution.
- MRV estimate is no longer hard-capped at `MAX_SETS_PER_MUSCLE_GROUP_PER_SESSION` in `estimateVolumeLandmarks()`.

### 🔥 Removed

- Removed `WorkoutVolumePlanningService.evaluateMevProximity()` static method and the associated second-microcycle MEV proximity adjustment logic.

## 🔖 [4.1.13] (2026-02-28)

### ✅ Added

- Added `WorkoutVolumePlanningService` with `estimateVolumeLandmarks()` and `evaluateMevProximity()` static methods for computing MEV/MRV/MAV landmarks from historical mesocycle data and assessing first-microcycle RSM proximity.
- Added `WorkoutDeloadSeverity` and `WorkoutDeloadTriggerRule` enums, and `WorkoutDeloadRecommendation` type for structured early-deload evaluation.
- Added `WorkoutMesocycleService.shouldTriggerEarlyDeload()` to detect when recovery session counts or consecutive performance drops warrant an early deload.
- Added `WorkoutSetService.calculateSetSurplus()` static method computing the signed difference between actual and planned reps/RIR for a single set.
- Added `WorkoutExerciseService.getTargetWeightFrom1RM()` static method to compute target weight directly from a precomputed effective 1RM.
- Added `CompletedWorkoutSet` type: a `WorkoutSet` with all nullable fields guaranteed non-null.
- Added `WorkoutVolumeLandmarkEstimate` type for estimated MEV, MRV, and MAV derived from historical mesocycle volume CTOs.

### 🏗️ Changed

- `WorkoutMesocycleService.planMesocycle()` now accepts an optional `volumeCTOs: WorkoutMuscleGroupVolumeCTO[]` parameter to seed volume landmark estimates for the plan.
- `WorkoutMesocyclePlanContext` now exposes `firstMicrocycleRir`, `progressionInterval`, `skipDeload`, and `muscleGroupToVolumeLandmarkMap`; constructor accepts `volumeCTOs` to populate landmark estimates.
- `WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet()` now applies autoregulation: accelerates rep target when surplus ≥ 3, holds when −2 to −1, and regresses when surplus ≤ −3.
- `WorkoutSessionExerciseService` now uses per-exercise previous-microcycle first-set lookup to drive autoregulated progression across all planned microcycles.
- MEV proximity adjustments from the first microcycle are now applied when generating the second microcycle via `WorkoutVolumePlanningService.evaluateMevProximity()`.

## 🔖 [4.1.12] (2026-02-28)

### ✅ Added

- Added `WorkoutExerciseCTO` type and schema, bundling an exercise with its equipment type, best calibration, best set, and most recent accumulation session data. Replaces the `CalibrationExercisePair` pattern.
- Added `WorkoutMuscleGroupVolumeCTO` type and schema, bundling a muscle group with its per-mesocycle volume history (last 10 mesocycles).
- Added `MesocycleVolumeSummary` embedded type for capturing per-mesocycle set counts, RSM/soreness/performance averages, and recovery session counts.
- Added `associatedWorkoutSetId` field to `WorkoutExerciseCalibration` to track when a calibration was auto-generated from a best-set record.
- Added `WorkoutExerciseCalibrationService.generateAutoCalibrations()` static method to auto-create calibrations from exercise CTOs whose best-set 1RM exceeds their best calibration 1RM.

### 🏗️ Changed

- _Breaking Change:_ `WorkoutMesocycleService.planMesocycle()` now accepts a single `exerciseCTOs: WorkoutExerciseCTO[]` parameter instead of separate `calibrations`, `exercises`, and `equipmentTypes` arrays.
- _Breaking Change:_ `WorkoutMesocyclePlanContext` refactored to use `WorkoutExerciseCTO` throughout; `plannedSessionExercisePairs` renamed to `plannedSessionExerciseCTOs`, `muscleGroupToExercisePairsMap` renamed to `muscleGroupToExerciseCTOsMap`, and `calibrationMap` removed.
- Fixed `WorkoutExerciseCalibrationService.getTargetPercentageFor1RM()` formula from `30 + (targetReps - 5) * 2.2` to the correct `85 - (targetReps - 5) * 2.2`.
- Updated `tsconfig.json` to exclude the `lib` directory from TypeScript compilation.

### 🔥 Removed

- Removed `CalibrationExercisePair` type; superseded by `WorkoutExerciseCTO`.

## 🔖 [4.1.11] (2026-02-23)

### 🏗️ Changed

- Deload second-half weight halving in `WorkoutSetService` now uses `WorkoutEquipmentTypeService.findNearestWeight` to snap to the nearest available equipment weight, falling back to `Math.floor` if no match is found.

## 🔖 [4.1.10] (2026-02-23)

### ✅ Added

- Added `WorkoutMesocycleService.getProjectedStartDate()` to return the projected start date for a mesocycle, falling back to the earliest microcycle start date when `startDate` is not set.

### 🏗️ Changed

- _Breaking Change:_ Renamed `WorkoutMesocycleService.calculateProjectedEndDate()` to `getProjectedEndDate()`.
- Updated `WorkoutMesocycleService.detectMesocycleOverlap()` to use `getProjectedStartDate()`, enabling overlap detection for future mesocycles that have no `startDate` but have associated microcycles.
- Deload microcycles in `WorkoutVolumePlanningService` now halve the previous microcycle's historical set counts (minimum 1) and skip SFR-based set additions entirely.

## 🔖 [4.1.9] (2026-02-22)

### ✅ Added

- Added `WorkoutMesocycleService.calculateProjectedEndDate()` to compute a mesocycle's projected end from its microcycles or planned parameters.
- Added `WorkoutMesocycleService.shiftMesocycleDates()` to shift all dates of a mesocycle and its child documents in place by a given number of days.
- Added `WorkoutMesocycleService.detectMesocycleOverlap()` to detect overlapping date ranges across a set of mesocycles.
- Added `WorkoutMesocycleService.getEarliestAllowedStartDate()` to determine the earliest valid start date for a new mesocycle based on existing ones.

### 🏗️ Changed

- Refactored internal date handling in `WorkoutMesocycleService` to use existing `Date` references directly instead of wrapping them in `new Date()`.

## 🔖 [4.1.8] (2026-02-22)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-lib@^2.4.0`.

## 🔖 [4.1.7] (2026-02-21)

### ✅ Added

- Added `WorkoutSessionLockReason` enum with values `MesocycleNotStarted`, `PreviousMicrocycleNotCompleted`, and `PreviousSessionNotCompleted`.
- Added `WorkoutSessionService.getSessionLockReason()` to determine whether a session is locked and why.
- Added `WorkoutSessionExerciseService.hasMidSessionMetricsFilled()` to check if mid-session metrics (mindMuscleConnection, pump, jointAndTissueDisruption, perceivedEffort, performanceScore) are filled.

### 🏗️ Changed

- _Breaking Change:_ Renamed `WorkoutSessionExerciseService.needsReview()` to `hasAllSessionMetricsFilled()`. The method now returns `true` when all metrics are filled (inverted semantics from the old method).

### 🩹 Fixed

- Fixed deload set generation to use the previous microcycle's index when calculating target weight/reps, preventing deload sets from being planned at a higher weight than the last accumulation cycle.

## 🔖 [4.1.6] (2026-02-21)

### 🏗️ Changed

- Updated dev dependencies: now requires `@aneuhold/local-npm-registry@^0.2.26` and `@aneuhold/main-scripts@^2.8.3`.
- Improved type annotations: replaced implicit `0` and `null` initializers with explicit types in `TaskRecurrenceService` and `WorkoutVolumePlanningService`.

## 🔖 [4.1.5] (2026-02-21)

### 🏗️ Changed

- Updated dependencies: now requires `@aneuhold/core-ts-lib@^2.3.18` and `@aneuhold/local-npm-registry@^0.2.25`.

## 🔖 [4.1.4] (2026-02-20)

### ✅ Added

- Added optional `description` field to `WorkoutEquipmentType` for additional equipment details.
- Added `startDate` field to `WorkoutMesocycle` to track when a user explicitly begins training.
- Added `completedDate` field to `WorkoutMicrocycle` to mark completion and indicate regeneration state.

### 🏗️ Changed

- Updated `WorkoutMesocycleService` to preserve microcycles with `completedDate` set during mesocycle regeneration, even when sessions are incomplete.

## 🔖 [4.1.3] (2026-02-17)

### ✅ Added

- Added `getActiveAndNextSessions()` method to `WorkoutSessionService` for efficiently finding in-progress and next-up sessions.
- Added `isDeloadExercise()` method to `WorkoutSessionExerciseService` to identify deload exercises.
- Added `needsReview()` method to `WorkoutSessionExerciseService` to check if late session fields are missing.
- Added `isCompleted()` method to `WorkoutSetService` to verify if a set has been fully logged.
- Added comprehensive unit tests for workout session, exercise, and set services.

### 🏗️ Changed

- Updated deload microcycle handling: `targetRir` is now `null` for deload microcycles instead of using a numeric value.
- Refactored method signatures to support `targetRir: number | null` across workout services.

## 🔖 [4.1.2] (2026-02-15)

### ✅ Added

- Added `generatePlateWeightOptions()` method to `WorkoutEquipmentTypeService` to generate all achievable weight combinations from a bar and plate pairs.
- Added `get1RMRaw()` static method to `WorkoutExerciseCalibrationService` for calculating 1RM from weight and reps.

### 🏗️ Changed

- Refactored `generateSessionsForMicrocycle()` in `WorkoutMicrocycleService` to support creating more sessions than available non-rest days by distributing sessions chronologically across days.

## 🔖 [4.1.1] (2026-02-06)

### 🏗️ Changed

- Relaxed validation in `WorkoutMesocycleSchema`: removed minimum length check for `calibratedExercises` array.

### 🩹 Fixed

- No other direct code changes; version bump for compatibility with new major versions of dependencies.

## 🔖 [4.1.0] (2026-02-06)

### ✅ Added

- Added workout document types and schemas (e.g., `WorkoutExercise`, `WorkoutMesocycle`, `WorkoutMicrocycle`, `WorkoutSession`, `WorkoutSet`, and related embedded types).
- Added new workout services and utilities (`WorkoutExerciseService`, `WorkoutSessionService`, `WorkoutSetService`, `WorkoutMesocycleService`, `WorkoutMicrocycleService`, `WorkoutSFRService`, `WorkoutVolumePlanningService`, and `WorkoutEquipmentTypeService`).
- Added comprehensive unit tests and a `WorkoutTestUtil` to improve test coverage for workout logic.

### 🏗️ Changed

- Strengthened validation and schema updates (including updates to User schema and validators) to make validation more strict and robust.
- Refactored exports and `src/browser.ts` for improved API surface and maintainability.
- Added `check` script (`tsc --noEmit`) to package.json to enable TypeScript checks.

### 🩹 Fixed

- Fixed bugs in set planning and set reps calculation and various fixes across the workout scheduling algorithm and related services.

## 🔖 [4.0.4] (2025-12-14)

### 🏗️ Changed

- Updated `DashboardTaskListFilterSettingsSchema.startDate` to default to `{ showFutureTasks: true }`.
- Updated dependencies: now requires `@aneuhold/core-ts-lib@^2.3.16` and `@aneuhold/local-npm-registry@^0.2.23`.

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
[5.0.7]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v5.0.6...core-ts-db-lib-v5.0.7
[5.0.6]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v5.0.5...core-ts-db-lib-v5.0.6
[5.0.5]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v5.0.4...core-ts-db-lib-v5.0.5
[5.0.4]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v5.0.3...core-ts-db-lib-v5.0.4
[5.0.3]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v5.0.2...core-ts-db-lib-v5.0.3
[5.0.2]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v5.0.1...core-ts-db-lib-v5.0.2
[5.0.1]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v5.0.0...core-ts-db-lib-v5.0.1
[5.0.0]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.15...core-ts-db-lib-v5.0.0
[4.1.15]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.14...core-ts-db-lib-v4.1.15
[4.1.14]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.13...core-ts-db-lib-v4.1.14
[4.1.13]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.12...core-ts-db-lib-v4.1.13
[4.1.12]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.11...core-ts-db-lib-v4.1.12
[4.1.11]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.10...core-ts-db-lib-v4.1.11
[4.1.10]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.9...core-ts-db-lib-v4.1.10
[4.1.9]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.8...core-ts-db-lib-v4.1.9
[4.1.8]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.7...core-ts-db-lib-v4.1.8
[4.1.7]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.6...core-ts-db-lib-v4.1.7
[4.1.6]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.5...core-ts-db-lib-v4.1.6
[4.1.5]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.4...core-ts-db-lib-v4.1.5
[4.1.4]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.3...core-ts-db-lib-v4.1.4
[4.1.3]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.2...core-ts-db-lib-v4.1.3
[4.1.2]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.1...core-ts-db-lib-v4.1.2
[4.1.1]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.1.0...core-ts-db-lib-v4.1.1
[4.1.0]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.0.4...core-ts-db-lib-v4.1.0
[4.0.4]: https://github.com/aneuhold/ts-libs/compare/core-ts-db-lib-v4.0.3...core-ts-db-lib-v4.0.4
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
