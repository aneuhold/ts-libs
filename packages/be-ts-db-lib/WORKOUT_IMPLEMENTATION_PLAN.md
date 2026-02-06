# Workout Repository Implementation Plan

## Overview

This document outlines the implementation plan for creating workout-related database repositories in the `be-ts-db-lib` package. The implementation follows the existing patterns established for dashboard documents.

---

## Architecture Patterns Observed

### Collection Strategy

- **Dashboard documents**: Single collection (`dashboard`) with `docType` discriminator
- **Common documents**: Separate collections (e.g., `users`, `apiKeys`)

**Decision for Workouts**: Use a single collection named `workout` with `docType` field, following the dashboard pattern.

### Repository Hierarchy

```
BaseRepository<TBaseType>
  ↓
WorkoutBaseRepository<TBaseType extends BaseDocumentWithType & BaseDocumentWithUpdatedAndCreatedDates>
  ↓
WorkoutBaseWithUserIdRepository<TBaseType extends BaseDocumentWithType & BaseDocumentWithUpdatedAndCreatedDates & RequiredUserId>
  ↓
Specific Repositories (e.g., WorkoutExerciseRepository, WorkoutMesocycleRepository)
```

**Note**: WorkoutBaseRepository now includes automatic handling of `createdDate` and `lastUpdatedDate` fields.

### Key Components Per Document Type

1. **Repository** (`src/repositories/workout/Workout{Type}Repository.ts`)
   - Singleton pattern via `getRepo()`
   - Extends appropriate base class
   - Implements `setupSubscribers()`
   - Custom business logic methods
   - Repository listeners for related documents

2. **Validator** (`src/validators/workout/{Type}Validator.ts`)
   - Extends `IValidator<T>`
   - Schema validation (using Zod schemas from core-ts-db-lib)
   - Business logic validation for inserts/updates
   - Repository-level validation method

3. **Unit Tests** (`src/repositories/workout/Workout{Type}Repository.spec.ts`)
   - Test CRUD operations
   - Test validation logic
   - Test business rules
   - Test subscriber behavior

---

## Documents Requiring Repositories

All workout documents have `userId` field, so all will extend `WorkoutBaseWithUserIdRepository`.

### Core Document Types (9 total)

1. **WorkoutEquipmentType** - Equipment definitions with weight options
2. **WorkoutExercise** - Exercise definitions with muscle groups
3. **WorkoutExerciseCalibration** - 1RM calibration data
4. **WorkoutMuscleGroup** - Muscle group definitions
5. **WorkoutMesocycle** - Training mesocycle configurations
6. **WorkoutMicrocycle** - Training microcycle within mesocycle
7. **WorkoutSession** - Individual workout sessions
8. **WorkoutSessionExercise** - Exercise within a session
9. **WorkoutSet** - Individual sets within session exercise

---

## Implementation Plan

### Phase 1: Foundation Files

#### 1.1 Base Repository Files

**File**: `src/repositories/workout/WorkoutBaseRepository.ts`

```typescript
import type { BaseDocumentWithType } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { BulkWriteResult, DeleteResult, UpdateResult } from 'mongodb';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import type IValidator from '../../validators/BaseValidator.js';
import BaseRepository from '../BaseRepository.js';

/**
 * A base repository for the `workout` collection.
 */
export default abstract class WorkoutBaseRepository<
  TBaseType extends BaseDocumentWithType
> extends BaseRepository<TBaseType> {
  private static COLLECTION_NAME = 'workout';

  constructor(
    protected docType: string,
    validator: IValidator<TBaseType>,
    updateCleaner?: (doc: Partial<TBaseType>) => Partial<TBaseType>
  ) {
    const defaultUpdateCleaner = (updatedDoc: Partial<TBaseType>) =>
      updateCleaner
        ? updateCleaner(CleanDocument.docType(updatedDoc))
        : CleanDocument.docType(updatedDoc);
    const defaultFilter = { docType } as Partial<TBaseType>;
    super(WorkoutBaseRepository.COLLECTION_NAME, validator, defaultFilter, defaultUpdateCleaner);
  }

  // Override methods to record docType metadata
  // (Same pattern as DashboardBaseRepository)
}
```

**File**: `src/repositories/workout/WorkoutBaseWithUserIdRepository.ts`

