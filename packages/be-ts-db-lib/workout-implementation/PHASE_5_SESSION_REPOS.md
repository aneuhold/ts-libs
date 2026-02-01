# Phase 5: Session Repositories - Session, SessionExercise, and Set

## Prerequisites

- Phases 1-4 completed successfully
- All exercise, mesocycle, and microcycle repositories working
- Base classes available

## Objectives

1. Implement WorkoutSessionRepository with validator and tests
2. Implement WorkoutSessionExerciseRepository with validator and tests
3. Implement WorkoutSetRepository with validator and tests
4. Handle complex cascading deletes (session → session exercises → sets)
5. Validate multi-level parent-child relationships

## Context

- **WorkoutSession**: Training sessions within a microcycle
- **WorkoutSessionExercise**: Exercises performed in a session
- **WorkoutSet**: Individual sets within a session exercise
- Complex cascade: Deleting a session deletes all its exercises and all their sets
- All three extend `BaseDocumentWithType & BaseDocumentWithUpdatedAndCreatedDates & RequiredUserId`

---

## Part 1: WorkoutSession

### 1.1 WorkoutSessionValidator

**Path**: `src/validators/workout/SessionValidator.ts`

```typescript
import type { WorkoutSession } from '@aneuhold/core-ts-db-lib';
import { WorkoutSessionSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import WorkoutMicrocycleRepository from '../../repositories/workout/WorkoutMicrocycleRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutSessionValidator extends IValidator<WorkoutSession> {
  constructor() {
    super(WorkoutSessionSchema, WorkoutSessionSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(newSession: WorkoutSession): Promise<void> {
    const errors: string[] = [];

    // Validate microcycle reference if provided
    if (newSession.microcycleId) {
      const microcycle = await WorkoutMicrocycleRepository.getRepo().get({
        _id: newSession.microcycleId
      });

      if (!microcycle) {
        errors.push(`Microcycle with ID ${newSession.microcycleId} does not exist.`);
      } else if (microcycle.userId !== newSession.userId) {
        errors.push('Microcycle must belong to the same user as the session.');
      }
    }

    // Validate sessionDate
    if (newSession.sessionDate && !(newSession.sessionDate instanceof Date)) {
      errors.push('Session date must be a valid Date object.');
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newSession);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedSession: Partial<WorkoutSession>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedSession._id) {
      errors.push('No _id defined for WorkoutSession update.');
    }

    // Validate microcycle reference if being updated
    if (updatedSession.microcycleId !== undefined) {
      const microcycle = await WorkoutMicrocycleRepository.getRepo().get({
        _id: updatedSession.microcycleId
      });

      if (!microcycle) {
        errors.push(`Microcycle with ID ${updatedSession.microcycleId} does not exist.`);
      } else {
        // Get existing session to validate user ownership
        const existing = await WorkoutSessionRepository.getRepo().get({
          _id: updatedSession._id
        });

        if (existing && microcycle.userId !== existing.userId) {
          errors.push('Microcycle must belong to the same user as the session.');
        }
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedSession);
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    // Could add validation to check for orphaned sessions
  }
}

// Import to avoid circular dependency
import WorkoutSessionRepository from '../../repositories/workout/WorkoutSessionRepository.js';
```

### 1.2 WorkoutSessionRepository

**Path**: `src/repositories/workout/WorkoutSessionRepository.ts`

