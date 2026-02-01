# Phase 6: Integration and Finalization

## Prerequisites

- Phases 1-5 completed successfully
- All 9 workout repositories implemented and tested
- All validators working correctly
- All base classes in place

## Objectives

1. Export all workout repositories and validators from index.ts
2. Add UserRepository listener for cleanup on user deletion
3. Implement exercise property synchronization logic
4. Create migration scripts if needed
5. Final integration testing

---

## Part 1: Update Exports

### 1.1 Update index.ts

**Path**: `src/index.ts`

Add the following exports to the existing file:

```typescript
// Workout Repositories
export { default as WorkoutMuscleGroupRepository } from './repositories/workout/WorkoutMuscleGroupRepository.js';
export { default as WorkoutEquipmentTypeRepository } from './repositories/workout/WorkoutEquipmentTypeRepository.js';
export { default as WorkoutExerciseRepository } from './repositories/workout/WorkoutExerciseRepository.js';
export { default as WorkoutExerciseCalibrationRepository } from './repositories/workout/WorkoutExerciseCalibrationRepository.js';
export { default as WorkoutMesocycleRepository } from './repositories/workout/WorkoutMesocycleRepository.js';
export { default as WorkoutMicrocycleRepository } from './repositories/workout/WorkoutMicrocycleRepository.js';
export { default as WorkoutSessionRepository } from './repositories/workout/WorkoutSessionRepository.js';
export { default as WorkoutSessionExerciseRepository } from './repositories/workout/WorkoutSessionExerciseRepository.js';
export { default as WorkoutSetRepository } from './repositories/workout/WorkoutSetRepository.js';

// Workout Base Repositories (useful for extending)
export { default as WorkoutBaseRepository } from './repositories/workout/WorkoutBaseRepository.js';
export { default as WorkoutBaseWithUserIdRepository } from './repositories/workout/WorkoutBaseWithUserIdRepository.js';

// Workout Validators
export { default as WorkoutMuscleGroupValidator } from './validators/workout/MuscleGroupValidator.js';
export { default as WorkoutEquipmentTypeValidator } from './validators/workout/EquipmentTypeValidator.js';
export { default as WorkoutExerciseValidator } from './validators/workout/ExerciseValidator.js';
export { default as WorkoutExerciseCalibrationValidator } from './validators/workout/ExerciseCalibrationValidator.js';
export { default as WorkoutMesocycleValidator } from './validators/workout/MesocycleValidator.js';
export { default as WorkoutMicrocycleValidator } from './validators/workout/MicrocycleValidator.js';
export { default as WorkoutSessionValidator } from './validators/workout/SessionValidator.js';
export { default as WorkoutSessionExerciseValidator } from './validators/workout/SessionExerciseValidator.js';
export { default as WorkoutSetValidator } from './validators/workout/SetValidator.js';
```

---

## Part 2: User Deletion Cleanup

### 2.1 Update UserRepository

**Path**: `src/repositories/common/UserRepository.ts`

Add subscribers to clean up all workout data when a user is deleted. Update the `setupSubscribers()` method:

```typescript
protected setupSubscribers(): void {
  // Existing subscribers...

  // Subscribe to workout repositories for user deletion cleanup
  // Each workout repository provides getListenersForUserRepo() which returns
  // the appropriate listeners for user-related events
  this.subscribeToChanges(WorkoutMuscleGroupRepository.getListenersForUserRepo());
  this.subscribeToChanges(WorkoutEquipmentTypeRepository.getListenersForUserRepo());
  this.subscribeToChanges(WorkoutExerciseRepository.getListenersForUserRepo());
  this.subscribeToChanges(WorkoutExerciseCalibrationRepository.getListenersForUserRepo());
  this.subscribeToChanges(WorkoutMesocycleRepository.getListenersForUserRepo());
  this.subscribeToChanges(WorkoutMicrocycleRepository.getListenersForUserRepo());
  this.subscribeToChanges(WorkoutSessionRepository.getListenersForUserRepo());
  this.subscribeToChanges(WorkoutSessionExerciseRepository.getListenersForUserRepo());
  this.subscribeToChanges(WorkoutSetRepository.getListenersForUserRepo());
}
```

Add imports at the top of the file:

