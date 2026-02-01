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
    // Validate that the microcycle exists if provided
    if (newSession.microcycleId) {
      const microcycleRepo = WorkoutMicrocycleRepository.getRepo();
      const microcycle = await microcycleRepo.get({ _id: newSession.microcycleId });
      if (!microcycle) {
        ErrorUtils.throwError(
          `Microcycle with ID ${newSession.microcycleId} does not exist`,
          newSession
        );
      }
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedSession: Partial<WorkoutSession>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedSession._id) {
      errors.push('No _id defined for WorkoutSession update.');
    }

    // Validate microcycle if being updated
    if (updatedSession.microcycleId) {
      const microcycleRepo = WorkoutMicrocycleRepository.getRepo();
      const microcycle = await microcycleRepo.get({ _id: updatedSession.microcycleId });
      if (!microcycle) {
        errors.push(`Microcycle with ID ${updatedSession.microcycleId} does not exist`);
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedSession);
    }
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
```

### 1.2 WorkoutSessionRepository

**Path**: `src/repositories/workout/WorkoutSessionRepository.ts`

```typescript
import type { User, WorkoutSession } from '@aneuhold/core-ts-db-lib';
import { WorkoutSession_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutSessionValidator from '../../validators/workout/SessionValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutSessionExerciseRepository from './WorkoutSessionExerciseRepository.js';

/**
 * The repository that contains {@link WorkoutSession} documents.
 */
export default class WorkoutSessionRepository extends WorkoutBaseWithUserIdRepository<WorkoutSession> {
  private static singletonInstance?: WorkoutSessionRepository;

  private constructor() {
    super(WorkoutSession_docType, new WorkoutSessionValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const sessionRepo = WorkoutSessionRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await sessionRepo.getCollection()
        ).deleteMany({
          userId,
          docType: WorkoutSession_docType
        });
        meta?.recordDocTypeTouched(WorkoutSession_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await sessionRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: WorkoutSession_docType
        });
        meta?.recordDocTypeTouched(WorkoutSession_docType);
        meta?.addAffectedUserIds(userIds);
      }
    };
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(WorkoutSessionExerciseRepository.getListenersForUserRepo());
  }

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
    const sessionRepo = WorkoutSessionRepository.getRepo();
    const session = await sessionRepo.get({ _id: newSessionExercise.sessionId });
    if (!session) {
      errors.push(`Session with ID ${newSessionExercise.sessionId} does not exist`);
    }

    // Validate exercise reference
    const exerciseRepo = WorkoutExerciseRepository.getRepo();
    const exercise = await exerciseRepo.get({ _id: newSessionExercise.exerciseId });
    if (!exercise) {
      errors.push(`Exercise with ID ${newSessionExercise.exerciseId} does not exist`);
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newSessionExercise);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedSessionExercise: Partial<WorkoutSessionExercise>
  ): Promise<void> {
    if (!updatedSessionExercise._id) {
      ErrorUtils.throwError(
        'No _id defined for WorkoutSessionExercise update.',
        updatedSessionExercise
      );
    }
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
```

### 2.2 WorkoutSessionExerciseRepository

**Path**: `src/repositories/workout/WorkoutSessionExerciseRepository.ts`

```typescript
import type { User, WorkoutSessionExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutSessionExercise_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutSessionExerciseValidator from '../../validators/workout/SessionExerciseValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutSetRepository from './WorkoutSetRepository.js';

/**
 * The repository that contains {@link WorkoutSessionExercise} documents.
 */
export default class WorkoutSessionExerciseRepository extends WorkoutBaseWithUserIdRepository<WorkoutSessionExercise> {
  private static singletonInstance?: WorkoutSessionExerciseRepository;

  private constructor() {
    super(WorkoutSessionExercise_docType, new WorkoutSessionExerciseValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await sessionExerciseRepo.getCollection()
        ).deleteMany({
          userId,
          docType: WorkoutSessionExercise_docType
        });
        meta?.recordDocTypeTouched(WorkoutSessionExercise_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await sessionExerciseRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: WorkoutSessionExercise_docType
        });
        meta?.recordDocTypeTouched(WorkoutSessionExercise_docType);
        meta?.addAffectedUserIds(userIds);
      }
    };
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(WorkoutSetRepository.getListenersForUserRepo());
  }

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
    // Validate that the session exercise exists
    const sessionExerciseRepo = WorkoutSessionExerciseRepository.getRepo();
    const sessionExercise = await sessionExerciseRepo.get({ _id: newSet.sessionExerciseId });
    if (!sessionExercise) {
      ErrorUtils.throwError(
        `Session exercise with ID ${newSet.sessionExerciseId} does not exist`,
        newSet
      );
    }
  }

  protected validateUpdateObjectBusinessLogic(updatedSet: Partial<WorkoutSet>): Promise<void> {
    if (!updatedSet._id) {
      ErrorUtils.throwError('No _id defined for WorkoutSet update.', updatedSet);
    }
    return Promise.resolve();
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
```

### 3.2 WorkoutSetRepository

**Path**: `src/repositories/workout/WorkoutSetRepository.ts`

```typescript
import type { User, WorkoutSet } from '@aneuhold/core-ts-db-lib';
import { WorkoutSet_docType } from '@aneuhold/core-ts-db-lib';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutSetValidator from '../../validators/workout/SetValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutSet} documents.
 */
export default class WorkoutSetRepository extends WorkoutBaseWithUserIdRepository<WorkoutSet> {
  private static singletonInstance?: WorkoutSetRepository;

  private constructor() {
    super(WorkoutSet_docType, new WorkoutSetValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const setRepo = WorkoutSetRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await (
          await setRepo.getCollection()
        ).deleteMany({
          userId,
          docType: WorkoutSet_docType
        });
        meta?.recordDocTypeTouched(WorkoutSet_docType);
        meta?.addAffectedUserIds([userId]);
      },
      deleteList: async (userIds, meta) => {
        await (
          await setRepo.getCollection()
        ).deleteMany({
          userId: { $in: userIds },
          docType: WorkoutSet_docType
        });
        meta?.recordDocTypeTouched(WorkoutSet_docType);
        meta?.addAffectedUserIds(userIds);
      }
    };
  }

  protected setupSubscribers(): void {}

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
