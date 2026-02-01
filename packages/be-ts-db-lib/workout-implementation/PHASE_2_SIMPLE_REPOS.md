# Phase 2: Simple Repositories - MuscleGroup and EquipmentType

## Prerequisites

- Phase 1 completed successfully
- `WorkoutBaseRepository` and `WorkoutBaseWithUserIdRepository` exist and compile
- Directory structure created

## Objectives

1. Implement WorkoutMuscleGroupRepository with validator and tests
2. Implement WorkoutEquipmentTypeRepository with validator and tests
3. Verify both repositories work correctly with CRUD operations

## Context

These are the simplest workout documents with minimal dependencies:

- **WorkoutMuscleGroup**: Simple user-owned muscle group definitions
- **WorkoutEquipmentType**: Equipment definitions with optional weight options

Both extend `BaseDocumentWithType & BaseDocumentWithUpdatedAndCreatedDates & RequiredUserId`.

---

## Part 1: WorkoutMuscleGroup

### 1.1 WorkoutMuscleGroupValidator

**Path**: `src/validators/workout/MuscleGroupValidator.ts`

```typescript
import type { WorkoutMuscleGroup } from '@aneuhold/core-ts-db-lib';
import { WorkoutMuscleGroupSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import IValidator from '../BaseValidator.js';

export default class WorkoutMuscleGroupValidator extends IValidator<WorkoutMuscleGroup> {
  constructor() {
    super(WorkoutMuscleGroupSchema, WorkoutMuscleGroupSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(
    newMuscleGroup: WorkoutMuscleGroup
  ): Promise<void> {
    // Schema validation handles all required fields
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedMuscleGroup: Partial<WorkoutMuscleGroup>
  ): Promise<void> {
    if (!updatedMuscleGroup._id) {
      ErrorUtils.throwError('No _id defined for WorkoutMuscleGroup update.', updatedMuscleGroup);
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    // Repository validation can be implemented later if needed
  }
}
```

### 1.2 WorkoutMuscleGroupRepository

**Path**: `src/repositories/workout/WorkoutMuscleGroupRepository.ts`

```typescript
import type { WorkoutMuscleGroup } from '@aneuhold/core-ts-db-lib';
import { WorkoutMuscleGroup_docType } from '@aneuhold/core-ts-db-lib';
import CleanDocument from '../../util/DocumentCleaner.js';
import WorkoutMuscleGroupValidator from '../../validators/workout/MuscleGroupValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutMuscleGroup} documents.
 */
export default class WorkoutMuscleGroupRepository extends WorkoutBaseWithUserIdRepository<WorkoutMuscleGroup> {
  private static singletonInstance?: WorkoutMuscleGroupRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(WorkoutMuscleGroup_docType, new WorkoutMuscleGroupValidator());
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link WorkoutMuscleGroupRepository}.
   */
  public static getRepo(): WorkoutMuscleGroupRepository {
    if (!WorkoutMuscleGroupRepository.singletonInstance) {
      WorkoutMuscleGroupRepository.singletonInstance = new WorkoutMuscleGroupRepository();
    }
    return WorkoutMuscleGroupRepository.singletonInstance;
  }
}
```

### 1.3 WorkoutMuscleGroupRepository Tests

**Path**: `src/repositories/workout/WorkoutMuscleGroupRepository.spec.ts`

