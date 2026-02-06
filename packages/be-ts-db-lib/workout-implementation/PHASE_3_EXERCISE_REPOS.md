# Phase 3: Exercise and Calibration Repositories

## Prerequisites

- Phase 1 and Phase 2 completed successfully
- WorkoutMuscleGroupRepository and WorkoutEquipmentTypeRepository exist and work
- Base classes available

## Objectives

1. Implement WorkoutExerciseRepository with validator and tests
2. Implement WorkoutExerciseCalibrationRepository with validator and tests
3. Validate foreign key references to MuscleGroup and EquipmentType
4. Handle cascading deletes for calibrations when exercises are deleted

## Context

- **WorkoutExercise**: Exercises reference muscle groups and equipment
- **WorkoutExerciseCalibration**: Calibration data for specific exercises
- Both are user-owned and extend `BaseDocumentWithType & BaseDocumentWithUpdatedAndCreatedDates & RequiredUserId`

---

## Part 1: WorkoutExercise

### 1.1 WorkoutExerciseValidator

**Path**: `src/validators/workout/ExerciseValidator.ts`

```typescript
import type { WorkoutExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutExerciseSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import WorkoutEquipmentTypeRepository from '../../repositories/workout/WorkoutEquipmentTypeRepository.js';
import WorkoutMuscleGroupRepository from '../../repositories/workout/WorkoutMuscleGroupRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutExerciseValidator extends IValidator<WorkoutExercise> {
  constructor() {
    super(WorkoutExerciseSchema, WorkoutExerciseSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(newExercise: WorkoutExercise): Promise<void> {
    const errors: string[] = [];

    // Validate muscle groups exist
    if (newExercise.muscleGroups.length > 0) {
      const muscleGroupRepo = WorkoutMuscleGroupRepository.getRepo();
      const muscleGroups = await muscleGroupRepo.getList(newExercise.muscleGroups);
      if (muscleGroups.length !== newExercise.muscleGroups.length) {
        errors.push(
          `Not all muscle groups exist. Found: ${muscleGroups.length}, expected: ${newExercise.muscleGroups.length}`
        );
      }
    }

    // Validate equipment types exist if provided
    if (newExercise.equipmentTypes && newExercise.equipmentTypes.length > 0) {
      const equipmentRepo = WorkoutEquipmentTypeRepository.getRepo();
      const equipmentTypes = await equipmentRepo.getList(newExercise.equipmentTypes);
      if (equipmentTypes.length !== newExercise.equipmentTypes.length) {
        errors.push(
          `Not all equipment types exist. Found: ${equipmentTypes.length}, expected: ${newExercise.equipmentTypes.length}`
        );
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newExercise);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedExercise: Partial<WorkoutExercise>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedExercise._id) {
      errors.push('No _id defined for WorkoutExercise update.');
    }

    // Validate muscle groups if being updated
    if (updatedExercise.muscleGroups && updatedExercise.muscleGroups.length > 0) {
      const muscleGroupRepo = WorkoutMuscleGroupRepository.getRepo();
      const muscleGroups = await muscleGroupRepo.getList(updatedExercise.muscleGroups);
      if (muscleGroups.length !== updatedExercise.muscleGroups.length) {
        errors.push(
          `Not all muscle groups exist. Found: ${muscleGroups.length}, expected: ${updatedExercise.muscleGroups.length}`
        );
      }
    }

    // Validate equipment types if being updated
    if (updatedExercise.equipmentTypes && updatedExercise.equipmentTypes.length > 0) {
      const equipmentRepo = WorkoutEquipmentTypeRepository.getRepo();
      const equipmentTypes = await equipmentRepo.getList(updatedExercise.equipmentTypes);
      if (equipmentTypes.length !== updatedExercise.equipmentTypes.length) {
        errors.push(
          `Not all equipment types exist. Found: ${equipmentTypes.length}, expected: ${updatedExercise.equipmentTypes.length}`
        );
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedExercise);
    }
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
```

### 1.2 WorkoutExerciseRepository

**Path**: `src/repositories/workout/WorkoutExerciseRepository.ts`

```typescript
import type { User, WorkoutExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutExercise_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutExerciseValidator from '../../validators/workout/ExerciseValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutExerciseCalibrationRepository from './WorkoutExerciseCalibrationRepository.js';

/**
 * The repository that contains {@link WorkoutExercise} documents.
 */
export default class WorkoutExerciseRepository extends WorkoutBaseWithUserIdRepository<WorkoutExercise> {
  private static singletonInstance?: WorkoutExerciseRepository;

  private constructor() {
    super(WorkoutExercise_docType, new WorkoutExerciseValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const exerciseRepo = WorkoutExerciseRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await exerciseRepo.getCollection()
        ).deleteMany({
          userId,
          docType: WorkoutExercise_docType
        });
        meta?.recordDocTypeTouched(WorkoutExercise_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await exerciseRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: WorkoutExercise_docType
        });
        meta?.recordDocTypeTouched(WorkoutExercise_docType);
        meta?.addAffectedUserIds(userIds);
      }
    };
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(WorkoutExerciseCalibrationRepository.getListenersForUserRepo());
  }

  public static getRepo(): WorkoutExerciseRepository {
    if (!WorkoutExerciseRepository.singletonInstance) {
      WorkoutExerciseRepository.singletonInstance = new WorkoutExerciseRepository();
    }
    return WorkoutExerciseRepository.singletonInstance;
  }
}
```

### 1.3 WorkoutExerciseRepository Tests

**Path**: `src/repositories/workout/WorkoutExerciseRepository.spec.ts`

