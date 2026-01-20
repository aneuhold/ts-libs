import { DateService } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../../../documents/workout/WorkoutExercise.js';
import { ExerciseRepRange } from '../../../documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../../../documents/workout/WorkoutExerciseCalibration.js';
import type { WorkoutMesocycle } from '../../../documents/workout/WorkoutMesocycle.js';
import type { WorkoutMicrocycle } from '../../../documents/workout/WorkoutMicrocycle.js';
import { WorkoutMicrocycleSchema } from '../../../documents/workout/WorkoutMicrocycle.js';
import type { WorkoutSession } from '../../../documents/workout/WorkoutSession.js';
import { WorkoutSessionSchema } from '../../../documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../../../documents/workout/WorkoutSessionExercise.js';
import { WorkoutSessionExerciseSchema } from '../../../documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../../../documents/workout/WorkoutSet.js';
import { WorkoutSetSchema } from '../../../documents/workout/WorkoutSet.js';
import type { DocumentOperations } from '../../DocumentService.js';
import WorkoutExerciseService from '../Exercise/WorkoutExerciseService.js';

/**
 * A service for handling operations related to {@link WorkoutMesocycle}s.
 */
export default class WorkoutMesocycleService {
  /**
   * Generates the complete initial workout plan for an entire mesocycle.
   *
   * @param mesocycle The mesocycle configuration.
   * @param calibrations The calibration documents referenced by the mesocycle.
   * @param exercises The exercise definitions for the calibrations.
   * @param equipmentTypes The equipment types for weight increment calculations.
   */
  static generateInitialPlan(
    mesocycle: WorkoutMesocycle,
    calibrations: WorkoutExerciseCalibration[],
    exercises: WorkoutExercise[],
    equipmentTypes: WorkoutEquipmentType[]
  ): {
    mesocycleUpdate?: Partial<WorkoutMesocycle>;
    microcycles?: DocumentOperations<WorkoutMicrocycle>;
    sessions?: DocumentOperations<WorkoutSession>;
    sessionExercises?: DocumentOperations<WorkoutSessionExercise>;
    sets?: DocumentOperations<WorkoutSet>;
  } {
    const microcyclesToCreate: WorkoutMicrocycle[] = [];
    const sessionsToCreate: WorkoutSession[] = [];
    const sessionExercisesToCreate: WorkoutSessionExercise[] = [];
    const setsToCreate: WorkoutSet[] = [];

    // Create lookup maps
    const calibrationMap = new Map(calibrations.map((c) => [c._id, c]));
    const exerciseMap = new Map(exercises.map((e) => [e._id, e]));
    const equipmentMap = new Map(equipmentTypes.map((et) => [et._id, et]));

    // Determine number of microcycles (default to 6 if not specified: 5 accumulation + 1 deload)
    const totalMicrocycles = mesocycle.plannedMicrocycleCount ?? 6;
    const deloadMicrocycleIndex = totalMicrocycles - 1;

    // Group exercises by muscle group for distribution
    const exercisesByMuscleGroup = this.groupExercisesByMuscleGroup(
      mesocycle.calibratedExercises,
      calibrationMap,
      exerciseMap
    );

    // Calculate start date (today if not specified)
    let currentDate = new Date();

    // Generate each microcycle
    for (let microcycleIndex = 0; microcycleIndex < totalMicrocycles; microcycleIndex++) {
      const isDeloadWeek = microcycleIndex === deloadMicrocycleIndex;

      // Calculate RIR for this microcycle (4 -> 3 -> 2 -> 1 -> 0, capped at microcycle 5)
      const rirForMicrocycle = Math.min(microcycleIndex, 4);
      const targetRir = 4 - rirForMicrocycle;

      // Create microcycle
      const microcycle = WorkoutMicrocycleSchema.parse({
        userId: mesocycle.userId,
        workoutMesocycleId: mesocycle._id,
        startDate: new Date(currentDate),
        endDate: DateService.addDays(currentDate, mesocycle.plannedMicrocycleLengthInDays)
      });
      microcyclesToCreate.push(microcycle);

      // Generate sessions for this microcycle
      const sessions = this.generateSessionsForMicrocycle(
        mesocycle,
        microcycle,
        currentDate,
        microcycleIndex,
        targetRir,
        isDeloadWeek,
        deloadMicrocycleIndex,
        exercisesByMuscleGroup,
        calibrationMap,
        exerciseMap,
        equipmentMap
      );

      sessionsToCreate.push(...sessions.sessions);
      sessionExercisesToCreate.push(...sessions.sessionExercises);
      setsToCreate.push(...sessions.sets);

      // Move to next microcycle
      currentDate = new Date(microcycle.endDate);
    }

    return {
      mesocycleUpdate: undefined,
      microcycles: { create: microcyclesToCreate, update: [], delete: [] },
      sessions: { create: sessionsToCreate, update: [], delete: [] },
      sessionExercises: { create: sessionExercisesToCreate, update: [], delete: [] },
      sets: { create: setsToCreate, update: [], delete: [] }
    };
  }

