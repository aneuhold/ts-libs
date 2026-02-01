# Phase 4: Mesocycle and Microcycle Repositories

## Prerequisites

- Phases 1-3 completed successfully
- All exercise and calibration repositories working
- Base classes available

## Objectives

1. Implement WorkoutMesocycleRepository with validator and tests
2. Implement WorkoutMicrocycleRepository with validator and tests
3. Validate parent-child relationships between mesocycles and microcycles
4. Handle cascading deletes for microcycles when mesocycles are deleted

## Context

- **WorkoutMesocycle**: Training blocks (e.g., 4-6 weeks) with progression plans
- **WorkoutMicrocycle**: Weekly training cycles within a mesocycle
- Microcycles reference their parent mesocycle
- Mesocycles use MEV/MRV progression and RIR schemes

---

## Part 1: WorkoutMesocycle

### 1.1 WorkoutMesocycleValidator

**Path**: `src/validators/workout/MesocycleValidator.ts`

```typescript
import type { WorkoutMesocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMesocycleSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import IValidator from '../BaseValidator.js';

export default class WorkoutMesocycleValidator extends IValidator<WorkoutMesocycle> {
  constructor() {
    super(WorkoutMesocycleSchema, WorkoutMesocycleSchema.partial());
  }

  protected validateNewObjectBusinessLogic(): Promise<void> {
    return Promise.resolve();
  }

  protected validateUpdateObjectBusinessLogic(
    updatedMesocycle: Partial<WorkoutMesocycle>
  ): Promise<void> {
    if (!updatedMesocycle._id) {
      ErrorUtils.throwError('No _id defined for WorkoutMesocycle update.', updatedMesocycle);
    }
    return Promise.resolve();
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
```

### 1.2 WorkoutMesocycleRepository

**Path**: `src/repositories/workout/WorkoutMesocycleRepository.ts`

```typescript
import type { User, WorkoutMesocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMesocycle_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutMesocycleValidator from '../../validators/workout/MesocycleValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutMicrocycleRepository from './WorkoutMicrocycleRepository.js';

/**
 * The repository that contains {@link WorkoutMesocycle} documents.
 */
export default class WorkoutMesocycleRepository extends WorkoutBaseWithUserIdRepository<WorkoutMesocycle> {
  private static singletonInstance?: WorkoutMesocycleRepository;

  private constructor() {
    super(WorkoutMesocycle_docType, new WorkoutMesocycleValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const mesocycleRepo = WorkoutMesocycleRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await mesocycleRepo.getCollection()
        ).deleteMany({
          userId,
          docType: WorkoutMesocycle_docType
        });
        meta?.recordDocTypeTouched(WorkoutMesocycle_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await mesocycleRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: WorkoutMesocycle_docType
        });
        meta?.recordDocTypeTouched(WorkoutMesocycle_docType);
        meta?.addAffectedUserIds(userIds);
      }
    };
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(WorkoutMicrocycleRepository.getListenersForUserRepo());
  }

  public static getRepo(): WorkoutMesocycleRepository {
    if (!WorkoutMesocycleRepository.singletonInstance) {
      WorkoutMesocycleRepository.singletonInstance = new WorkoutMesocycleRepository();
    }
    return WorkoutMesocycleRepository.singletonInstance;
  }
}
```

### 1.3 WorkoutMesocycleRepository Tests

**Path**: `src/repositories/workout/WorkoutMesocycleRepository.spec.ts`

**Implementation Guide**: Follow `src/repositories/dashboard/DashboardTaskRepository.spec.ts`. Test RIR progression validation, phase/week constraints, and basic CRUD. See existing test files for complete examples.

**Key scenarios**: Validate RIR progression, validate phase/week constraints, test microcycle relationships.

---

## Part 2: WorkoutMicrocycle

### 2.1 WorkoutMicrocycleValidator

**Path**: `src/validators/workout/MicrocycleValidator.ts`

```typescript
import type { WorkoutMicrocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMicrocycleSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import WorkoutMesocycleRepository from '../../repositories/workout/WorkoutMesocycleRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutMicrocycleValidator extends IValidator<WorkoutMicrocycle> {
  constructor() {
    super(WorkoutMicrocycleSchema, WorkoutMicrocycleSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(newMicrocycle: WorkoutMicrocycle): Promise<void> {
    // Validate that the mesocycle exists
    const mesocycleRepo = WorkoutMesocycleRepository.getRepo();
    const mesocycle = await mesocycleRepo.get({ _id: newMicrocycle.mesocycleId });
    if (!mesocycle) {
      ErrorUtils.throwError(
        `Mesocycle with ID ${newMicrocycle.mesocycleId} does not exist`,
        newMicrocycle
      );
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedMicrocycle: Partial<WorkoutMicrocycle>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedMicrocycle._id) {
      errors.push('No _id defined for WorkoutMicrocycle update.');
    }

    // Validate mesocycle if being updated
    if (updatedMicrocycle.mesocycleId) {
      const mesocycleRepo = WorkoutMesocycleRepository.getRepo();
      const mesocycle = await mesocycleRepo.get({ _id: updatedMicrocycle.mesocycleId });
      if (!mesocycle) {
        errors.push(`Mesocycle with ID ${updatedMicrocycle.mesocycleId} does not exist`);
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedMicrocycle);
    }
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
```