```typescript
import type { BaseDocumentWithType, RequiredUserId } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { BulkWriteResult, DeleteResult, Filter, UpdateResult } from 'mongodb';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import type IValidator from '../../validators/BaseValidator.js';
import WorkoutBaseRepository from './WorkoutBaseRepository.js';

/**
 * A base repository for the `workout` collection that requires a `userId`.
 */
export default abstract class WorkoutBaseWithUserIdRepository<
  TBaseType extends BaseDocumentWithType & RequiredUserId
> extends WorkoutBaseRepository<TBaseType> {
  constructor(
    docType: string,
    validator: IValidator<TBaseType>,
    updateCleaner?: (doc: Partial<TBaseType>) => Partial<TBaseType>
  ) {
    const defaultUpdateCleaner = (doc: Partial<TBaseType>) =>
      updateCleaner ? updateCleaner(CleanDocument.userId(doc)) : CleanDocument.userId(doc);
    super(docType, validator, defaultUpdateCleaner);
  }

  /**
   * Gets all items for a given user.
   */
  async getAllForUser(userId: UUID): Promise<TBaseType[]> {
    // Same pattern as DashboardBaseWithUserIdRepository
  }

  // Override CRUD methods to track affected userIds in meta
}
```

#### 1.2 Create Validator Directory Structure

```
src/validators/workout/
  ├── EquipmentTypeValidator.ts
  ├── ExerciseValidator.ts
  ├── ExerciseCalibrationValidator.ts
  ├── MuscleGroupValidator.ts
  ├── MesocycleValidator.ts
  ├── MicrocycleValidator.ts
  ├── SessionValidator.ts
  ├── SessionExerciseValidator.ts
  └── SetValidator.ts
```

---

### Phase 2: Simple Document Repositories (No Complex Dependencies)

These can be implemented first as they have minimal cross-document dependencies.

#### 2.1 WorkoutMuscleGroup

- **Validator**: Basic schema validation, check name uniqueness per user
- **Repository**: Standard CRUD, `getAllForUser()`
- **Business Rules**: Muscle groups can't be deleted if referenced by exercises
- **Listeners**: None needed initially

#### 2.2 WorkoutEquipmentType

- **Validator**: Schema validation, validate weightOptions array if provided
- **Repository**: Standard CRUD, `getAllForUser()`
- **Business Rules**: Equipment types can't be deleted if referenced by exercises
- **Listeners**: None needed initially

---

### Phase 3: Exercise-Related Repositories

#### 3.1 WorkoutExercise

- **Validator**:
  - Validate muscle group IDs exist
  - Validate equipment type ID exists
  - Validate custom properties match schema
- **Repository**:
  - `getAllForUser(userId: UUID)`
  - `getByMuscleGroup(muscleGroupId: UUID)`
  - `getByEquipmentType(equipmentTypeId: UUID)`
- **Business Rules**:
  - Can't be deleted if referenced by calibrations or sessions
  - Muscle groups must exist
  - Equipment type must exist
- **Listeners**:
  - On delete: Remove all associated calibrations
  - On update (customProperties): Propagate to existing sets (see README.md note)

#### 3.2 WorkoutExerciseCalibration

- **Validator**:
  - Validate exercise ID exists
  - Validate exerciseProperties match exercise's customProperties
  - Validate reps > 0, weight >= 0
- **Repository**:
  - `getAllForUser(userId: UUID)`
  - `getByExercise(exerciseId: UUID)`
  - `getLatestForExercise(exerciseId: UUID)` - Get most recent calibration
- **Business Rules**:
  - Exercise must exist
  - Can't be deleted if referenced by an active mesocycle
- **Listeners**: None needed initially

---

### Phase 4: Mesocycle/Microcycle Repositories

#### 4.1 WorkoutMesocycle

- **Validator**:
  - Validate all calibratedExercises exist
  - Validate plannedSessionCountPerMicrocycle matches exercise count (Zod refine already does this)
  - Validate microcycle configuration makes sense
- **Repository**:
  - `getAllForUser(userId: UUID)`
  - `getActive(userId: UUID)` - Get active (not completed) mesocycles
  - `getCompleted(userId: UUID)` - Get completed mesocycles
- **Business Rules**:
  - All calibrated exercises must exist
  - Can't delete if has child microcycles/sessions (or cascade delete)