  private static groupExercisesByMuscleGroup(
    calibratedExerciseIds: UUID[],
    calibrationMap: Map<UUID, WorkoutExerciseCalibration>,
    exerciseMap: Map<UUID, WorkoutExercise>
  ): Map<UUID, { calibration: WorkoutExerciseCalibration; exercise: WorkoutExercise }[]> {
    const grouped = new Map<
      UUID,
      { calibration: WorkoutExerciseCalibration; exercise: WorkoutExercise }[]
    >();

    for (const calibrationId of calibratedExerciseIds) {
      const calibration = calibrationMap.get(calibrationId);
      if (!calibration) continue;
      const exercise = exerciseMap.get(calibration.workoutExerciseId);
      if (!exercise) continue;

      // Group by primary muscle groups
      for (const muscleGroupId of exercise.primaryMuscleGroups) {
        const group = grouped.get(muscleGroupId) || [];
        group.push({ calibration, exercise });
        grouped.set(muscleGroupId, group);
      }
    }

    return grouped;
  }

  private static generateSessionsForMicrocycle(
    mesocycle: WorkoutMesocycle,
    microcycle: WorkoutMicrocycle,
    startDate: Date,
    microcycleIndex: number,
    targetRir: number,
    isDeloadMicrocycle: boolean,
    totalAccumulationMicrocycles: number,
    exercisesByMuscleGroup: Map<
      UUID,
      { calibration: WorkoutExerciseCalibration; exercise: WorkoutExercise }[]
    >,
    calibrationMap: Map<UUID, WorkoutExerciseCalibration>,
    exerciseMap: Map<UUID, WorkoutExercise>,
    equipmentMap: Map<UUID, WorkoutEquipmentType>
  ): {
    sessions: WorkoutSession[];
    sessionExercises: WorkoutSessionExercise[];
    sets: WorkoutSet[];
  } {
    const sessions: WorkoutSession[] = [];
    const sessionExercises: WorkoutSessionExercise[] = [];
    const sets: WorkoutSet[] = [];

    // Distribute exercises across sessions
    const exercisesPerSession = this.distributeExercisesAcrossSessions(
      mesocycle.calibratedExercises,
      mesocycle.plannedSessionCountPerMicrocycle,
      calibrationMap,
      exerciseMap
    );

    let currentSessionDate = new Date(startDate);
    let sessionIndex = 0;

    for (let day = 0; day < mesocycle.plannedMicrocycleLengthInDays; day++) {
      // Skip rest days
      if (mesocycle.plannedMicrocycleRestDays.includes(day)) {
        currentSessionDate = DateService.addDays(currentSessionDate, 1);
        continue;
      }

      // Stop if we've created all planned sessions
      if (sessionIndex >= mesocycle.plannedSessionCountPerMicrocycle) {
        break;
      }

      const sessionExerciseList = exercisesPerSession[sessionIndex] || [];

      // Create session
      const session = WorkoutSessionSchema.parse({
        userId: mesocycle.userId,
        workoutMicrocycleId: microcycle._id,
        title: `Microcycle ${microcycleIndex + 1} - Session ${sessionIndex + 1}`,
        startTime: new Date(currentSessionDate)
      });

      // Add session to microcycle's session order
      microcycle.sessionOrder.push(session._id);

      // Create session exercise groupings and associated sets
      for (let exerciseIndex = 0; exerciseIndex < sessionExerciseList.length; exerciseIndex++) {
        const { calibration, exercise } = sessionExerciseList[exerciseIndex];

        const sessionExercise = WorkoutSessionExerciseSchema.parse({
          userId: mesocycle.userId,
          workoutSessionId: session._id,
          workoutExerciseId: exercise._id
        });

        session.sessionExerciseOrder.push(sessionExercise._id);

        // Calculate number of sets for this exercise in this microcycle
        const setCount = this.calculateSetCount(
          microcycleIndex,
          sessionExerciseList.length,
          exerciseIndex,
          isDeloadMicrocycle
        );

        // Get rep range for this exercise
        const repRange = WorkoutExerciseService.getRepRangeValues(exercise.repRange);

        // Get equipment for weight calculations
        const equipment = equipmentMap.get(exercise.workoutEquipmentTypeId);
        if (!equipment) {
          throw new Error(
            `Equipment type not found for exercise ${exercise._id}, ${exercise.exerciseName}`
          );
        }
        if (!equipment.weightOptions || equipment.weightOptions.length === 0) {
          throw new Error(
            `No weight options defined for equipment type ${equipment._id}, ${equipment.title}`
          );
        }

        // Calculate progressed targets using WorkoutExerciseService
        const { targetWeight, targetReps } = WorkoutExerciseService.calculateProgressedTargets({
          exercise,
          calibration,
          equipment,
          microcycleIndex,
          firstMicrocycleRir: targetRir
        });

        // Create sets
        let currentWeight = targetWeight;
        let currentReps = targetReps;

        for (let setIndex = 0; setIndex < setCount; setIndex++) {
          // Drop 2 reps per set within the session (19 -> 17 -> 15, etc.)
          const nextSetReps = currentReps - 2;

          // Check if next set would go below minimum rep range
          if (nextSetReps < repRange.min && setIndex > 0) {
            // Reduce weight by one increment and bump reps back up by 6
            const currentIndex = equipment.weightOptions.findIndex((w) => w >= currentWeight);
            if (currentIndex > 0) {
              currentWeight = equipment.weightOptions[currentIndex - 1];
            } else {
              currentWeight = Math.max(currentWeight - 5, 0); // Fallback: reduce by 5lbs
            }
            currentReps = nextSetReps + 6;
          }

          const plannedWeight = currentWeight;

          // Apply deload modifications
          let deloadReps = currentReps;
          let deloadWeight = plannedWeight;
          if (isDeloadMicrocycle) {
            deloadReps = Math.floor(currentReps / 2);
            // First half of deload microcycle: same weight, half reps/sets
            // Second half: half weight too
            if (sessionIndex >= Math.floor(mesocycle.plannedSessionCountPerMicrocycle / 2)) {
              deloadWeight = Math.floor(plannedWeight / 2);
            }
          }

          const workoutSet = WorkoutSetSchema.parse({
            userId: mesocycle.userId,
            workoutExerciseId: exercise._id,
            workoutSessionId: session._id,
            workoutSessionExerciseId: sessionExercise._id,
            plannedReps: isDeloadMicrocycle ? deloadReps : currentReps,
            plannedWeight: isDeloadMicrocycle ? deloadWeight : plannedWeight,
            plannedRir: targetRir,
            exerciseProperties: calibration.exerciseProperties
          });

          sessionExercise.setOrder.push(workoutSet._id);
          sets.push(workoutSet);

          // Update currentReps for next set
          currentReps = nextSetReps;
        }

        sessionExercises.push(sessionExercise);
      }

      sessions.push(session);
      sessionIndex++;
      currentSessionDate = DateService.addDays(currentSessionDate, 1);
    }

    return { sessions, sessionExercises, sets };
  }