```typescript
import type { WorkoutSession } from '@aneuhold/core-ts-db-lib';
import { WorkoutSession_docType } from '@aneuhold/core-ts-db-lib';
import CleanDocument from '../../util/DocumentCleaner.js';
import WorkoutSessionValidator from '../../validators/workout/SessionValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutSessionExerciseRepository from './WorkoutSessionExerciseRepository.js';

/**
 * The repository that contains {@link WorkoutSession} documents.
 */
export default class WorkoutSessionRepository extends WorkoutBaseWithUserIdRepository<WorkoutSession> {
  private static singletonInstance?: WorkoutSessionRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(WorkoutSession_docType, new WorkoutSessionValidator());
  }

  protected setupSubscribers(): void {
    // Subscribe to delete events to cascade to session exercises
    this.deleteSubject.subscribe(async (metadata) => {
      const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();
      const sessionExercises = await sessionExerciseRepo.getAll({
        sessionId: metadata.documentId
      });

      for (const sessionExercise of sessionExercises) {
        // This will trigger cascading deletes to sets
        await sessionExerciseRepo.delete(sessionExercise._id);
      }
    });
  }

  /**
   * Gets all sessions for a specific microcycle.
   */
  async getAllForMicrocycle(microcycleId: string): Promise<WorkoutSession[]> {
    return this.getAll({ microcycleId });
  }

  /**
   * Gets the singleton instance of the {@link WorkoutSessionRepository}.
   *
   * @returns The singleton instance of the repository.
   */
  public static getRepo(): WorkoutSessionRepository {
    if (!WorkoutSessionRepository.singletonInstance) {
      WorkoutSessionRepository.singletonInstance = new WorkoutSessionRepository();
    }
    return WorkoutSessionRepository.singletonInstance;
  }
}
```

### 1.3 WorkoutSessionRepository Tests

**Path**: `src/repositories/workout/WorkoutSessionRepository.spec.ts`

**Implementation Guide**: Follow `src/repositories/dashboard/DashboardTaskRepository.spec.ts`. Test microcycle references and cascading deletes to session exercises and sets. See existing test files for complete examples.

**Key scenarios**: Create session, validate microcycle reference, test session exercise relationships, verify cascading deletes.

---

## Part 2: WorkoutSessionExercise

### 2.1 WorkoutSessionExerciseValidator

**Path**: `src/validators/workout/SessionExerciseValidator.ts`

```typescript
import type { WorkoutSessionExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutSessionExerciseSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import WorkoutExerciseRepository from '../../repositories/workout/WorkoutExerciseRepository.js';
import WorkoutSessionRepository from '../../repositories/workout/WorkoutSessionRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutSessionExerciseValidator extends IValidator<WorkoutSessionExercise> {
  constructor() {
    super(WorkoutSessionExerciseSchema, WorkoutSessionExerciseSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(
    newSessionExercise: WorkoutSessionExercise
  ): Promise<void> {
    const errors: string[] = [];

    // Validate session reference
    const session = await WorkoutSessionRepository.getRepo().get({
      _id: newSessionExercise.sessionId
    });

    if (!session) {
      errors.push(`Session with ID ${newSessionExercise.sessionId} does not exist.`);
    } else if (session.userId !== newSessionExercise.userId) {
      errors.push('Session must belong to the same user as the session exercise.');
    }

    // Validate exercise reference
    const exercise = await WorkoutExerciseRepository.getRepo().get({
      _id: newSessionExercise.exerciseId
    });

    if (!exercise) {
      errors.push(`Exercise with ID ${newSessionExercise.exerciseId} does not exist.`);
    } else if (exercise.userId !== newSessionExercise.userId) {
      errors.push('Exercise must belong to the same user as the session exercise.');
    }

    // Validate order number
    if (newSessionExercise.orderNumber < 0) {
      errors.push('Order number cannot be negative.');
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newSessionExercise);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedSessionExercise: Partial<WorkoutSessionExercise>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedSessionExercise._id) {
      errors.push('No _id defined for WorkoutSessionExercise update.');
    }

    // Validate order number if being updated
    if (
      updatedSessionExercise.orderNumber !== undefined &&
      updatedSessionExercise.orderNumber < 0
    ) {
      errors.push('Order number cannot be negative.');
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedSessionExercise);
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    // Could add validation to check for orphaned session exercises
  }
}
```

### 2.2 WorkoutSessionExerciseRepository

**Path**: `src/repositories/workout/WorkoutSessionExerciseRepository.ts`