- **Listeners**:
  - On delete: Cascade delete all child microcycles, sessions, session exercises, and sets

#### 4.2 WorkoutMicrocycle

- **Validator**:
  - Validate mesocycle ID exists (if provided)
  - Validate startDate < endDate
  - Validate sessionOrder references exist
- **Repository**:
  - `getAllForUser(userId: UUID)`
  - `getByMesocycle(mesocycleId: UUID)`
  - `getCurrentForUser(userId: UUID)` - Get current active microcycle
- **Business Rules**:
  - If mesocycleId provided, mesocycle must exist
  - Sessions in sessionOrder must belong to this microcycle
- **Listeners**:
  - On delete: Cascade delete all child sessions

---

### Phase 5: Session-Related Repositories

#### 5.1 WorkoutSession

- **Validator**:
  - Validate microcycle ID exists (if provided)
  - Validate sessionExerciseOrder references exist
- **Repository**:
  - `getAllForUser(userId: UUID)`
  - `getByMicrocycle(microcycleId: UUID)`
  - `getUpcoming(userId: UUID, limit?: number)` - Get upcoming sessions
  - `getCompleted(userId: UUID, limit?: number)` - Get completed sessions
- **Business Rules**:
  - If microcycleId provided, microcycle must exist
  - Session exercises in order must belong to this session
- **Listeners**:
  - On delete: Cascade delete all child session exercises and sets

#### 5.2 WorkoutSessionExercise

- **Validator**:
  - Validate session ID exists
  - Validate exercise ID exists
  - Validate setOrder references exist
  - Validate soreness/performance scores in 0-3 range
- **Repository**:
  - `getAllForUser(userId: UUID)`
  - `getBySession(sessionId: UUID)`
  - `getByExercise(exerciseId: UUID)` - Get exercise history across sessions
- **Business Rules**:
  - Session must exist
  - Exercise must exist
  - Sets in setOrder must belong to this session exercise
- **Listeners**:
  - On delete: Cascade delete all child sets

#### 5.3 WorkoutSet

- **Validator**:
  - Validate exercise ID exists
  - Validate session ID exists
  - Validate session exercise ID exists
  - Validate exerciseProperties match exercise's customProperties
  - Validate reps/weight/RIR values are sensible
- **Repository**:
  - `getAllForUser(userId: UUID)`
  - `getBySession(sessionId: UUID)`
  - `getBySessionExercise(sessionExerciseId: UUID)`
  - `getByExercise(exerciseId: UUID)` - Get all sets for an exercise (for history)
- **Business Rules**:
  - Exercise, session, and session exercise must exist
  - Session exercise must belong to session
  - Exercise must match session exercise's exercise
- **Listeners**: None needed initially

---

### Phase 6: Cross-Repository Listeners & Cleanup

#### 6.1 UserRepository Listeners

Add listener in UserRepository to handle user deletion:

```typescript
static getListenersForWorkoutRepos(): RepoListeners<User> {
  return {
    deleteOne: async (userId, meta) => {
      // Delete all workout documents for this user
      // Order matters: delete from leaf nodes up
      await WorkoutSetRepository.getRepo().deleteAllForUser(userId, meta);
      await WorkoutSessionExerciseRepository.getRepo().deleteAllForUser(userId, meta);
      await WorkoutSessionRepository.getRepo().deleteAllForUser(userId, meta);
      await WorkoutMicrocycleRepository.getRepo().deleteAllForUser(userId, meta);
      await WorkoutMesocycleRepository.getRepo().deleteAllForUser(userId, meta);
      await WorkoutExerciseCalibrationRepository.getRepo().deleteAllForUser(userId, meta);
      await WorkoutExerciseRepository.getRepo().deleteAllForUser(userId, meta);
      await WorkoutMuscleGroupRepository.getRepo().deleteAllForUser(userId, meta);
      await WorkoutEquipmentTypeRepository.getRepo().deleteAllForUser(userId, meta);
    }
  };
}
```

#### 6.2 Exercise Property Synchronization

Implement the business logic from README.md:

> "exerciseProperties in WorkoutSet and WorkoutExerciseCalibration are populated from WorkoutExercise.customProperties at creation time. Then whenever customProperties are changed, they are changed among every single existing WorkoutSet with that WorkoutExercise linked to it."