```typescript
import WorkoutMuscleGroupRepository from '../workout/WorkoutMuscleGroupRepository.js';
import WorkoutEquipmentTypeRepository from '../workout/WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseRepository from '../workout/WorkoutExerciseRepository.js';
import WorkoutExerciseCalibrationRepository from '../workout/WorkoutExerciseCalibrationRepository.js';
import WorkoutMesocycleRepository from '../workout/WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from '../workout/WorkoutMicrocycleRepository.js';
import WorkoutSessionRepository from '../workout/WorkoutSessionRepository.js';
import WorkoutSessionExerciseRepository from '../workout/WorkoutSessionExerciseRepository.js';
import WorkoutSetRepository from '../workout/WorkoutSetRepository.js';
```

### 2.2 Add getListenersForUserRepo to all Workout Repositories

Each workout repository needs a static `getListenersForUserRepo()` method. Add this method to each repository class:

**Pattern to add to each repository (e.g., WorkoutMuscleGroupRepository.ts)**:

```typescript
  /**
   * Gets listeners that respond to UserRepository events for cleanup.
   */
  public static getListenersForUserRepo() {
    const repo = WorkoutMuscleGroupRepository.getRepo();
    return [
      {
        documentType: 'user',
        operationType: 'delete' as const,
        listener: async (userId: UUID) => {
          await repo.deleteAllForUser(userId);
        }
      }
    ];
  }
```

Apply this same pattern to all 9 workout repositories:

- WorkoutMuscleGroupRepository
- WorkoutEquipmentTypeRepository
- WorkoutExerciseRepository
- WorkoutExerciseCalibrationRepository
- WorkoutMesocycleRepository
- WorkoutMicrocycleRepository
- WorkoutSessionRepository
- WorkoutSessionExerciseRepository
- WorkoutSetRepository

**Path**: `src/repositories/workout/index.ts`

```typescript
export { default as WorkoutMuscleGroupRepository } from './WorkoutMuscleGroupRepository.js';
export { default as WorkoutEquipmentTypeRepository } from './WorkoutEquipmentTypeRepository.js';
export { default as WorkoutExerciseRepository } from './WorkoutExerciseRepository.js';
export { default as WorkoutExerciseCalibrationRepository } from './WorkoutExerciseCalibrationRepository.js';
export { default as WorkoutMesocycleRepository } from './WorkoutMesocycleRepository.js';
export { default as WorkoutMicrocycleRepository } from './WorkoutMicrocycleRepository.js';
export { default as WorkoutSessionRepository } from './WorkoutSessionRepository.js';
export { default as WorkoutSessionExerciseRepository } from './WorkoutSessionExerciseRepository.js';
export { default as WorkoutSetRepository } from './WorkoutSetRepository.js';
```

---

## Part 3: Integration Tests

### 3.1 Create Integration Test Suite

**Path**: `src/repositories/workout/workout-integration.spec.ts`

**Implementation Guide**: Follow `src/repositories/dashboard/DashboardTaskRepository.spec.ts` and `src/repositories/common/UserRepository.spec.ts`. Create comprehensive end-to-end tests that verify complete workflow from mesocycle → microcycle → session → exercises → sets.

**Key scenarios**:
import {
WorkoutEquipmentTypeSchema,
WorkoutExerciseCalibrationSchema,
WorkoutExerciseSchema,
WorkoutMesocycleSchema,
WorkoutMicrocycleSchema,
WorkoutMuscleGroupSchema,
WorkoutSessionExerciseSchema,
WorkoutSessionSchema,
WorkoutSetSchema
} from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import DocumentService from '../../services/DocumentService.js';
import UserRepository from '../UserRepository.js';
import WorkoutEquipmentTypeRepository from './WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseCalibrationRepository from './WorkoutExerciseCalibrationRepository.js';
import WorkoutExerciseRepository from './WorkoutExerciseRepository.js';
import WorkoutMesocycleRepository from './WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from './WorkoutMicrocycleRepository.js';
import WorkoutMuscleGroupRepository from './WorkoutMuscleGroupRepository.js';
import WorkoutSessionExerciseRepository from './WorkoutSessionExerciseRepository.js';
import WorkoutSessionRepository from './WorkoutSessionRepository.js';
import WorkoutSetRepository from './WorkoutSetRepository.js';

