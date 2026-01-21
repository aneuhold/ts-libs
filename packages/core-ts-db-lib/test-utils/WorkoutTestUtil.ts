import type { UUID } from 'crypto';
import { WorkoutEquipmentTypeSchema } from '../src/documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../src/documents/workout/WorkoutExercise.js';
import {
  ExerciseProgressionType,
  ExerciseRepRange,
  WorkoutExerciseSchema
} from '../src/documents/workout/WorkoutExercise.js';
import type { WorkoutExerciseCalibration } from '../src/documents/workout/WorkoutExerciseCalibration.js';
import { WorkoutExerciseCalibrationSchema } from '../src/documents/workout/WorkoutExerciseCalibration.js';
import { WorkoutMuscleGroupSchema } from '../src/documents/workout/WorkoutMuscleGroup.js';
import DocumentService from '../src/services/DocumentService.js';
import WorkoutMesocycleService from '../src/services/workout/Mesocycle/WorkoutMesocycleService.js';

/**
 * A utility class for creating standardized test data for workout-related tests.
 */
class WorkoutTestUtil {
  /**
   * Shared user ID for all test data.
   */
  public readonly userId: UUID = DocumentService.generateID();

  /**
   * Pre-defined muscle groups for consistent testing.
   */
  public readonly STANDARD_MUSCLE_GROUPS = {
    quads: WorkoutMuscleGroupSchema.parse({
      userId: this.userId,
      name: 'Quadriceps'
    }),
    chest: WorkoutMuscleGroupSchema.parse({
      userId: this.userId,
      name: 'Chest'
    }),
    hamstrings: WorkoutMuscleGroupSchema.parse({
      userId: this.userId,
      name: 'Hamstrings'
    }),
    shoulders: WorkoutMuscleGroupSchema.parse({
      userId: this.userId,
      name: 'Shoulders'
    })
  } as const;

  /**
   * Pre-defined equipment types for consistent testing.
   */
  public readonly STANDARD_EQUIPMENT_TYPES = {
    barbell: WorkoutEquipmentTypeSchema.parse({
      userId: this.userId,
      title: 'Barbell',
      weightOptions: [
        45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150, 160, 170, 180,
        190, 200, 225, 250, 275, 300, 325
      ]
    }),
    dumbbell: WorkoutEquipmentTypeSchema.parse({
      userId: this.userId,
      title: 'Dumbbell',
      weightOptions: [
        5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100
      ]
    })
  } as const;

