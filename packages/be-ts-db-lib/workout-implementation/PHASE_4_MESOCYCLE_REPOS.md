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

  protected async validateNewObjectBusinessLogic(newMesocycle: WorkoutMesocycle): Promise<void> {
    const errors: string[] = [];

    // Validate phase count
    if (newMesocycle.numPhases < 1) {
      errors.push('Number of phases must be at least 1.');
    }

    // Validate weeks per phase
    if (newMesocycle.weeksPerPhase < 1) {
      errors.push('Weeks per phase must be at least 1.');
    }

    // Validate deload weeks
    if (newMesocycle.deloadWeeks < 0) {
      errors.push('Deload weeks cannot be negative.');
    }

    // Validate RIR progression
    if (newMesocycle.rirProgression) {
      if (newMesocycle.rirProgression.length === 0) {
        errors.push('RIR progression must have at least one value.');
      }

      // Validate all RIR values are valid (0-10)
      for (const rir of newMesocycle.rirProgression) {
        if (rir < 0 || rir > 10) {
          errors.push(`RIR values must be between 0 and 10. Found: ${rir}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedMesocycle: Partial<WorkoutMesocycle>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedMesocycle._id) {
      errors.push('No _id defined for WorkoutMesocycle update.');
    }

    // Validate phase count if being updated
    if (updatedMesocycle.numPhases !== undefined && updatedMesocycle.numPhases < 1) {
      errors.push('Number of phases must be at least 1.');
    }

    // Validate weeks per phase if being updated
    if (updatedMesocycle.weeksPerPhase !== undefined && updatedMesocycle.weeksPerPhase < 1) {
      errors.push('Weeks per phase must be at least 1.');
    }

    // Validate deload weeks if being updated
    if (updatedMesocycle.deloadWeeks !== undefined && updatedMesocycle.deloadWeeks < 0) {
      errors.push('Deload weeks cannot be negative.');
    }

    // Validate RIR progression if being updated
    if (updatedMesocycle.rirProgression !== undefined) {
      if (updatedMesocycle.rirProgression.length === 0) {
        errors.push('RIR progression must have at least one value.');
      }

      for (const rir of updatedMesocycle.rirProgression) {
        if (rir < 0 || rir > 10) {
          errors.push(`RIR values must be between 0 and 10. Found: ${rir}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    // Could add validation to check for orphaned microcycles
  }
}
```

### 1.2 WorkoutMesocycleRepository

**Path**: `src/repositories/workout/WorkoutMesocycleRepository.ts`

```typescript
import type { WorkoutMesocycle } from '@aneuhold/core-ts-db-lib';
import { WorkoutMesocycle_docType } from '@aneuhold/core-ts-db-lib';
import CleanDocument from '../../util/DocumentCleaner.js';
import WorkoutMesocycleValidator from '../../validators/workout/MesocycleValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutMicrocycleRepository from './WorkoutMicrocycleRepository.js';

/**
 * The repository that contains {@link WorkoutMesocycle} documents.
 */
export default class WorkoutMesocycleRepository extends WorkoutBaseWithUserIdRepository<WorkoutMesocycle> {
  private static singletonInstance?: WorkoutMesocycleRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(WorkoutMesocycle_docType, new WorkoutMesocycleValidator());
  }

  protected setupSubscribers(): void {
    // Subscribe to delete events to cascade to microcycles
    this.deleteSubject.subscribe(async (metadata) => {
      const microcycleRepo = WorkoutMicrocycleRepository.getRepo();
      const microcycles = await microcycleRepo.getAll({
        mesocycleId: metadata.documentId
      });

      for (const microcycle of microcycles) {
        await microcycleRepo.delete(microcycle._id);
      }
    });
  }

  /**
   * Gets the singleton instance of the {@link WorkoutMesocycleRepository}.
   *
   * @returns The singleton instance of the repository.
   */
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
    const errors: string[] = [];

    // Validate mesocycle reference
    const mesocycle = await WorkoutMesocycleRepository.getRepo().get({
      _id: newMicrocycle.mesocycleId
    });

    if (!mesocycle) {
      errors.push(`Mesocycle with ID ${newMicrocycle.mesocycleId} does not exist.`);
    } else if (mesocycle.userId !== newMicrocycle.userId) {
      errors.push('Mesocycle must belong to the same user as the microcycle.');
    } else {
      // Validate phase and week numbers
      if (newMicrocycle.phaseNumber < 1 || newMicrocycle.phaseNumber > mesocycle.numPhases) {
        errors.push(
          `Phase number must be between 1 and ${mesocycle.numPhases} (mesocycle's numPhases).`
        );
      }

      if (newMicrocycle.weekNumber < 1 || newMicrocycle.weekNumber > mesocycle.weeksPerPhase) {
        errors.push(
          `Week number must be between 1 and ${mesocycle.weeksPerPhase} (mesocycle's weeksPerPhase).`
        );
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newMicrocycle);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedMicrocycle: Partial<WorkoutMicrocycle>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedMicrocycle._id) {
      errors.push('No _id defined for WorkoutMicrocycle update.');
    }

    // Get existing microcycle to access mesocycleId
    if (updatedMicrocycle._id) {
      const existing = await WorkoutMicrocycleRepository.getRepo().get({
        _id: updatedMicrocycle._id
      });

      if (!existing) {
        errors.push('Microcycle not found.');
        throw new Error(errors.join(', '));
      }

      const mesocycle = await WorkoutMesocycleRepository.getRepo().get({
        _id: existing.mesocycleId
      });

      if (!mesocycle) {
        errors.push('Parent mesocycle not found.');
      } else {
        // Validate phase number if being updated
        if (
          updatedMicrocycle.phaseNumber !== undefined &&
          (updatedMicrocycle.phaseNumber < 1 || updatedMicrocycle.phaseNumber > mesocycle.numPhases)
        ) {
          errors.push(
            `Phase number must be between 1 and ${mesocycle.numPhases} (mesocycle's numPhases).`
          );
        }

        // Validate week number if being updated
        if (
          updatedMicrocycle.weekNumber !== undefined &&
          (updatedMicrocycle.weekNumber < 1 ||
            updatedMicrocycle.weekNumber > mesocycle.weeksPerPhase)
        ) {
          errors.push(
            `Week number must be between 1 and ${mesocycle.weeksPerPhase} (mesocycle's weeksPerPhase).`
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    // Could add validation to check for orphaned microcycles
  }
}

// Import to avoid circular dependency
import WorkoutMicrocycleRepository from '../../repositories/workout/WorkoutMicrocycleRepository.js';
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