**Implementation Guide**: Follow the test patterns from `src/repositories/dashboard/DashboardTaskRepository.spec.ts`. Your tests should:

- Create a test user with `getTestUserName()`
- Create test muscle groups and equipment as needed
- Use proper null checks (no `!` assertions)
- Clean up with `cleanupDoc(userRepo, user)` which cascades to all user data
- Test foreign key validation (exercise references to muscle groups and equipment)
- Test cascading deletes (deleting exercise should delete calibrations)

**Key test scenarios**:

- Insert exercise with muscle groups and equipment
- Insert exercise without equipment
- Update exercise properties
- Validate muscle group references
- Validate equipment references

---

## Part 2: WorkoutExerciseCalibration

### 2.1 WorkoutExerciseCalibrationValidator

**Path**: `src/validators/workout/ExerciseCalibrationValidator.ts`

```typescript
import type { WorkoutExerciseCalibration } from '@aneuhold/core-ts-db-lib';
import { WorkoutExerciseCalibrationSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import WorkoutExerciseRepository from '../../repositories/workout/WorkoutExerciseRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutExerciseCalibrationValidator extends IValidator<WorkoutExerciseCalibration> {
  constructor() {
    super(WorkoutExerciseCalibrationSchema, WorkoutExerciseCalibrationSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(
    newCalibration: WorkoutExerciseCalibration
  ): Promise<void> {
    // Validate that the exercise exists
    const exerciseRepo = WorkoutExerciseRepository.getRepo();
    const exercise = await exerciseRepo.get({ _id: newCalibration.exerciseId });
    if (!exercise) {
      ErrorUtils.throwError(
        `Exercise with ID ${newCalibration.exerciseId} does not exist`,
        newCalibration
      );
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedCalibration: Partial<WorkoutExerciseCalibration>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedCalibration._id) {
      errors.push('No _id defined for WorkoutExerciseCalibration update.');
    }

    // Validate exercise if being updated
    if (updatedCalibration.exerciseId) {
      const exerciseRepo = WorkoutExerciseRepository.getRepo();
      const exercise = await exerciseRepo.get({ _id: updatedCalibration.exerciseId });
      if (!exercise) {
        errors.push(`Exercise with ID ${updatedCalibration.exerciseId} does not exist`);
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedCalibration);
    }
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
```

### 2.2 WorkoutExerciseCalibrationRepository

**Path**: `src/repositories/workout/WorkoutExerciseCalibrationRepository.ts`

```typescript
import type { User, WorkoutExerciseCalibration } from '@aneuhold/core-ts-db-lib';
import { WorkoutExerciseCalibration_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutExerciseCalibrationValidator from '../../validators/workout/ExerciseCalibrationValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutExerciseCalibration} documents.
 */
export default class WorkoutExerciseCalibrationRepository extends WorkoutBaseWithUserIdRepository<WorkoutExerciseCalibration> {
  private static singletonInstance?: WorkoutExerciseCalibrationRepository;

  private constructor() {
    super(WorkoutExerciseCalibration_docType, new WorkoutExerciseCalibrationValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const calibrationRepo = WorkoutExerciseCalibrationRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await calibrationRepo.getCollection()
        ).deleteMany({
          userId,
          docType: WorkoutExerciseCalibration_docType
        });
        meta?.recordDocTypeTouched(WorkoutExerciseCalibration_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await calibrationRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: WorkoutExerciseCalibration_docType
        });
        meta?.recordDocTypeTouched(WorkoutExerciseCalibration_docType);
        meta?.addAffectedUserIds(userIds);
      }
    };
  }

  protected setupSubscribers(): void {}

  public static getRepo(): WorkoutExerciseCalibrationRepository {
    if (!WorkoutExerciseCalibrationRepository.singletonInstance) {
      WorkoutExerciseCalibrationRepository.singletonInstance =
        new WorkoutExerciseCalibrationRepository();
    }
    return WorkoutExerciseCalibrationRepository.singletonInstance;
  }
}
```

### 2.3 WorkoutExerciseCalibrationRepository Tests

**Path**: `src/repositories/workout/WorkoutExerciseCalibrationRepository.spec.ts`

**Implementation Guide**: Follow `src/repositories/dashboard/DashboardTaskRepository.spec.ts`. Test calibration CRUD, exercise references, and proper null checks. See existing test files for complete examples.

**Key scenarios**: Create calibration, update calibration, validate exercise reference, test cascading deletes.

---

## Verification Steps

1. **Run type checking**:

   ```bash
   cd packages/be-ts-db-lib
   pnpm check
   ```

2. **Run tests**:

   ```bash
   pnpm test WorkoutExerciseRepository
   pnpm test WorkoutExerciseCalibrationRepository
   ```

3. **Run all workout tests**:

   ```bash
   pnpm test workout
   ```

4. **Lint**:
   ```bash
   pnpm lint
   ```

## Acceptance Criteria

- [ ] WorkoutExerciseValidator compiles and validates muscle group/equipment references
- [ ] WorkoutExerciseRepository compiles and all tests pass
- [ ] Foreign key validation works for muscle groups and equipment
- [ ] WorkoutExerciseCalibrationValidator compiles and validates exercise references
- [ ] WorkoutExerciseCalibrationRepository compiles and all tests pass
- [ ] Cascading deletes work: deleting an exercise deletes its calibrations
- [ ] Tests use proper null checks (no `!` assertions)
- [ ] `pnpm check` passes without errors
- [ ] All tests pass

## Notes for Next Phase

- Phase 4 will implement mesocycle and microcycle repositories
- These have complex relationships between each other
- Microcycles reference mesocycles
- Will need validation for phase/week progression logic
