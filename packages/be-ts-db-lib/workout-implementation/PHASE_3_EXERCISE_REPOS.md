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

    // Validate muscle group references
    if (newExercise.primaryMuscleGroups && newExercise.primaryMuscleGroups.length > 0) {
      await this.validateMuscleGroupReferences(
        newExercise.primaryMuscleGroups,
        newExercise.userId,
        'Primary muscle groups',
        errors
      );
    }

    if (newExercise.secondaryMuscleGroups && newExercise.secondaryMuscleGroups.length > 0) {
      await this.validateMuscleGroupReferences(
        newExercise.secondaryMuscleGroups,
        newExercise.userId,
        'Secondary muscle groups',
        errors
      );
    }

    // Validate equipment reference if provided
    if (newExercise.equipmentId) {
      const equipment = await WorkoutEquipmentTypeRepository.getRepo().get({
        _id: newExercise.equipmentId
      });

      if (!equipment) {
        errors.push(`Equipment with ID ${newExercise.equipmentId} does not exist.`);
      } else if (equipment.userId !== newExercise.userId) {
        errors.push('Equipment must belong to the same user as the exercise.');
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

    // Get existing exercise to access userId
    if (updatedExercise._id) {
      const existing = await WorkoutExerciseRepository.getRepo().get({
        _id: updatedExercise._id
      });

      if (!existing) {
        errors.push('Exercise not found.');
        throw new Error(errors.join(', '));
      }

      const userId = existing.userId;

      // Validate muscle group references if being updated
      if (updatedExercise.primaryMuscleGroups !== undefined) {
        await this.validateMuscleGroupReferences(
          updatedExercise.primaryMuscleGroups,
          userId,
          'Primary muscle groups',
          errors
        );
      }

      if (updatedExercise.secondaryMuscleGroups !== undefined) {
        await this.validateMuscleGroupReferences(
          updatedExercise.secondaryMuscleGroups,
          userId,
          'Secondary muscle groups',
          errors
        );
      }

      // Validate equipment reference if being updated
      if (updatedExercise.equipmentId !== undefined && updatedExercise.equipmentId !== null) {
        const equipment = await WorkoutEquipmentTypeRepository.getRepo().get({
          _id: updatedExercise.equipmentId
        });

        if (!equipment) {
          errors.push(`Equipment with ID ${updatedExercise.equipmentId} does not exist.`);
        } else if (equipment.userId !== userId) {
          errors.push('Equipment must belong to the same user as the exercise.');
        }
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedExercise);
    }
  }

  private async validateMuscleGroupReferences(
    muscleGroupIds: string[],
    userId: string,
    fieldName: string,
    errors: string[]
  ): Promise<void> {
    for (const mgId of muscleGroupIds) {
      const muscleGroup = await WorkoutMuscleGroupRepository.getRepo().get({ _id: mgId });

      if (!muscleGroup) {
        errors.push(`${fieldName}: Muscle group with ID ${mgId} does not exist.`);
      } else if (muscleGroup.userId !== userId) {
        errors.push(`${fieldName}: Muscle group must belong to the same user as the exercise.`);
      }
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    // Could add validation to check for orphaned references
  }
}

// Import the repository to avoid circular dependency issues
import WorkoutExerciseRepository from '../../repositories/workout/WorkoutExerciseRepository.js';
```

### 1.2 WorkoutExerciseRepository

**Path**: `src/repositories/workout/WorkoutExerciseRepository.ts`

```typescript
import type { WorkoutExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutExercise_docType } from '@aneuhold/core-ts-db-lib';
import CleanDocument from '../../util/DocumentCleaner.js';
import WorkoutExerciseValidator from '../../validators/workout/ExerciseValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutExerciseCalibrationRepository from './WorkoutExerciseCalibrationRepository.js';

/**
 * The repository that contains {@link WorkoutExercise} documents.
 */
export default class WorkoutExerciseRepository extends WorkoutBaseWithUserIdRepository<WorkoutExercise> {
  private static singletonInstance?: WorkoutExerciseRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(WorkoutExercise_docType, new WorkoutExerciseValidator());
  }

  protected setupSubscribers(): void {
    // Subscribe to delete events to cascade to calibrations
    this.deleteSubject.subscribe(async (metadata) => {
      // When an exercise is deleted, also delete its calibrations
      const calibrationRepo = WorkoutExerciseCalibrationRepository.getRepo();
      const calibrations = await calibrationRepo.getAll({
        exerciseId: metadata.documentId
      });

      for (const calibration of calibrations) {
        await calibrationRepo.delete(calibration._id);
      }
    });
  }

  /**
   * Gets the singleton instance of the {@link WorkoutExerciseRepository}.
   *
   * @returns The singleton instance of the repository.
   */
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
    const errors: string[] = [];

    // Validate exercise reference
    const exercise = await WorkoutExerciseRepository.getRepo().get({
      _id: newCalibration.exerciseId
    });

    if (!exercise) {
      errors.push(`Exercise with ID ${newCalibration.exerciseId} does not exist.`);
    } else if (exercise.userId !== newCalibration.userId) {
      errors.push('Exercise must belong to the same user as the calibration.');
    }

    // Validate actual1RM is positive
    if (newCalibration.actual1RM <= 0) {
      errors.push('Actual 1RM must be a positive number.');
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newCalibration);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedCalibration: Partial<WorkoutExerciseCalibration>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedCalibration._id) {
      errors.push('No _id defined for WorkoutExerciseCalibration update.');
    }

    // Validate actual1RM if being updated
    if (updatedCalibration.actual1RM !== undefined && updatedCalibration.actual1RM <= 0) {
      errors.push('Actual 1RM must be a positive number.');
    }

    // Note: exerciseId should not be changed after creation
    // If needed, create a new calibration instead

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    // Could add validation to check for orphaned calibrations
  }
}
```

### 2.2 WorkoutExerciseCalibrationRepository

**Path**: `src/repositories/workout/WorkoutExerciseCalibrationRepository.ts`

```typescript
import type { WorkoutExerciseCalibration } from '@aneuhold/core-ts-db-lib';
import { WorkoutExerciseCalibration_docType } from '@aneuhold/core-ts-db-lib';
import CleanDocument from '../../util/DocumentCleaner.js';
import WorkoutExerciseCalibrationValidator from '../../validators/workout/ExerciseCalibrationValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutExerciseCalibration} documents.
 */
export default class WorkoutExerciseCalibrationRepository extends WorkoutBaseWithUserIdRepository<WorkoutExerciseCalibration> {
  private static singletonInstance?: WorkoutExerciseCalibrationRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(WorkoutExerciseCalibration_docType, new WorkoutExerciseCalibrationValidator());
  }

  protected setupSubscribers(): void {
    // No subscribers needed for calibrations
  }

  /**
   * Gets all calibrations for a specific exercise.
   */
  async getAllForExercise(exerciseId: string): Promise<WorkoutExerciseCalibration[]> {
    return this.getAll({ exerciseId });
  }

  /**
   * Gets the singleton instance of the {@link WorkoutExerciseCalibrationRepository}.
   *
   * @returns The singleton instance of the repository.
   */
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