describe('Integration Tests - Workout System', () => {
const muscleGroupRepo = WorkoutMuscleGroupRepository.getRepo();
const equipmentRepo = WorkoutEquipmentTypeRepository.getRepo();
const exerciseRepo = WorkoutExerciseRepository.getRepo();
const calibrationRepo = WorkoutExerciseCalibrationRepository.getRepo();
const mesocycleRepo = WorkoutMesocycleRepository.getRepo();
const microcycleRepo = WorkoutMicrocycleRepository.getRepo();
const sessionRepo = WorkoutSessionRepository.getRepo();
const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();
const setRepo = WorkoutSetRepository.getRepo();
const userRepo = UserRepository.getRepo();

describe('Complete Workflow', () => {
it('should create a complete workout session with all relationships', async () => {
const testUserId = DocumentService.generateID();

      // 1. Create muscle groups
      const chest = await muscleGroupRepo.insertNew(
        WorkoutMuscleGroupSchema.parse({ userId: testUserId, name: 'Chest' })
      );
      const triceps = await muscleGroupRepo.insertNew(
        WorkoutMuscleGroupSchema.parse({ userId: testUserId, name: 'Triceps' })
      );

      // 2. Create equipment
      const barbell = await equipmentRepo.insertNew(
        WorkoutEquipmentTypeSchema.parse({
          userId: testUserId,
          title: 'Barbell',
          weightOptions: [45, 135, 225]
        })
      );

      // 3. Create exercise
      const benchPress = await exerciseRepo.insertNew(
        WorkoutExerciseSchema.parse({
          userId: testUserId,
          title: 'Bench Press',
          primaryMuscleGroups: [chest!._id],
          secondaryMuscleGroups: [triceps!._id],
          equipmentId: barbell!._id
        })
      );

      // 4. Create calibration
      const calibration = await calibrationRepo.insertNew(
        WorkoutExerciseCalibrationSchema.parse({
          userId: testUserId,
          exerciseId: benchPress!._id,
          actual1RM: 225
        })
      );

      // 5. Create mesocycle and microcycle
      const mesocycle = await mesocycleRepo.insertNew(
        WorkoutMesocycleSchema.parse({
          userId: testUserId,
          title: 'Hypertrophy Block',
          numPhases: 3,
          weeksPerPhase: 4,
          deloadWeeks: 1,
          rirProgression: [3, 2, 1, 0]
        })
      );

      const microcycle = await microcycleRepo.insertNew(
        WorkoutMicrocycleSchema.parse({
          userId: testUserId,
          mesocycleId: mesocycle!._id,
          phaseNumber: 1,
          weekNumber: 1
        })
      );

      // 6. Create session
      const session = await sessionRepo.insertNew(
        WorkoutSessionSchema.parse({
          userId: testUserId,
          microcycleId: microcycle!._id,
          sessionDate: new Date('2024-01-15')
        })
      );

      // 7. Create session exercise
      const sessionExercise = await sessionExerciseRepo.insertNew(
        WorkoutSessionExerciseSchema.parse({
          userId: testUserId,
          sessionId: session!._id,
          exerciseId: benchPress!._id,
          orderNumber: 1
        })
      );

      // 8. Create sets
      const set1 = await setRepo.insertNew(
        WorkoutSetSchema.parse({
          userId: testUserId,
          sessionExerciseId: sessionExercise!._id,
          setNumber: 1,
          weight: 185,
          reps: 10,
          rir: 3
        })
      );

      const set2 = await setRepo.insertNew(
        WorkoutSetSchema.parse({
          userId: testUserId,
          sessionExerciseId: sessionExercise!._id,
          setNumber: 2,
          weight: 185,
          reps: 9,
          rir: 2
        })
      );

      // Verify all relationships
      expect(set1!.sessionExerciseId).toBe(sessionExercise!._id);
      expect(sessionExercise!.exerciseId).toBe(benchPress!._id);
      expect(benchPress!.equipmentId).toBe(barbell!._id);
      expect(session!.microcycleId).toBe(microcycle!._id);
      expect(microcycle!.mesocycleId).toBe(mesocycle!._id);

      // Cleanup - delete in reverse order
      await setRepo.delete(set1!._id);
      await setRepo.delete(set2!._id);
      await sessionExerciseRepo.delete(sessionExercise!._id);
      await sessionRepo.delete(session!._id);
      await microcycleRepo.delete(microcycle!._id);
      await mesocycleRepo.delete(mesocycle!._id);
      await calibrationRepo.delete(calibration!._id);
      await exerciseRepo.delete(benchPress!._id);
      await equipmentRepo.delete(barbell!._id);
      await muscleGroupRepo.delete(chest!._id);
      await muscleGroupRepo.delete(triceps!._id);
    });

});
});

````

---

## Part 5: Migration Scripts (if needed)

### 5.1 Create Workout Data Migration Script

**Path**: `scripts/migrateWorkoutData.ts`