### 2.2 WorkoutMicrocycleRepository

**Path**: `src/repositories/workout/WorkoutMicrocycleRepository.ts`

```typescript
import type { WorkoutMicrocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMicrocycle_docType } from '@aneuhold/core-ts-db-lib';
import CleanDocument from '../../util/DocumentCleaner.js';
import WorkoutMicrocycleValidator from '../../validators/workout/MicrocycleValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutMicrocycle} documents.
 */
export default class WorkoutMicrocycleRepository extends WorkoutBaseWithUserIdRepository<WorkoutMicrocycle> {
  private static singletonInstance?: WorkoutMicrocycleRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(WorkoutMicrocycle_docType, new WorkoutMicrocycleValidator());
  }

  protected setupSubscribers(): void {
    // No subscribers needed for microcycles
    // Cascading deletes are handled by parent mesocycle
  }

  /**
   * Gets all microcycles for a specific mesocycle.
   */
  async getAllForMesocycle(mesocycleId: string): Promise<WorkoutMicrocycle[]> {
    return this.getAll({ mesocycleId });
  }

  /**
   * Gets the singleton instance of the {@link WorkoutMicrocycleRepository}.
   *
   * @returns The singleton instance of the repository.
   */
  public static getRepo(): WorkoutMicrocycleRepository {
    if (!WorkoutMicrocycleRepository.singletonInstance) {
      WorkoutMicrocycleRepository.singletonInstance = new WorkoutMicrocycleRepository();
    }
    return WorkoutMicrocycleRepository.singletonInstance;
  }
}
```

### 2.2 WorkoutMicrocycleRepository

**Path**: `src/repositories/workout/WorkoutMicrocycleRepository.ts`

```typescript
import type { User, WorkoutMicrocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMicrocycle_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutMicrocycleValidator from '../../validators/workout/MicrocycleValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutMicrocycle} documents.
 */
export default class WorkoutMicrocycleRepository extends WorkoutBaseWithUserIdRepository<WorkoutMicrocycle> {
  private static singletonInstance?: WorkoutMicrocycleRepository;

  private constructor() {
    super(WorkoutMicrocycle_docType, new WorkoutMicrocycleValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const microcycleRepo = WorkoutMicrocycleRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await microcycleRepo.getCollection()
        ).deleteMany({
          userId,
          docType: WorkoutMicrocycle_docType
        });
        meta?.recordDocTypeTouched(WorkoutMicrocycle_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await microcycleRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: WorkoutMicrocycle_docType
        });
        meta?.recordDocTypeTouched(WorkoutMicrocycle_docType);
        meta?.addAffectedUserIds(userIds);
      }
    };
  }

  protected setupSubscribers(): void {}

  public static getRepo(): WorkoutMicrocycleRepository {
    if (!WorkoutMicrocycleRepository.singletonInstance) {
      WorkoutMicrocycleRepository.singletonInstance = new WorkoutMicrocycleRepository();
    }
    return WorkoutMicrocycleRepository.singletonInstance;
  }
}
```

### 2.3 WorkoutMicrocycleRepository Tests

**Path**: `src/repositories/workout/WorkoutMicrocycleRepository.spec.ts`

**Implementation Guide**: Follow `src/repositories/dashboard/DashboardTaskRepository.spec.ts`. Test mesocycle references, phase/week bounds, and cascading deletes. See existing test files for complete examples.

**Key scenarios**: Create microcycle, validate mesocycle reference, validate phase/week bounds, test session relationships.

---

## Verification Steps

1. **Run type checking**:

   ```bash
   cd packages/be-ts-db-lib
   pnpm check
   ```

2. **Run tests**:

   ```bash
   pnpm test WorkoutMesocycleRepository
   pnpm test WorkoutMicrocycleRepository
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

- [ ] WorkoutMesocycleValidator compiles and validates phase/week/RIR logic
- [ ] WorkoutMesocycleRepository compiles and all tests pass
- [ ] WorkoutMicrocycleValidator compiles and validates mesocycle references
- [ ] WorkoutMicrocycleRepository compiles and all tests pass
- [ ] Parent-child relationships validated correctly (phase/week bounds)
- [ ] Cascading deletes work: deleting a mesocycle deletes its microcycles
- [ ] Tests use proper null checks (no `!` assertions)
- [ ] `pnpm check` passes without errors
- [ ] All tests pass

## Notes for Next Phase

- Phase 5 will implement session-related repositories (WorkoutSession, WorkoutSessionExercise, WorkoutSet)
- These are the most complex with multiple cascading relationships
- Sessions contain exercises, exercises contain sets
- Will need to validate exercise references and handle multi-level cascades
