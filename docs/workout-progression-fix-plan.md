# Workout Progression Fix

## Problem

`WorkoutSetService.#findPreviousSets` (`packages/core-ts-db-lib/src/services/workout/Set/WorkoutSet.service.ts:149`) resolves the previous microcycle's sets by **position**:

```ts
const sessionId = previousMicrocycle.sessionOrder[sessionIndex];
```

`sessionIndex` comes from `context.exerciseIdToSessionIndex`, which is the exercise's fixed slot in the mesocycle plan. That only lines up when the previous microcycle holds exactly the planned session count in plan order. Nothing compares the resolved `sessionExercise.workoutExerciseId` against the exercise being planned, so a mismatch is silent.

In the "Bulking 2" mesocycle, microcycle 3 is missing its Session 1, so its `sessionOrder` has 4 entries starting at "Session 2". Every exercise in microcycle 4 then autoregulated off a different exercise's history:

| MC4 exercise | Read the history of | Result |
| --- | --- | --- |
| Standing Dumbbell Side Lateral Raise | Barbell Curl (15r@60) | 17r@60, at the top of the dumbbell ladder |
| Seated Dumbbell Overhead Press | Calf Raises (10r@25) | 12r@25, then a 25/20/15/10 descent |
| Incline Barbell Bench Press | Incline Dumbbell Curl (17r@20) | 19r@45, the 20 lb target rounded onto the bar |
| Barbell Bench Press | Lateral Raise (15r@15) | 17r@45 |
| Barbell Squat / Pull Ups | Row / Incline Bench | Rep ceiling reset plus a 2% load bump |

The same defect has a second mode: when the index runs off the end of a shorter `sessionOrder` the guard at line 152 returns `[]`, which silently drops the exercise onto the calibration path. That is what reset the shoulder work in microcycle 3 (microcycle 2 only has 3 sessions), which is why those numbers were already stale before this broke.

`WorkoutVolumePlanningService.#resolveHistoricalExerciseData` already resolves history by `workoutExerciseId` and walks backward across microcycles, so set counts have been correct all along. Only weight and rep progression uses the positional path.

## Resolve previous sets by exercise

### Step 1: Index session exercises by microcycle and exercise

File: `packages/core-ts-db-lib/src/services/workout/Mesocycle/WorkoutMesocyclePlanContext.ts`

Add a `Map<UUID /* microcycleId */, Map<UUID /* exerciseId */, WorkoutSessionExercise>>` alongside the existing `sessionMap`, `sessionExerciseMap`, and `setMap`, exposed through a method so the nesting stays out of call sites.

- Populate it in the constructor from `existingSessions` and `existingSessionExercises`.
- Keep it current in `addSession`, which already runs after `session.sessionExerciseOrder` is filled and after every `addSessionExercise` for that session. Note that ordering requirement in its JSDoc.
- Keep the first occurrence in `sessionOrder` order if an exercise somehow appears twice in a microcycle, matching what `#resolveHistoricalExerciseData` does today.
- Hold every session exercise, recovery ones included. Both consumers skip recovery entries, but they differ on other rules, so the filtering belongs at the call site rather than in the index.

### Step 2: Use the index for previous sets

File: `packages/core-ts-db-lib/src/services/workout/Set/WorkoutSet.service.ts`

- `#findPreviousSets` becomes a loop over `context.microcyclesInOrder` from `microcycleIndex - 1` down to 0. For each, look the exercise up in the index, skip the entry when `isRecoveryExercise` is true, and otherwise return its `setOrder` mapped through `context.setMap`.
- Return an empty array only when the exercise has no non-recovery history anywhere earlier in the mesocycle. The caller falls back to calibration for that case.
- Delete the reads of `context.exerciseIdToSessionIndex` and `context.plannedSessionExerciseCTOs` here along with the five structural throws that exist only to guard the positional assumption. Both context fields stay: `WorkoutVolumePlanningService` still uses them.
- Rewrite the JSDoc to describe the lookup by exercise rather than by session position.

The net effect is roughly 50 lines replaced by about 12.

### Step 3: Collapse the volume planning scan onto the same index

File: `packages/core-ts-db-lib/src/services/workout/util/VolumePlanning/WorkoutVolumePlanning.service.ts`

`#resolveHistoricalExerciseData` walks backward doing the same nested scan by hand. Replace the inner scan with per-exercise lookups against the index. It keeps its own two rules on top: the completeness gate that stops the walk at an unfinished microcycle, and recording exercises found further back than one microcycle as previously in recovery.

The completeness gate stays specific to volume planning on purpose. Set counts need logged data, while weight progression deliberately forecasts from planned-only sets so that future microcycles can be generated in bulk.

### Step 4: Tests

File: `packages/core-ts-db-lib/src/services/workout/Set/WorkoutSet.service.spec.ts`, nested under the existing `generateSetsForSessionExercise` describe, using `workoutTestUtil`.

- A previous microcycle missing its first session: each exercise progresses from its own sets.
- A previous microcycle whose sessions are in a different order than the plan: same result.
- An exercise absent from the previous microcycle: progresses from the most recent microcycle that has it.
- An exercise whose previous microcycle entry is a recovery session: progresses from the microcycle before that one.
- An exercise with no history at all: still lands on the calibration path.

Check `WorkoutMesocycle.service.spec.ts` and `WorkoutVolumePlanning.service.spec.ts` for expectations pinned to the old positional behavior, and that the existing volume planning suite still passes unchanged after step 3.

## Validation

Run in `packages/core-ts-db-lib` and `packages/be-ts-db-lib`, or at the root for everything:

```
pnpm check
pnpm test
pnpm lint
```

`pnpm get:userWorkoutHistory 019abdf5-2cf2-7400-ae80-42cb582febb6` will not change right away. Microcycle 4 is in progress, and `#cleanUpIncompleteMicrocycles` throws rather than replanning a microcycle whose first session is complete, so nothing regenerates until that week is closed out. Once it is, microcycles 5 and 6 regenerate and each exercise should progress from its own history, with no 45 lb bench press and no 60 lb lateral raise.

## Decisions

1. **Look further back than one microcycle.** An exercise missing from the previous microcycle progresses from the most recent microcycle that has it, rather than resetting to calibration. Stale numbers beat a silent reset, and this matches what volume planning already does.
2. **Skip recovery session exercises** when resolving history, matching volume planning. An exercise coming out of a recovery week progresses from its last real week, so a deliberate reduction does not ratchet progression down.
3. **Leave `findNearestWeight` with `'prefer-down'` as is.** Rounding up to the bar when nothing sits below the target keeps the app usable while the numbers behind it are wrong, which is what happened here.
4. **Leave the intra-session weight drop as is.** Once reps hit the rep range floor, cutting weight by about 2% per set is a 20 to 33% step on a coarse dumbbell ladder. That is the expected behavior for the equipment available.

## Notes

Nothing in this repo removes an entry from `sessionOrder`; session deletes only cascade downward. Whatever dropped microcycle 3's first session happened outside this monorepo, and the cause is not something this plan can find. No decision needed: after step 2 the planner no longer depends on it never happening again.

Replanning the microcycle you are currently in is out of scope here, and there is no way to do it today. `generateOrUpdateMesocycle` works at whole-microcycle granularity and refuses to touch a microcycle whose first session is complete, so the sessions left in the current week keep the numbers they were generated with.