```typescript
import WorkoutEquipmentTypeRepository from '../src/repositories/workout/WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseCalibrationRepository from '../src/repositories/workout/WorkoutExerciseCalibrationRepository.js';
import WorkoutExerciseRepository from '../src/repositories/workout/WorkoutExerciseRepository.js';
import WorkoutMesocycleRepository from '../src/repositories/workout/WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from '../src/repositories/workout/WorkoutMicrocycleRepository.js';
import WorkoutMuscleGroupRepository from '../src/repositories/workout/WorkoutMuscleGroupRepository.js';
import WorkoutSessionExerciseRepository from '../src/repositories/workout/WorkoutSessionExerciseRepository.js';
import WorkoutSessionRepository from '../src/repositories/workout/WorkoutSessionRepository.js';
import WorkoutSetRepository from '../src/repositories/workout/WorkoutSetRepository.js';

/**
 * Migration script for workout data.
 * Add any necessary data migrations here.
 */
async function migrateWorkoutData() {
  console.log('Starting workout data migration...');

  // Initialize all repositories to ensure indexes are created
  WorkoutMuscleGroupRepository.getRepo();
  WorkoutEquipmentTypeRepository.getRepo();
  WorkoutExerciseRepository.getRepo();
  WorkoutExerciseCalibrationRepository.getRepo();
  WorkoutMesocycleRepository.getRepo();
  WorkoutMicrocycleRepository.getRepo();
  WorkoutSessionRepository.getRepo();
  WorkoutSessionExerciseRepository.getRepo();
  WorkoutSetRepository.getRepo();

  console.log('All workout repositories initialized.');

  // Add specific migration logic here if needed
  // For example:
  // - Backfill missing fields
  // - Update document structures
  // - Clean up orphaned data

  console.log('Workout data migration complete.');
}

migrateWorkoutData().catch(console.error);
````

---

## Verification Steps

1. **Run type checking**:

   ```bash
   cd packages/be-ts-db-lib
   pnpm check
   ```

2. **Run all workout tests**:

   ```bash
   pnpm test workout
   ```

3. **Run integration tests**:

   ```bash
   pnpm test workout-integration
   ```

4. **Lint**:

   ```bash
   pnpm lint
   ```

5. **Full test suite**:

   ```bash
   pnpm test
   ```

6. **Test user deletion cleanup** (manual verification):
   - Create a test user with workout data
   - Delete the user
   - Verify all workout documents are deleted

---

## Acceptance Criteria

- [ ] All workout repositories and validators exported from index.ts
- [ ] All repositories have static getListenersForUserRepo() methods
- [ ] UserRepository subscribes to all workout repositories via getListenersForUserRepo()
- [ ] Integration test suite passes
- [ ] Migration script exists and runs without errors
- [ ] `pnpm check` passes without errors
- [ ] `pnpm lint` passes without errors
- [ ] All tests pass (including integration tests)
- [ ] User deletion properly cascades to all workout data via listener pattern

---

## Final Notes

### System Architecture Summary

The workout tracking system consists of:

1. **Foundation Layer** (Phase 1):
   - WorkoutBaseRepository
   - WorkoutBaseWithUserIdRepository

2. **Simple Data Layer** (Phase 2):
   - WorkoutMuscleGroup
   - WorkoutEquipmentType

3. **Exercise Layer** (Phase 3):
   - WorkoutExercise (with muscle group and equipment references)
   - WorkoutExerciseCalibration (with exercise references)

4. **Planning Layer** (Phase 4):
   - WorkoutMesocycle (training blocks)
   - WorkoutMicrocycle (weekly cycles)

5. **Execution Layer** (Phase 5):
   - WorkoutSession (actual training sessions)
   - WorkoutSessionExercise (exercises in sessions)
   - WorkoutSet (individual sets)

### Key Features Implemented

- ✅ Automatic timestamp management (createdDate, lastUpdatedDate)
- ✅ User-scoped data access
- ✅ Multi-level cascading deletes
- ✅ Foreign key validation
- ✅ User deletion cleanup via getListenersForUserRepo pattern
- ✅ Comprehensive test coverage
- ✅ Singleton repository pattern
- ✅ Proper error handling with ErrorUtils

### Next Steps (Beyond This Implementation)

Consider implementing:

- Custom analytics queries for workout statistics
- Bulk operations for session creation
- Performance tracking dashboards
- Workout program templates
- Exercise library presets
- Progressive overload calculations
- Volume tracking and fatigue management