Add to WorkoutExerciseRepository:

```typescript
async updateCustomProperties(
  exerciseId: UUID,
  newCustomProperties: ExerciseProperty[],
  meta?: DbOperationMetaData
): Promise<void> {
  // 1. Update the exercise
  // 2. Update all associated sets' exerciseProperties
  // 3. Update all associated calibrations' exerciseProperties
}
```

---

### Phase 7: Export & Integration

#### 7.1 Update `src/index.ts`

```typescript
// Workout repositories
import WorkoutEquipmentTypeRepository from './repositories/workout/WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseRepository from './repositories/workout/WorkoutExerciseRepository.js';
import WorkoutExerciseCalibrationRepository from './repositories/workout/WorkoutExerciseCalibrationRepository.js';
import WorkoutMesocycleRepository from './repositories/workout/WorkoutMesocycleRepository.js';
import WorkoutMicrocycleRepository from './repositories/workout/WorkoutMicrocycleRepository.js';
import WorkoutMuscleGroupRepository from './repositories/workout/WorkoutMuscleGroupRepository.js';
import WorkoutSessionRepository from './repositories/workout/WorkoutSessionRepository.js';
import WorkoutSessionExerciseRepository from './repositories/workout/WorkoutSessionExerciseRepository.js';
import WorkoutSetRepository from './repositories/workout/WorkoutSetRepository.js';

export {
  // ... existing exports ...
  WorkoutEquipmentTypeRepository,
  WorkoutExerciseRepository,
  WorkoutExerciseCalibrationRepository,
  WorkoutMesocycleRepository,
  WorkoutMicrocycleRepository,
  WorkoutMuscleGroupRepository,
  WorkoutSessionRepository,
  WorkoutSessionExerciseRepository,
  WorkoutSetRepository
};
```

#### 7.2 Database Migration Script

Create `scripts/migrations/001_create_workout_collection.ts`:

```typescript
// Initialize workout collection with indexes
// Add compound indexes for common queries:
// - { userId: 1, docType: 1 }
// - { userId: 1, docType: 1, _id: 1 }
// - For WorkoutSet: { workoutExerciseId: 1, workoutSessionId: 1 }
// - For WorkoutSession: { startTime: -1 }
```

---

## Testing Strategy

### Unit Tests for Each Repository

Following the pattern from `DashboardTaskRepository.spec.ts`:

1. **Basic CRUD tests**
   - Insert new document
   - Get by ID
   - Update document
   - Delete document
   - Get all for user

2. **Validation tests**
   - Test schema validation failures
   - Test business logic validation failures
   - Test missing required references

3. **Relationship tests**
   - Test cascade deletes
   - Test reference validation
   - Test cross-document listeners

4. **Edge cases**
   - Concurrent updates
   - Invalid IDs
   - Orphaned documents

### Integration Tests

Create `src/tests/workout/workout-integration.spec.ts`:

- Test complete mesocycle creation flow
- Test session logging workflow
- Test user deletion cascade

---

## File Checklist

### Base Files (2)

- [ ] `src/repositories/workout/WorkoutBaseRepository.ts`
- [ ] `src/repositories/workout/WorkoutBaseWithUserIdRepository.ts`

### Repositories (9)

- [ ] `src/repositories/workout/WorkoutEquipmentTypeRepository.ts`
- [ ] `src/repositories/workout/WorkoutExerciseRepository.ts`
- [ ] `src/repositories/workout/WorkoutExerciseCalibrationRepository.ts`
- [ ] `src/repositories/workout/WorkoutMuscleGroupRepository.ts`
- [ ] `src/repositories/workout/WorkoutMesocycleRepository.ts`
- [ ] `src/repositories/workout/WorkoutMicrocycleRepository.ts`
- [ ] `src/repositories/workout/WorkoutSessionRepository.ts`
- [ ] `src/repositories/workout/WorkoutSessionExerciseRepository.ts`
- [ ] `src/repositories/workout/WorkoutSetRepository.ts`

### Validators (9)