```typescript
import type { WorkoutSessionExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutSessionExercise_docType } from '@aneuhold/core-ts-db-lib';
import CleanDocument from '../../util/DocumentCleaner.js';
import WorkoutSessionExerciseValidator from '../../validators/workout/SessionExerciseValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutSetRepository from './WorkoutSetRepository.js';

/**
 * The repository that contains {@link WorkoutSessionExercise} documents.
 */
export default class WorkoutSessionExerciseRepository extends WorkoutBaseWithUserIdRepository<WorkoutSessionExercise> {
  private static singletonInstance?: WorkoutSessionExerciseRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(WorkoutSessionExercise_docType, new WorkoutSessionExerciseValidator());
  }

  protected setupSubscribers(): void {
    // Subscribe to delete events to cascade to sets
    this.deleteSubject.subscribe(async (metadata) => {
      const setRepo = WorkoutSetRepository.getRepo();
      const sets = await setRepo.getAll({
        sessionExerciseId: metadata.documentId
      });

      for (const set of sets) {
        await setRepo.delete(set._id);
      }
    });
  }

  /**
   * Gets all session exercises for a specific session.
   */
  async getAllForSession(sessionId: string): Promise<WorkoutSessionExercise[]> {
    const exercises = await this.getAll({ sessionId });
    // Sort by order number
    return exercises.sort((a, b) => a.orderNumber - b.orderNumber);
  }

  /**
   * Gets the singleton instance of the {@link WorkoutSessionExerciseRepository}.
   *
   * @returns The singleton instance of the repository.
   */
  public static getRepo(): WorkoutSessionExerciseRepository {
    if (!WorkoutSessionExerciseRepository.singletonInstance) {
      WorkoutSessionExerciseRepository.singletonInstance = new WorkoutSessionExerciseRepository();
    }
    return WorkoutSessionExerciseRepository.singletonInstance;
  }
}
```

### 2.3 WorkoutSessionExerciseRepository Tests

**Path**: `src/repositories/workout/WorkoutSessionExerciseRepository.spec.ts`

**Implementation Guide**: Follow `src/repositories/dashboard/DashboardTaskRepository.spec.ts`. Test session and exercise references, order numbers, and cascading deletes to sets. See existing test files for complete examples.

**Key scenarios**: Create session exercise, validate session/exercise references, test ordering, verify cascading deletes to sets.

---

## Part 3: WorkoutSet

### 3.1 WorkoutSetValidator

**Path**: `src/validators/workout/SetValidator.ts`

```typescript
import type { WorkoutSet } from '@aneuhold/core-ts-db-lib';
import { WorkoutSetSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import WorkoutSessionExerciseRepository from '../../repositories/workout/WorkoutSessionExerciseRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutSetValidator extends IValidator<WorkoutSet> {
  constructor() {
    super(WorkoutSetSchema, WorkoutSetSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(newSet: WorkoutSet): Promise<void> {
    const errors: string[] = [];

    // Validate session exercise reference
    const sessionExercise = await WorkoutSessionExerciseRepository.getRepo().get({
      _id: newSet.sessionExerciseId
    });

    if (!sessionExercise) {
      errors.push(`Session exercise with ID ${newSet.sessionExerciseId} does not exist.`);
    } else if (sessionExercise.userId !== newSet.userId) {
      errors.push('Session exercise must belong to the same user as the set.');
    }

    // Validate set number
    if (newSet.setNumber < 1) {
      errors.push('Set number must be at least 1.');
    }

    // Validate weight if provided
    if (newSet.weight !== undefined && newSet.weight !== null && newSet.weight < 0) {
      errors.push('Weight cannot be negative.');
    }

    // Validate reps if provided
    if (newSet.reps !== undefined && newSet.reps !== null && newSet.reps < 0) {
      errors.push('Reps cannot be negative.');
    }

    // Validate RIR if provided
    if (newSet.rir !== undefined && newSet.rir !== null && (newSet.rir < 0 || newSet.rir > 10)) {
      errors.push('RIR must be between 0 and 10.');
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newSet);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedSet: Partial<WorkoutSet>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedSet._id) {
      errors.push('No _id defined for WorkoutSet update.');
    }

    // Validate set number if being updated
    if (updatedSet.setNumber !== undefined && updatedSet.setNumber < 1) {
      errors.push('Set number must be at least 1.');
    }

    // Validate weight if being updated
    if (updatedSet.weight !== undefined && updatedSet.weight !== null && updatedSet.weight < 0) {
      errors.push('Weight cannot be negative.');
    }

    // Validate reps if being updated
    if (updatedSet.reps !== undefined && updatedSet.reps !== null && updatedSet.reps < 0) {
      errors.push('Reps cannot be negative.');
    }

    // Validate RIR if being updated
    if (
      updatedSet.rir !== undefined &&
      updatedSet.rir !== null &&
      (updatedSet.rir < 0 || updatedSet.rir > 10)
    ) {
      errors.push('RIR must be between 0 and 10.');
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedSet);
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    // Could add validation to check for orphaned sets
  }
}
```

