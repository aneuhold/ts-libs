# Workout Implementation - Phase Overview

This directory contains the complete implementation plan for the workout tracking system in `be-ts-db-lib`, broken into 6 self-contained phases.

## Phase Structure

Each phase is designed to be executed independently by an LLM agent, assuming all previous phases have been completed. Each phase file includes:

- **Prerequisites**: What must be completed before starting
- **Objectives**: Clear goals for the phase
- **Context**: Background information and design decisions
- **Implementation**: Complete code for all files to create
- **Verification Steps**: Commands to validate the implementation
- **Acceptance Criteria**: Checklist of requirements
- **Notes for Next Phase**: What to expect in the following phase

## Execution Order

### [Phase 1: Foundation](./PHASE_1_FOUNDATION.md)

**Status**: ⬜ Not Started  
**Files**: 2 base repository classes  
**Estimated Time**: 30-45 minutes

Creates the foundation layer:

- `WorkoutBaseRepository` - Base class with automatic lastUpdatedDate handling
- `WorkoutBaseWithUserIdRepository` - User-scoped repository with metadata tracking
- Directory structure setup

### [Phase 2: Simple Repositories](./PHASE_2_SIMPLE_REPOS.md)

**Status**: ⬜ Not Started  
**Files**: 4 files (2 repos + 2 validators + 2 test files)  
**Estimated Time**: 45-60 minutes

Implements simple user-owned entities:

- WorkoutMuscleGroup (muscle group definitions)
- WorkoutEquipmentType (equipment with optional weight options)

### [Phase 3: Exercise Repositories](./PHASE_3_EXERCISE_REPOS.md)

**Status**: ⬜ Not Started  
**Files**: 4 files (2 repos + 2 validators + 2 test files)  
**Estimated Time**: 60-90 minutes

Implements exercise-related entities:

- WorkoutExercise (references muscle groups and equipment)
- WorkoutExerciseCalibration (1RM calibration data)
- Cascading deletes: exercise → calibrations
- Foreign key validation

### [Phase 4: Mesocycle Repositories](./PHASE_4_MESOCYCLE_REPOS.md)

**Status**: ⬜ Not Started  
**Files**: 4 files (2 repos + 2 validators + 2 test files)  
**Estimated Time**: 60-90 minutes

Implements training plan entities:

- WorkoutMesocycle (training blocks with MEV/MRV progression)
- WorkoutMicrocycle (weekly cycles within mesocycles)
- Cascading deletes: mesocycle → microcycles
- Phase/week validation

### [Phase 5: Session Repositories](./PHASE_5_SESSION_REPOS.md)

**Status**: ⬜ Not Started  
**Files**: 6 files (3 repos + 3 validators + 3 test files)  
**Estimated Time**: 90-120 minutes

Implements workout execution entities:

- WorkoutSession (training sessions)
- WorkoutSessionExercise (exercises performed in sessions)
- WorkoutSet (individual sets with weight/reps/RIR)
- Multi-level cascading: session → session exercises → sets

### [Phase 6: Integration](./PHASE_6_INTEGRATION.md)

**Status**: ⬜ Not Started  
**Files**: 3 files (exports + integration tests + migration script)  
**Estimated Time**: 45-60 minutes

Finalizes the system:

- Export all repositories and validators
- UserRepository listener for cleanup on user deletion
- Exercise property synchronization
- Integration test suite
- Migration scripts

## Total Implementation Stats

- **Total Files**: 29 new files
- **Repositories**: 9 workout repositories + 2 base classes
- **Validators**: 9 validators
- **Test Files**: 9 unit test files + 1 integration test suite
- **Estimated Total Time**: 5-7 hours

## Architecture Overview

```
WorkoutBaseRepository (extends BaseRepository)
  ├── BaseDocumentWithType
  └── BaseDocumentWithUpdatedAndCreatedDates

WorkoutBaseWithUserIdRepository (extends WorkoutBaseRepository)
  └── RequiredUserId

User-Owned Repositories:
  ├── WorkoutMuscleGroupRepository
  ├── WorkoutEquipmentTypeRepository
  ├── WorkoutExerciseRepository
  ├── WorkoutExerciseCalibrationRepository
  ├── WorkoutMesocycleRepository
  ├── WorkoutMicrocycleRepository
  ├── WorkoutSessionRepository
  ├── WorkoutSessionExerciseRepository
  └── WorkoutSetRepository
```

## Key Features

### Automatic Timestamp Management

- `createdDate`: Set once on document creation (handled by BaseRepository)
- `lastUpdatedDate`: Automatically updated on every modification (handled by WorkoutBaseRepository)

### Cascading Deletes

- Exercise → Exercise Calibrations
- Mesocycle → Microcycles
- Session → Session Exercises → Sets
- User → All workout data

### Foreign Key Validation

- Muscle group and equipment references validated in exercises
- Exercise references validated in calibrations and session exercises
- Mesocycle references validated in microcycles
- Microcycle references validated in sessions
- User ownership validated across all relationships

### Singleton Pattern

All repositories use singleton pattern with `getRepo()` static method for consistent access.

### User-Scoped Queries

All user-owned repositories provide `getAllForUser(userId)` for efficient data retrieval.

## Running the Implementation

### Prerequisites

- MongoDB connection configured
- All dependencies installed (`pnpm install`)
- Phases 1-5 from `core-ts-db-lib` completed (schemas and services exist)

### Execute Each Phase

1. Follow the instructions in each phase file sequentially
2. Run verification commands after each phase
3. Ensure all tests pass before proceeding to next phase
4. Update the status checkboxes in this README as you complete each phase

### Verification Commands

```bash
# Type checking
pnpm check

# Run specific test file
pnpm test <TestFileName>

# Run all workout tests
pnpm test workout

# Run linting
pnpm lint

# Run full test suite
pnpm test
```

## Success Criteria

The implementation is complete when:

- [ ] All 6 phases completed
- [ ] `pnpm check` passes without errors
- [ ] `pnpm test` passes all tests (including integration tests)
- [ ] `pnpm lint` passes without errors
- [ ] All workout repositories exported from index.ts
- [ ] User deletion properly cascades to workout data
- [ ] Exercise property synchronization works
- [ ] Cascading deletes function correctly at all levels

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure file paths use `.js` extensions even for TypeScript files
2. **Circular Dependencies**: Import repositories in validators may need to be at the end of the file
3. **Test Timeouts**: Integration tests with many operations may need increased timeouts
4. **Type Errors**: Verify all schemas are imported from `@aneuhold/core-ts-db-lib`

### Getting Help

If you encounter issues:

1. Check the verification steps in each phase file
2. Review the acceptance criteria to ensure all requirements are met
3. Run `pnpm check` and `pnpm lint` to identify type/style issues
4. Look for similar patterns in existing repositories (e.g., `UserRepository`)

## Notes

- Each phase builds on the previous one - do not skip phases
- Test files demonstrate usage patterns and edge cases
- Validators include both schema validation and business logic validation
- Repository subscribers enable cascading operations and cross-document updates
- The workout system integrates with the existing dashboard repository pattern

## Contact & Support

For questions about this implementation plan, refer to:

- Main implementation plan: `WORKOUT_IMPLEMENTATION_PLAN.md`
- Core TypeScript DB library docs: `packages/core-ts-db-lib/README.md`
- Backend TypeScript DB library docs: `packages/be-ts-db-lib/README.md`