  /**
   * Pre-defined workout exercises with different rep ranges.
   */
  public readonly STANDARD_EXERCISES = {
    barbellSquat: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Barbell Squat',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.barbell._id,
      repRange: ExerciseRepRange.Heavy,
      preferredProgressionType: ExerciseProgressionType.Load,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.quads._id]
    }),
    barbellBenchPress: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Barbell Bench Press',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.barbell._id,
      repRange: ExerciseRepRange.Heavy,
      preferredProgressionType: ExerciseProgressionType.Load,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.chest._id]
    }),
    romanianDeadlift: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Romanian Deadlift',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.barbell._id,
      repRange: ExerciseRepRange.Medium,
      preferredProgressionType: ExerciseProgressionType.Rep,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.hamstrings._id]
    }),
    dumbbellLateralRaise: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Dumbbell Lateral Raise',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.dumbbell._id,
      repRange: ExerciseRepRange.Light,
      preferredProgressionType: ExerciseProgressionType.Rep,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.shoulders._id]
    })
  } as const;

  /**
   * Pre-defined calibrations for the standard exercises.
   */
  public readonly STANDARD_CALIBRATIONS = {
    barbellSquat: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.barbellSquat._id,
      weight: 185,
      reps: 10,
      exerciseProperties: {}
    }),
    barbellBenchPress: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.barbellBenchPress._id,
      weight: 135,
      reps: 5,
      exerciseProperties: {}
    }),
    romanianDeadlift: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.romanianDeadlift._id,
      weight: 200,
      reps: 5,
      exerciseProperties: {}
    }),
    dumbbellLateralRaise: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.dumbbellLateralRaise._id,
      weight: 25,
      reps: 10,
      exerciseProperties: {}
    })
  } as const;

  /**
   * Prints a formatted view of the mesocycle plan showing progression across
   * microcycles, sessions, exercises, and sets.
   *
   * @param planResult The result from generateInitialPlan.
   * @param exercises The exercises used in the plan.
   * @param calibrations The calibrations used in the plan.
   */
  printMesocyclePlan(
    planResult: ReturnType<typeof WorkoutMesocycleService.generateInitialPlan>,
    exercises: WorkoutExercise[],
    calibrations: WorkoutExerciseCalibration[]
  ): void {
    const microcycles = planResult.microcycles?.create ?? [];
    const sessions = planResult.sessions?.create ?? [];
    const sessionExercises = planResult.sessionExercises?.create ?? [];
    const sets = planResult.sets?.create ?? [];

    console.log('\n' + '='.repeat(100));
    console.log('MESOCYCLE PLAN OVERVIEW');
    console.log('='.repeat(100));
    console.log(`Total Microcycles: ${microcycles.length}`);
    console.log(`Total Sessions: ${sessions.length}`);
    console.log(`Total Exercises: ${sessionExercises.length}`);
    console.log(`Total Sets: ${sets.length}`);
    console.log('='.repeat(100) + '\n');

    // Print each microcycle
    microcycles.forEach((microcycle, microIndex) => {
      const microSessions = sessions.filter((s) => s.workoutMicrocycleId === microcycle._id);
      const startDate = new Date(microcycle.startDate).toLocaleDateString();
      const endDate = new Date(microcycle.endDate).toLocaleDateString();

      console.log(`\n${'▼'.repeat(50)}`);
      console.log(`MICROCYCLE ${microIndex + 1} | ${startDate} → ${endDate}`);
      console.log('▼'.repeat(50));

      // Get previous microcycle for comparison
      const prevMicrocycle = microIndex > 0 ? microcycles[microIndex - 1] : null;
      const prevMicroSessions = prevMicrocycle
        ? sessions.filter((s) => s.workoutMicrocycleId === prevMicrocycle._id)
        : [];

      // Print each session in this microcycle
      microSessions.forEach((session, sessionIndex) => {
        const sessionDate = new Date(session.startTime).toLocaleDateString();
        const sessionExs = sessionExercises.filter((se) => se.workoutSessionId === session._id);

        // Get corresponding previous session
        const prevSession = prevMicroSessions[sessionIndex];
        const prevSessionExs = prevSession
          ? sessionExercises.filter((se) => se.workoutSessionId === prevSession._id)
          : [];

        const sessionHeader = `SESSION ${sessionIndex + 1} - ${sessionDate}`;
        const sessionWidth = sessionHeader.length + 1;

        console.log(`\n  ┌${'─'.repeat(sessionWidth)}`);
        console.log(`  │ ${sessionHeader}`);
        console.log(`  ├${'─'.repeat(sessionWidth)}`);

        // Print each exercise in this session
        sessionExs.forEach((sessionEx, exIndex) => {
          const exercise = exercises.find((e) => e._id === sessionEx.workoutExerciseId);
          const calibration = calibrations.find((c) => c.workoutExerciseId === exercise?._id);
          const exSets = sets.filter((s) => s.workoutSessionExerciseId === sessionEx._id);

          // Get corresponding previous exercise's sets
          const prevSessionEx = prevSessionExs[exIndex];
          const prevExSets = prevSessionEx
            ? sets.filter((s) => s.workoutSessionExerciseId === prevSessionEx._id)
            : [];

          if (!exercise) return;

          console.log(`  │`);
          console.log(
            `  │   ${exIndex + 1}. ${exercise.exerciseName} (${exercise.repRange} range)`
          );
          console.log(
            `  │      Calibration: ${calibration?.weight}lbs × ${calibration?.reps} reps | Progression: ${exercise.preferredProgressionType}`
          );

          // Set table header with dynamic width
          const tableHeader = ' Set │ Weight        │ Reps         │ RIR        ';
          const tableWidth = tableHeader.length;

          console.log(`  │      ┌${'─'.repeat(tableWidth)}`);
          console.log(`  │      │${tableHeader}│`);
          console.log(`  │      ├${'─'.repeat(tableWidth)}`);

          exSets.forEach((set, setIndex) => {
            const prevSet = prevExSets[setIndex];

            const weight = set.plannedWeight?.toString() ?? 'N/A';
            const weightDelta =
              prevSet && prevSet.plannedWeight !== set.plannedWeight
                ? ` (${prevSet.plannedWeight})`
                : '';
            const weightStr = `${weight}${weightDelta}`.padEnd(13);

            const reps = set.plannedReps?.toString() ?? 'N/A';
            const repsDelta =
              prevSet && prevSet.plannedReps !== set.plannedReps ? ` (${prevSet.plannedReps})` : '';
            const repsStr = `${reps}${repsDelta}`.padEnd(12);

            const rir = set.plannedRir?.toString() ?? 'N/A';
            const rirDelta =
              prevSet && prevSet.plannedRir !== set.plannedRir ? ` (${prevSet.plannedRir})` : '';
            const rirStr = `${rir}${rirDelta}`.padEnd(11);

            console.log(
              `  │      │  ${(setIndex + 1).toString().padEnd(2)} │ ${weightStr} │ ${repsStr} │ ${rirStr} │`
            );
          });

          console.log(`  │      └${'─'.repeat(tableWidth)}`);
        });

        console.log(`  └${'─'.repeat(sessionWidth)}`);
      });

      console.log('\n');
    });

    console.log('='.repeat(100));
    console.log('END OF MESOCYCLE PLAN');
    console.log('='.repeat(100) + '\n');
  }
}

const workoutTestUtil = new WorkoutTestUtil();
export default workoutTestUtil;