- [ ] `src/validators/workout/EquipmentTypeValidator.ts`
- [ ] `src/validators/workout/ExerciseValidator.ts`
- [ ] `src/validators/workout/ExerciseCalibrationValidator.ts`
- [ ] `src/validators/workout/MuscleGroupValidator.ts`
- [ ] `src/validators/workout/MesocycleValidator.ts`
- [ ] `src/validators/workout/MicrocycleValidator.ts`
- [ ] `src/validators/workout/SessionValidator.ts`
- [ ] `src/validators/workout/SessionExerciseValidator.ts`
- [ ] `src/validators/workout/SetValidator.ts`

### Unit Tests (9)

- [ ] `src/repositories/workout/WorkoutEquipmentTypeRepository.spec.ts`
- [ ] `src/repositories/workout/WorkoutExerciseRepository.spec.ts`
- [ ] `src/repositories/workout/WorkoutExerciseCalibrationRepository.spec.ts`
- [ ] `src/repositories/workout/WorkoutMuscleGroupRepository.spec.ts`
- [ ] `src/repositories/workout/WorkoutMesocycleRepository.spec.ts`
- [ ] `src/repositories/workout/WorkoutMicrocycleRepository.spec.ts`
- [ ] `src/repositories/workout/WorkoutSessionRepository.spec.ts`
- [ ] `src/repositories/workout/WorkoutSessionExerciseRepository.spec.ts`
- [ ] `src/repositories/workout/WorkoutSetRepository.spec.ts`

### Integration Tests (1)

- [ ] `src/tests/workout/workout-integration.spec.ts`

### Supporting Files (2)

- [ ] `src/index.ts` (update exports)
- [ ] `scripts/migrations/001_create_workout_collection.ts`

---

## Total File Count

- **Base classes**: 2
- **Repositories**: 9
- **Validators**: 9
- **Unit tests**: 9
- **Integration tests**: 1
- **Migration scripts**: 1
- **Updated files**: 1

**Total new files**: 31
**Total files to modify**: 1

---

## Estimated Effort

- **Phase 1 (Foundation)**: 2-3 hours
- **Phase 2 (Simple repos)**: 3-4 hours
- **Phase 3 (Exercise repos)**: 4-5 hours
- **Phase 4 (Mesocycle repos)**: 4-5 hours
- **Phase 5 (Session repos)**: 5-6 hours
- **Phase 6 (Listeners & cleanup)**: 3-4 hours
- **Phase 7 (Export & integration)**: 2-3 hours
- **Testing & debugging**: 5-8 hours

**Total estimated effort**: 28-38 hours

---

## Special Considerations

### 1. Cascade Deletes

Implement carefully to maintain referential integrity:

- Mesocycle delete → Microcycle → Session → SessionExercise → Set
- Exercise delete → ExerciseCalibration
- User delete → All workout documents

### 2. Performance Indexes

Critical indexes for the `workout` collection:

```javascript
{ userId: 1, docType: 1 }
{ userId: 1, docType: 1, _id: 1 }
{ docType: 1, workoutMesocycleId: 1 }  // For microcycles
{ docType: 1, workoutMicrocycleId: 1 }  // For sessions
{ docType: 1, workoutSessionId: 1 }     // For session exercises
{ docType: 1, workoutExerciseId: 1 }    // For sets/calibrations
{ userId: 1, docType: 1, startTime: -1 } // For session queries
```

### 3. Exercise Property Synchronization

This is complex and should be:

- Well-tested
- Wrapped in transactions if possible
- Documented with clear warnings about performance implications

### 4. Mesocycle State Management

Consider adding a `status` field to WorkoutMesocycle:

- `'draft'` - Being planned
- `'active'` - Currently in progress
- `'completed'` - Finished
- `'abandoned'` - User stopped mid-cycle

This could simplify queries and business logic.

---

## Next Steps

1. Review and approve this plan
2. Create feature branch: `feature/workout-repositories`
3. Implement Phase 1 (Foundation)
4. Submit PR for review after each phase
5. Iterate based on feedback
6. Final integration testing
7. Merge to main

---

## Questions to Resolve

1. Should we add a `status` field to WorkoutMesocycle for state management?
2. Do we need transaction support for exercise property synchronization?
3. Should we implement soft deletes for workout documents (add `deletedDate` field)?
4. Do we want to track version history for mesocycles (to see how plans evolved)?
5. Should we add caching for frequently accessed documents (e.g., muscle groups, equipment types)?