  private static distributeExercisesAcrossSessions(
    calibratedExerciseIds: UUID[],
    sessionCount: number,
    calibrationMap: Map<UUID, WorkoutExerciseCalibration>,
    exerciseMap: Map<UUID, WorkoutExercise>
  ): Array<{ calibration: WorkoutExerciseCalibration; exercise: WorkoutExercise }[]> {
    const distribution: Array<
      { calibration: WorkoutExerciseCalibration; exercise: WorkoutExercise }[]
    > = [];

    for (let i = 0; i < sessionCount; i++) {
      distribution.push([]);
    }

    // Get all valid exercises
    const validExercises: { calibration: WorkoutExerciseCalibration; exercise: WorkoutExercise }[] =
      [];
    for (const calibrationId of calibratedExerciseIds) {
      const calibration = calibrationMap.get(calibrationId);
      if (!calibration) continue;

      const exercise = exerciseMap.get(calibration.workoutExerciseId);
      if (!exercise) continue;

      validExercises.push({ calibration, exercise });
    }

    // Sort exercises: Heavy first, then Medium, then Light
    validExercises.sort((a, b) => {
      const order = {
        [ExerciseRepRange.Heavy]: 0,
        [ExerciseRepRange.Medium]: 1,
        [ExerciseRepRange.Light]: 2
      };
      return order[a.exercise.repRange] - order[b.exercise.repRange];
    });

    // Distribute exercises evenly across sessions
    validExercises.forEach((ex, index) => {
      distribution[index % sessionCount].push(ex);
    });

    return distribution;
  }