### 3.2 WorkoutSetRepository

**Path**: `src/repositories/workout/WorkoutSetRepository.ts`

```typescript
import type { WorkoutSet } from '@aneuhold/core-ts-db-lib';
import { WorkoutSet_docType } from '@aneuhold/core-ts-db-lib';
import CleanDocument from '../../util/DocumentCleaner.js';
import WorkoutSetValidator from '../../validators/workout/SetValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutSet} documents.
 */
export default class WorkoutSetRepository extends WorkoutBaseWithUserIdRepository<WorkoutSet> {
  private static singletonInstance?: WorkoutSetRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(WorkoutSet_docType, new WorkoutSetValidator(), (set: Partial<WorkoutSet>) => {
      const docCopy = CleanDocument.userId(set);
      delete docCopy.createdDate;
      return docCopy;
    });
  }

  protected setupSubscribers(): void {
    // No subscribers needed for sets (leaf node in hierarchy)
  }

  /**
   * Gets all sets for a specific session exercise.
   */
  async getAllForSessionExercise(sessionExerciseId: string): Promise<WorkoutSet[]> {
    const sets = await this.getAll({ sessionExerciseId });
    // Sort by set number
    return sets.sort((a, b) => a.setNumber - b.setNumber);
  }

  /**
   * Gets the singleton instance of the {@link WorkoutSetRepository}.
   *
   * @returns The singleton instance of the repository.
   */
  public static getRepo(): WorkoutSetRepository {
    if (!WorkoutSetRepository.singletonInstance) {
      WorkoutSetRepository.singletonInstance = new WorkoutSetRepository();
    }
    return WorkoutSetRepository.singletonInstance;
  }
}
```

### 3.3 WorkoutSetRepository Tests

**Path**: `src/repositories/workout/WorkoutSetRepository.spec.ts`

**Implementation Guide**: Follow `src/repositories/dashboard/DashboardTaskRepository.spec.ts`. Test numeric validation (weight, reps, RIR), set ordering, and session exercise references. See existing test files for complete examples.

**Key scenarios**: Create set, validate numeric ranges (weight, reps, RIR 0-10), test ordering, validate session exercise reference.

---

## Verification Steps

1. **Run type checking**:

   ```bash
   cd packages/be-ts-db-lib
   pnpm check
   ```

2. **Run tests**:

   ```bash
   pnpm test WorkoutSessionRepository
   pnpm test WorkoutSessionExerciseRepository
   pnpm test WorkoutSetRepository
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

- [ ] WorkoutSessionValidator compiles and validates microcycle references
- [ ] WorkoutSessionRepository compiles and all tests pass
- [ ] WorkoutSessionExerciseValidator compiles and validates session/exercise references
- [ ] WorkoutSessionExerciseRepository compiles and all tests pass
- [ ] WorkoutSetValidator compiles and validates all numeric constraints
- [ ] WorkoutSetRepository compiles and all tests pass
- [ ] Multi-level cascading deletes work (session → session exercise → set)
- [ ] Sorting works (session exercises by order, sets by set number)
- [ ] Tests use proper null checks (no `!` assertions)
- [ ] `pnpm check` passes without errors
- [ ] All tests pass

## Notes for Next Phase

- Phase 6 will handle integration tasks:
  - Export all repositories and validators to index.ts
  - Add UserRepository listener to clean up workout data on user deletion
  - Implement exercise property synchronization across sessions
  - Create migration scripts if needed
