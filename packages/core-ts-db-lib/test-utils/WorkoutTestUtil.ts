import type { UUID } from 'crypto';
import type { WorkoutEquipmentType } from '../src/documents/workout/WorkoutEquipmentType.js';
import { WorkoutEquipmentTypeSchema } from '../src/documents/workout/WorkoutEquipmentType.js';
import type { WorkoutExercise } from '../src/documents/workout/WorkoutExercise.js';
import {
  ExerciseProgressionType,
  ExerciseRepRange,
  WorkoutExerciseSchema
} from '../src/documents/workout/WorkoutExercise.js';
import type {
  CalibrationExercisePair,
  WorkoutExerciseCalibration
} from '../src/documents/workout/WorkoutExerciseCalibration.js';
import { WorkoutExerciseCalibrationSchema } from '../src/documents/workout/WorkoutExerciseCalibration.js';
import type { WorkoutMesocycle } from '../src/documents/workout/WorkoutMesocycle.js';
import { CycleType, WorkoutMesocycleSchema } from '../src/documents/workout/WorkoutMesocycle.js';
import type { WorkoutMicrocycle } from '../src/documents/workout/WorkoutMicrocycle.js';
import { WorkoutMicrocycleSchema } from '../src/documents/workout/WorkoutMicrocycle.js';
import { WorkoutMuscleGroupSchema } from '../src/documents/workout/WorkoutMuscleGroup.js';
import type { WorkoutSession } from '../src/documents/workout/WorkoutSession.js';
import { WorkoutSessionSchema } from '../src/documents/workout/WorkoutSession.js';
import type { WorkoutSessionExercise } from '../src/documents/workout/WorkoutSessionExercise.js';
import { WorkoutSessionExerciseSchema } from '../src/documents/workout/WorkoutSessionExercise.js';
import type { WorkoutSet } from '../src/documents/workout/WorkoutSet.js';
import { WorkoutSetSchema } from '../src/documents/workout/WorkoutSet.js';
import type { Fatigue } from '../src/embedded-types/workout/Fatigue.js';
import type { RSM } from '../src/embedded-types/workout/Rsm.js';
import DocumentService from '../src/services/DocumentService.js';
import WorkoutMesocyclePlanContext from '../src/services/workout/Mesocycle/WorkoutMesocyclePlanContext.js';
import WorkoutMesocycleService from '../src/services/workout/Mesocycle/WorkoutMesocycleService.js';
import WorkoutMicrocycleService from '../src/services/workout/Microcycle/WorkoutMicrocycleService.js';

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
    }),
    back: WorkoutMuscleGroupSchema.parse({
      userId: this.userId,
      name: 'Back'
    }),
    triceps: WorkoutMuscleGroupSchema.parse({
      userId: this.userId,
      name: 'Triceps'
    }),
    biceps: WorkoutMuscleGroupSchema.parse({
      userId: this.userId,
      name: 'Biceps'
    }),
    calves: WorkoutMuscleGroupSchema.parse({
      userId: this.userId,
      name: 'Calves'
    }),
    abs: WorkoutMuscleGroupSchema.parse({
      userId: this.userId,
      name: 'Abs'
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
    }),
    cable: WorkoutEquipmentTypeSchema.parse({
      userId: this.userId,
      title: 'Cable Machine',
      weightOptions: [
        10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130,
        140, 150, 160, 170, 180, 190, 200
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
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.quads._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 3,
        perceivedEffort: 3,
        unusedMusclePerformance: 2
      }
    }),
    barbellBenchPress: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Barbell Bench Press',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.barbell._id,
      repRange: ExerciseRepRange.Heavy,
      preferredProgressionType: ExerciseProgressionType.Load,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.chest._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 2,
        perceivedEffort: 3,
        unusedMusclePerformance: 1
      }
    }),
    inclineBenchPress: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Incline Bench Press',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.barbell._id,
      repRange: ExerciseRepRange.Heavy,
      preferredProgressionType: ExerciseProgressionType.Load,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.chest._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 2,
        perceivedEffort: 3,
        unusedMusclePerformance: 1
      }
    }),
    dumbbellChestPress: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Dumbbell Chest Press',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.dumbbell._id,
      repRange: ExerciseRepRange.Heavy,
      preferredProgressionType: ExerciseProgressionType.Load,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.chest._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 2,
        perceivedEffort: 3,
        unusedMusclePerformance: 1
      }
    }),
    deadlift: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Deadlift',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.barbell._id,
      repRange: ExerciseRepRange.Medium,
      preferredProgressionType: ExerciseProgressionType.Rep,
      primaryMuscleGroups: [
        this.STANDARD_MUSCLE_GROUPS.back._id,
        this.STANDARD_MUSCLE_GROUPS.quads._id
      ],
      initialFatigueGuess: {
        jointAndTissueDisruption: 3,
        perceivedEffort: 3,
        unusedMusclePerformance: 3
      }
    }),
    dumbbellLateralRaise: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Dumbbell Lateral Raise',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.dumbbell._id,
      repRange: ExerciseRepRange.Light,
      preferredProgressionType: ExerciseProgressionType.Rep,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.shoulders._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 0,
        perceivedEffort: 1,
        unusedMusclePerformance: 0
      }
    }),
    barbellOverheadPress: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Barbell Overhead Press',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.barbell._id,
      repRange: ExerciseRepRange.Medium,
      preferredProgressionType: ExerciseProgressionType.Load,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.shoulders._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 2,
        perceivedEffort: 2,
        unusedMusclePerformance: 1
      }
    }),
    cableRow: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Cable Row',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.cable._id,
      repRange: ExerciseRepRange.Medium,
      preferredProgressionType: ExerciseProgressionType.Load,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.back._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 2,
        perceivedEffort: 2,
        unusedMusclePerformance: 1
      }
    }),
    dumbbellCurl: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Dumbbell Curl',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.dumbbell._id,
      repRange: ExerciseRepRange.Medium,
      preferredProgressionType: ExerciseProgressionType.Rep,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.biceps._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 0,
        perceivedEffort: 1,
        unusedMusclePerformance: 0
      }
    }),
    cableTricepPushdown: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Cable Tricep Pushdown',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.cable._id,
      repRange: ExerciseRepRange.Medium,
      preferredProgressionType: ExerciseProgressionType.Rep,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.triceps._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 0,
        perceivedEffort: 1,
        unusedMusclePerformance: 0
      }
    }),
    dumbbellCalfRaise: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Dumbbell Calf Raise',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.dumbbell._id,
      repRange: ExerciseRepRange.Light,
      preferredProgressionType: ExerciseProgressionType.Rep,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.calves._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 0,
        perceivedEffort: 1,
        unusedMusclePerformance: 0
      }
    }),
    cableCrunch: WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Cable Crunch',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.cable._id,
      repRange: ExerciseRepRange.Light,
      preferredProgressionType: ExerciseProgressionType.Load,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.abs._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 0,
        perceivedEffort: 1,
        unusedMusclePerformance: 0
      }
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
    inclineBenchPress: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.inclineBenchPress._id,
      weight: 115,
      reps: 8,
      exerciseProperties: {}
    }),
    dumbbellChestPress: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.dumbbellChestPress._id,
      weight: 100,
      reps: 8,
      exerciseProperties: {}
    }),
    deadlift: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.deadlift._id,
      weight: 250,
      reps: 5,
      exerciseProperties: {}
    }),
    dumbbellLateralRaise: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.dumbbellLateralRaise._id,
      weight: 25,
      reps: 10,
      exerciseProperties: {}
    }),
    barbellOverheadPress: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.barbellOverheadPress._id,
      weight: 95,
      reps: 8,
      exerciseProperties: {}
    }),
    cableRow: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.cableRow._id,
      weight: 120,
      reps: 8,
      exerciseProperties: {}
    }),
    dumbbellCurl: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.dumbbellCurl._id,
      weight: 35,
      reps: 10,
      exerciseProperties: {}
    }),
    cableTricepPushdown: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.cableTricepPushdown._id,
      weight: 80,
      reps: 12,
      exerciseProperties: {}
    }),
    dumbbellCalfRaise: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.dumbbellCalfRaise._id,
      weight: 50,
      reps: 15,
      exerciseProperties: {}
    }),
    cableCrunch: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.cableCrunch._id,
      weight: 90,
      reps: 20,
      exerciseProperties: {}
    })
  } as const;

  /**
   * Prints a formatted view of the mesocycle plan showing progression across
   * microcycles, sessions, exercises, and sets.
   *
   * @param planResult The result from generateInitialPlan.
   * @param exercises The exercises used in the plan.
   */
  printMesocyclePlan(
    planResult: ReturnType<typeof WorkoutMesocycleService.generateOrUpdateMesocycle>,
    exercises: WorkoutExercise[]
  ): void {
    const colorPalette = [
      '\u001b[31m',
      '\u001b[32m',
      '\u001b[33m',
      '\u001b[34m',
      '\u001b[35m',
      '\u001b[36m'
    ];
    const colorReset = '\u001b[0m';
    const muscleGroupColorMap = new Map<UUID, { name: string; color: string }>();

    Object.values(this.STANDARD_MUSCLE_GROUPS).forEach((group, index) => {
      muscleGroupColorMap.set(group._id, {
        name: group.name,
        color: colorPalette[index % colorPalette.length]
      });
    });

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
      const microcycleSessions = sessions.filter((s) => s.workoutMicrocycleId === microcycle._id);
      const startDate = new Date(microcycle.startDate).toLocaleDateString();
      const endDate = new Date(microcycle.endDate).toLocaleDateString();

      console.log(`\n${'▼'.repeat(50)}`);
      console.log(`MICROCYCLE ${microIndex + 1} | ${startDate} → ${endDate}`);
      console.log('▼'.repeat(50));

      // Print each session in this microcycle
      microcycleSessions.forEach((session, sessionIndex) => {
        const sessionDate = new Date(session.startTime).toLocaleDateString();
        const sessionExs = sessionExercises.filter((se) => se.workoutSessionId === session._id);

        console.log(`\n  SESSION ${sessionIndex + 1} - ${sessionDate}`);

        // Print each exercise in this session
        sessionExs.forEach((sessionEx, exIndex) => {
          const exercise = exercises.find((e) => e._id === sessionEx.workoutExerciseId);
          const exSets = sets.filter((s) => s.workoutSessionExerciseId === sessionEx._id);

          if (!exercise) return;

          const muscleGroupNames = exercise.primaryMuscleGroups
            .map((groupId) => muscleGroupColorMap.get(groupId))
            .filter((group): group is { name: string; color: string } => Boolean(group))
            .map((group) => `${group.color}${group.name}${colorReset}`)
            .join(', ');

          const muscleGroupLabel = muscleGroupNames.length > 0 ? ` - ${muscleGroupNames}` : '';

          const setStrings = exSets.map((set, setIndex) => {
            const weightStr = set.plannedWeight?.toString() ?? 'N/A';
            const repsStr = set.plannedReps?.toString() ?? 'N/A';
            const rirStr = set.plannedRir?.toString() ?? 'N/A';

            return `Set ${setIndex + 1}: ${weightStr}lbs x ${repsStr}reps - ${rirStr}RIR`;
          });

          console.log(
            `    ${exIndex + 1}. ${exercise.exerciseName} (${exercise.repRange}) [${
              exercise.preferredProgressionType
            }]${muscleGroupLabel}`
          );

          // Print sets
          for (let i = 0; i < setStrings.length; i += 1) {
            console.log(`       ${setStrings[i]}`);
          }
        });
      });

      console.log('\n');
    });

    console.log('='.repeat(100));
    console.log('END OF MESOCYCLE PLAN');
    console.log('='.repeat(100) + '\n');
  }

  /**
   * Creates a workout mesocycle with sensible defaults.
   *
   * @param overrides Optional partial to override default values.
   */
  createMesocycle(overrides: Partial<WorkoutMesocycle> = {}): WorkoutMesocycle {
    return WorkoutMesocycleSchema.parse({
      userId: this.userId,
      cycleType: CycleType.MuscleGain,
      plannedMicrocycleLengthInDays: 7,
      plannedSessionCountPerMicrocycle: 4,
      plannedMicrocycleRestDays: [],
      plannedMicrocycleCount: 3,
      calibratedExercises: [this.STANDARD_CALIBRATIONS.barbellSquat._id],
      ...overrides
    });
  }

  /**
   * Creates a workout microcycle with sensible defaults.
   */
  createMicrocycle(options: {
    mesocycle?: WorkoutMesocycle;
    startDate?: Date;
    endDate?: Date;
    overrides?: Partial<WorkoutMicrocycle>;
  }): WorkoutMicrocycle {
    const { mesocycle, overrides = {} } = options;
    let { startDate, endDate } = options;

    // Use current date if not provided
    if (!startDate) {
      startDate = new Date();
    }

    // Calculate end date based on mesocycle settings if not provided
    if (!endDate && mesocycle) {
      endDate = new Date(startDate.getTime() + mesocycle.plannedMicrocycleLengthInDays * 86400000);
    } else if (!endDate) {
      // Default to 7 days if no mesocycle provided
      endDate = new Date(startDate.getTime() + 7 * 86400000);
    }

    return WorkoutMicrocycleSchema.parse({
      userId: this.userId,
      workoutMesocycleId: mesocycle?._id ?? DocumentService.generateID(),
      startDate,
      endDate,
      ...overrides
    });
  }

  /**
   * Creates a workout session with sensible defaults.
   */
  createSession(options: {
    microcycle?: WorkoutMicrocycle;
    title?: string;
    startTime?: Date;
    overrides?: Partial<WorkoutSession>;
  }): WorkoutSession {
    const { microcycle, title = 'Test Session', startTime, overrides = {} } = options;

    return WorkoutSessionSchema.parse({
      userId: this.userId,
      workoutMicrocycleId: microcycle?._id ?? DocumentService.generateID(),
      title,
      startTime: startTime ?? new Date(),
      ...overrides
    });
  }

  /**
   * Creates a workout session exercise with sensible defaults.
   */
  createSessionExercise(options: {
    session?: WorkoutSession;
    exercise?: WorkoutExercise;
    overrides?: Partial<WorkoutSessionExercise>;
  }): WorkoutSessionExercise {
    const { session, exercise, overrides = {} } = options;

    return WorkoutSessionExerciseSchema.parse({
      userId: this.userId,
      workoutSessionId: session?._id ?? DocumentService.generateID(),
      workoutExerciseId: exercise?._id ?? DocumentService.generateID(),
      ...overrides
    });
  }

  /**
   * Creates a workout exercise with sensible defaults.
   */
  createExercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
    return WorkoutExerciseSchema.parse({
      userId: this.userId,
      exerciseName: 'Test Exercise',
      workoutEquipmentTypeId: this.STANDARD_EQUIPMENT_TYPES.barbell._id,
      repRange: ExerciseRepRange.Medium,
      preferredProgressionType: ExerciseProgressionType.Load,
      primaryMuscleGroups: [this.STANDARD_MUSCLE_GROUPS.chest._id],
      initialFatigueGuess: {
        jointAndTissueDisruption: 1,
        perceivedEffort: 1,
        unusedMusclePerformance: 1
      },
      ...overrides
    });
  }

  /**
   * Creates a workout exercise calibration with sensible defaults.
   */
  createCalibration(options: {
    exercise?: WorkoutExercise;
    weight?: number;
    reps?: number;
    overrides?: Partial<WorkoutExerciseCalibration>;
  }): WorkoutExerciseCalibration {
    const { exercise, weight = 100, reps = 8, overrides = {} } = options;

    return WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: exercise?._id ?? DocumentService.generateID(),
      weight,
      reps,
      exerciseProperties: {},
      ...overrides
    });
  }

  /**
   * Creates a workout equipment type with sensible defaults.
   */
  createEquipmentType(overrides: Partial<WorkoutEquipmentType> = {}): WorkoutEquipmentType {
    return WorkoutEquipmentTypeSchema.parse({
      userId: this.userId,
      title: 'Test Equipment',
      weightOptions: [45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
      ...overrides
    });
  }

  /**
   * Creates a workout set with sensible defaults.
   */
  createSet(options: {
    exercise?: WorkoutExercise;
    session?: WorkoutSession;
    sessionExercise?: WorkoutSessionExercise;
    overrides?: Partial<WorkoutSet>;
  }): WorkoutSet {
    const { exercise, session, sessionExercise, overrides = {} } = options;

    return WorkoutSetSchema.parse({
      userId: this.userId,
      workoutExerciseId: exercise?._id ?? DocumentService.generateID(),
      workoutSessionId: session?._id ?? DocumentService.generateID(),
      workoutSessionExerciseId: sessionExercise?._id ?? DocumentService.generateID(),
      exerciseProperties: {},
      ...overrides
    });
  }

  /**
   * Creates a WorkoutMesocyclePlanContext with sensible defaults.
   */
  createContext(options: {
    mesocycle?: WorkoutMesocycle;
    calibrations?: WorkoutExerciseCalibration[];
    exercises?: WorkoutExercise[];
    equipmentTypes?: WorkoutEquipmentType[];
  }): WorkoutMesocyclePlanContext {
    const {
      mesocycle = this.createMesocycle(),
      calibrations = [this.STANDARD_CALIBRATIONS.barbellSquat],
      exercises = [this.STANDARD_EXERCISES.barbellSquat],
      equipmentTypes = Object.values(this.STANDARD_EQUIPMENT_TYPES)
    } = options;

    return new WorkoutMesocyclePlanContext(mesocycle, calibrations, exercises, equipmentTypes);
  }

  /**
   * Creates a complete historical microcycle with all necessary documents and adds them to the context.
   *
   * Uses the actual service code to generate sessions, session exercises, and sets.
   */
  createHistoricalMicrocycle(options: {
    context: WorkoutMesocyclePlanContext;
    exercisePairs: CalibrationExercisePair[][];
    microcycleStartDate?: Date;
    targetRir?: number;
    isDeloadMicrocycle?: boolean;
    /**
     * Optional overrides for each session's exercise.
     * Array indices correspond to sessions, with each session containing exercise overrides.
     */
    sessionExerciseOverrides?: Array<
      Array<{
        /** Number of sets to create for this exercise (default: generated by service) */
        setCount?: number;
        /** Soreness score 0-3 (default: undefined) */
        sorenessScore?: number;
        /** Performance score 0-3 (default: undefined) */
        performanceScore?: number;
        /** Whether this exercise should be marked as a recovery exercise (default: false) */
        isRecovery?: boolean;
        /** RSM values for SFR calculation */
        rsm?: RSM;
        /** Fatigue values for SFR calculation */
        fatigue?: Fatigue;
      }>
    >;
  }): void {
    const {
      context,
      exercisePairs,
      microcycleStartDate = new Date(),
      targetRir = 2,
      isDeloadMicrocycle = false,
      sessionExerciseOverrides
    } = options;

    // Calculate microcycle end date based on mesocycle settings
    const microcycleEndDate = new Date(
      microcycleStartDate.getTime() + context.mesocycle.plannedMicrocycleLengthInDays * 86400000
    );

    // Create and register the historical microcycle
    const microcycle = this.createMicrocycle({
      mesocycle: context.mesocycle,
      startDate: microcycleStartDate,
      endDate: microcycleEndDate
    });
    context.addMicrocycle(microcycle);

    // Set planned session pairs (this also builds exerciseIdToSessionIndex automatically)
    context.setPlannedSessionExercisePairs(exercisePairs);

    // Use the actual service to generate all sessions, exercises, and sets
    const microcycleIndex = context.microcyclesToCreate.length - 1;
    WorkoutMicrocycleService.generateSessionsForMicrocycle({
      context,
      microcycleIndex,
      targetRir,
      isDeloadMicrocycle
    });

    // Mark all sets as completed with actual performance data
    const newSets = context.setsToCreate.slice(-context.setsToCreate.length);
    newSets.forEach((set) => {
      set.actualReps = set.plannedReps;
      set.actualWeight = set.plannedWeight;
      set.rir = set.plannedRir;
    });

    // Apply session exercise overrides if provided
    if (sessionExerciseOverrides) {
      const sessions = context.sessionsToCreate.filter(
        (s) => s.workoutMicrocycleId === microcycle._id
      );

      sessionExerciseOverrides.forEach((exerciseOverrides, sessionIndex) => {
        if (!exerciseOverrides || sessionIndex >= sessions.length) return;

        const session = sessions[sessionIndex];
        const sessionExercises = context.sessionExercisesToCreate.filter(
          (se) => se.workoutSessionId === session._id
        );

        exerciseOverrides.forEach((overrides, exerciseIndex) => {
          if (!overrides || exerciseIndex >= sessionExercises.length) return;

          const sessionExercise = sessionExercises[exerciseIndex];
          const exercise = exercisePairs[sessionIndex][exerciseIndex].exercise;

          // Apply performance scores
          if (overrides.sorenessScore !== undefined) {
            sessionExercise.sorenessScore = overrides.sorenessScore;
          }
          if (overrides.performanceScore !== undefined) {
            sessionExercise.performanceScore = overrides.performanceScore;
          }

          // Apply recovery flag
          if (overrides.isRecovery !== undefined) {
            sessionExercise.isRecoveryExercise = overrides.isRecovery;
          }

          // Apply RSM and fatigue for SFR calculation
          if (overrides.rsm !== undefined) {
            sessionExercise.rsm = overrides.rsm;
          }
          if (overrides.fatigue !== undefined) {
            sessionExercise.fatigue = overrides.fatigue;
          }

          // Apply custom set count if specified
          if (overrides.setCount !== undefined) {
            // Remove existing sets for this session exercise
            const indicesToRemove: number[] = [];
            context.setsToCreate.forEach((s, index) => {
              if (s.workoutSessionExerciseId === sessionExercise._id) {
                indicesToRemove.push(index);
              }
            });
            for (let i = indicesToRemove.length - 1; i >= 0; i--) {
              context.setsToCreate.splice(indicesToRemove[i], 1);
            }
            sessionExercise.setOrder = [];

            // Create the specified number of sets
            for (let i = 0; i < overrides.setCount; i++) {
              const set = this.createSet({
                exercise,
                session,
                sessionExercise,
                overrides: {
                  plannedReps: 10,
                  plannedWeight: 100,
                  plannedRir: targetRir,
                  actualReps: 10,
                  actualWeight: 100,
                  rir: targetRir
                }
              });
              context.setsToCreate.push(set);
              sessionExercise.setOrder.push(set._id);
            }
          }
        });
      });
    }

    // Mark all sessions in this historical microcycle as complete
    const sessions = context.sessionsToCreate.filter(
      (s) => s.workoutMicrocycleId === microcycle._id
    );
    sessions.forEach((session) => {
      session.complete = true;
    });
  }
}

const workoutTestUtil = new WorkoutTestUtil();
export default workoutTestUtil;