```typescript
import { WorkoutMuscleGroupSchema } from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import DocumentService from '../../services/DocumentService.js';
import WorkoutMuscleGroupRepository from './WorkoutMuscleGroupRepository.js';

describe('WorkoutMuscleGroupRepository', () => {
  const repo = WorkoutMuscleGroupRepository.getRepo();
  const testUserId = DocumentService.generateID();

  describe('Basic CRUD Operations', () => {
    it('should insert a new muscle group', async () => {
      const newMuscleGroup = WorkoutMuscleGroupSchema.parse({
        userId: testUserId,
        name: 'Test Quadriceps'
      });

      const result = await repo.insertNew(newMuscleGroup);
      if (!result) {
        throw new Error('Failed to insert muscle group');
      }

      expect(result._id).toBeDefined();
      expect(result.name).toBe('Test Quadriceps');
      expect(result.userId).toBe(testUserId);
      expect(result.createdDate).toBeInstanceOf(Date);
      expect(result.lastUpdatedDate).toBeInstanceOf(Date);
      expect(result.docType).toBe('workoutMuscleGroup');

      // Cleanup
      await repo.delete(result._id);
    });

    it('should get all muscle groups for a user', async () => {
      const muscleGroup1 = await repo.insertNew(
        WorkoutMuscleGroupSchema.parse({
          userId: testUserId,
          name: 'Chest'
        })
      );

      const muscleGroup2 = await repo.insertNew(
        WorkoutMuscleGroupSchema.parse({
          userId: testUserId,
          name: 'Back'
        })
      );

      if (!muscleGroup1 || !muscleGroup2) {
        throw new Error('Failed to insert muscle groups');
      }

      const allMuscleGroups = await repo.getAllForUser(testUserId);

      expect(allMuscleGroups.length).toBeGreaterThanOrEqual(2);
      const ids = allMuscleGroups.map((mg) => mg._id);
      expect(ids).toContain(muscleGroup1._id);
      expect(ids).toContain(muscleGroup2._id);

      // Cleanup
      await repo.delete(muscleGroup1._id);
      await repo.delete(muscleGroup2._id);
    });

    it('should update a muscle group', async () => {
      const muscleGroup = await repo.insertNew(
        WorkoutMuscleGroupSchema.parse({
          userId: testUserId,
          name: 'Shoulders'
        })
      );

      if (!muscleGroup) {
        throw new Error('Failed to insert muscle group');
      }

      await repo.update({
        _id: muscleGroup._id,
        name: 'Updated Shoulders'
      });

      const updated = await repo.get({ _id: muscleGroup._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated muscle group');
      }

      expect(updated.name).toBe('Updated Shoulders');

      // Cleanup
      await repo.delete(muscleGroup._id);
    });

    it('should delete a muscle group', async () => {
      const muscleGroup = await repo.insertNew(
        WorkoutMuscleGroupSchema.parse({
          userId: testUserId,
          name: 'Biceps'
        })
      );

      if (!muscleGroup) {
        throw new Error('Failed to insert muscle group');
      }

      await repo.delete(muscleGroup._id);

      const retrieved = await repo.get({ _id: muscleGroup._id });
      expect(retrieved).toBeNull();
    });
  });

  describe('Validation', () => {
    it('should reject muscle group without name', async () => {
      expect(() =>
        WorkoutMuscleGroupSchema.parse({
          userId: testUserId,
          name: ''
        })
      ).toThrow();
    });

    it('should reject update without _id', async () => {
      await expect(
        repo.update({
          name: 'Test'
        })
      ).rejects.toThrow();
    });
  });
});
```

---

## Part 2: WorkoutEquipmentType

### 2.1 WorkoutEquipmentTypeValidator

**Path**: `src/validators/workout/EquipmentTypeValidator.ts`

```typescript
import type { WorkoutEquipmentType } from '@aneuhold/core-ts-db-lib';
import { WorkoutEquipmentTypeSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import IValidator from '../BaseValidator.js';

export default class WorkoutEquipmentTypeValidator extends IValidator<WorkoutEquipmentType> {
  constructor() {
    super(WorkoutEquipmentTypeSchema, WorkoutEquipmentTypeSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(
    newEquipmentType: WorkoutEquipmentType
  ): Promise<void> {
    const errors: string[] = [];

    if (newEquipmentType.weightOptions?.length) {
      const weights = newEquipmentType.weightOptions;
      if (weights.some((w) => w < 0)) {
        errors.push('Weight options must be positive numbers.');
      }
      const uniqueWeights = new Set(weights);
      if (uniqueWeights.size !== weights.length) {
        errors.push('Weight options must be unique.');
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newEquipmentType);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedEquipmentType: Partial<WorkoutEquipmentType>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedEquipmentType._id) {
      errors.push('No _id defined for WorkoutEquipmentType update.');
    }

    if (updatedEquipmentType.weightOptions?.length) {
      const weights = updatedEquipmentType.weightOptions;
      if (weights.some((w) => w < 0)) {
        errors.push('Weight options must be positive numbers.');
      }
      const uniqueWeights = new Set(weights);
      if (uniqueWeights.size !== weights.length) {
        errors.push('Weight options must be unique.');
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedEquipmentType);
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {}
}
```

### 2.2 WorkoutEquipmentTypeRepository

**Path**: `src/repositories/workout/WorkoutEquipmentTypeRepository.ts`

```typescript
import type { WorkoutEquipmentType } from '@aneuhold/core-ts-db-lib';
import { WorkoutEquipmentType_docType } from '@aneuhold/core-ts-db-lib';
import CleanDocument from '../../util/DocumentCleaner.js';
import WorkoutEquipmentTypeValidator from '../../validators/workout/EquipmentTypeValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutEquipmentType} documents.
 */
export default class WorkoutEquipmentTypeRepository extends WorkoutBaseWithUserIdRepository<WorkoutEquipmentType> {
  private static singletonInstance?: WorkoutEquipmentTypeRepository;

  private constructor() {
    super(WorkoutEquipmentType_docType, new WorkoutEquipmentTypeValidator());
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link WorkoutEquipmentTypeRepository}.
   */
  public static getRepo(): WorkoutEquipmentTypeRepository {
   */
  public static getRepo(): WorkoutEquipmentTypeRepository {
    if (!WorkoutEquipmentTypeRepository.singletonInstance) {
      WorkoutEquipmentTypeRepository.singletonInstance = new WorkoutEquipmentTypeRepository();
    }
    return WorkoutEquipmentTypeRepository.singletonInstance;
  }
}
```