  /**
   * Calculates the number of sets for an exercise based on microcycle progression.
   *
   * Formula: Start at 2 sets per exercise, add 1 total set per microcycle distributed
   * across all exercises (earlier exercises get priority).
   *
   * - Microcycle 1: Exercise 1 gets 2 sets, Exercise 2 gets 2 sets, etc.
   * - Microcycle 2: Exercise 1 gets 3 sets (gets the +1), Exercise 2 gets 2 sets
   * - Microcycle 3 (2 exercises): Exercise 1 gets 3 sets, Exercise 2 gets 3 sets (both get +1)
   *
   * @param microcycleIndex The current microcycle index (0-based).
   * @param totalExercisesInSession Total number of exercises for this muscle group in this session.
   * @param exerciseIndexInSession The index of this exercise within the session (0-based) for
   * the current muscle group.
   * @param isDeloadMicrocycle Whether this is a deload microcycle.
   */
  private static calculateSetCount(
    microcycleIndex: number,
    totalExercisesInSession: number,
    exerciseIndexInSession: number,
    isDeloadMicrocycle: boolean
  ): number {
    // Deload microcycle: half the sets from the previous microcycle, minimum 1 set
    if (isDeloadMicrocycle) {
      const baselineSets = this.calculateSetCount(
        microcycleIndex - 1,
        totalExercisesInSession,
        exerciseIndexInSession,
        false
      );
      return Math.max(1, Math.floor(baselineSets / 2));
    }

    // Total sets to distribute = (2 * number of exercises) + microcycle index
    const totalSets = 2 * totalExercisesInSession + microcycleIndex;

    // Distribute sets evenly, with earlier exercises getting extra sets from remainder
    const baseSetsPerExercise = Math.floor(totalSets / totalExercisesInSession);
    const remainder = totalSets % totalExercisesInSession;

    // If this exercise's index is less than the remainder, it gets an extra set
    return exerciseIndexInSession < remainder ? baseSetsPerExercise + 1 : baseSetsPerExercise;
  }
}