### 2.3 WorkoutEquipmentTypeRepository Tests

**Path**: `src/repositories/workout/WorkoutEquipmentTypeRepository.spec.ts`

```typescript
import { WorkoutEquipmentTypeSchema } from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import DocumentService from '../../services/DocumentService.js';
import WorkoutEquipmentTypeRepository from './WorkoutEquipmentTypeRepository.ts';

describe('WorkoutEquipmentTypeRepository', () => {
  const repo = WorkoutEquipmentTypeRepository.getRepo();
  const testUserId = DocumentService.generateID();

  describe('Basic CRUD Operations', () => {
    it('should insert a new equipment type with weight options', async () => {
      const newEquipment = WorkoutEquipmentTypeSchema.parse({
        userId: testUserId,
        title: 'Barbell',
        weightOptions: [45, 55, 65, 75, 85]
      });

      const result = await repo.insertNew(newEquipment);
      if (!result) {
        throw new Error('Failed to insert equipment');
      }

      expect(result._id).toBeDefined();
      expect(result.title).toBe('Barbell');
      expect(result.weightOptions).toEqual([45, 55, 65, 75, 85]);
      expect(result.docType).toBe('workoutEquipmentType');

      // Cleanup
      await repo.delete(result._id);
    });

    it('should insert equipment type without weight options', async () => {
      const newEquipment = WorkoutEquipmentTypeSchema.parse({
        userId: testUserId,
        title: 'Bodyweight'
      });

      const result = await repo.insertNew(newEquipment);
      if (!result) {
        throw new Error('Failed to insert equipment');
      }

      expect(result.weightOptions).toBeUndefined();

      // Cleanup
      await repo.delete(result._id);
    });

    it('should update equipment type and modify weight options', async () => {
      const equipment = await repo.insertNew(
        WorkoutEquipmentTypeSchema.parse({
          userId: testUserId,
          title: 'Dumbbell',
          weightOptions: [10, 20, 30]
        })
      );

      if (!equipment) {
        throw new Error('Failed to insert equipment');
      }

      await repo.update({
        _id: equipment._id,
        weightOptions: [10, 15, 20, 25, 30]
      });

      const updated = await repo.get({ _id: equipment._id });
      if (!updated) {
        throw new Error('Failed to retrieve updated equipment');
      }

      expect(updated.weightOptions).toEqual([10, 15, 20, 25, 30]);

      // Cleanup
      await repo.delete(equipment._id);
    });
  });

  describe('Validation', () => {
    it('should reject negative weight options', async () => {
      const invalidEquipment = WorkoutEquipmentTypeSchema.parse({
        userId: testUserId,
        title: 'Test',
        weightOptions: [10, -5, 20]
      });

      await expect(repo.insertNew(invalidEquipment)).rejects.toThrow();
    });

    it('should reject duplicate weight options', async () => {
      const invalidEquipment = WorkoutEquipmentTypeSchema.parse({
        userId: testUserId,
        title: 'Test',
        weightOptions: [10, 20, 10]
      });

      await expect(repo.insertNew(invalidEquipment)).rejects.toThrow();
    });

    it('should reject equipment type without title', async () => {
      expect(() =>
        WorkoutEquipmentTypeSchema.parse({
          userId: testUserId,
          title: ''
        })
      ).toThrow();
    });
  });
});
```

---

## Verification Steps

1. **Run type checking**:

   ```bash
   cd packages/be-ts-db-lib
   pnpm check
   ```

2. **Run tests**:

   ```bash
   pnpm test WorkoutMuscleGroupRepository
   pnpm test WorkoutEquipmentTypeRepository
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

- [ ] WorkoutMuscleGroupValidator compiles and passes validation tests
- [ ] WorkoutMuscleGroupRepository compiles and all tests pass
- [ ] WorkoutEquipmentTypeValidator compiles and validates weight options correctly
- [ ] WorkoutEquipmentTypeRepository compiles and all tests pass
- [ ] Both repositories properly set `createdDate` and `lastUpdatedDate`
- [ ] User-scoped queries (`getAllForUser`) work correctly
- [ ] `pnpm check` passes without errors
- [ ] All tests pass

## Notes for Next Phase

- Phase 3 will implement WorkoutExercise and WorkoutExerciseCalibration
- These have dependencies on MuscleGroup and EquipmentType
- Will need to validate foreign key references
- Exercise deletion will need cascade logic for calibrations
