import type { UUID } from 'crypto';
import { WorkoutEquipmentTypeSchema } from '../src/documents/workout/WorkoutEquipmentType.js';
import {
  ExerciseProgressionType,
  ExerciseRepRange,
  WorkoutExerciseSchema
} from '../src/documents/workout/WorkoutExercise.js';
import { WorkoutExerciseCalibrationSchema } from '../src/documents/workout/WorkoutExerciseCalibration.js';
import { WorkoutMuscleGroupSchema } from '../src/documents/workout/WorkoutMuscleGroup.js';
import DocumentService from '../src/services/DocumentService.js';

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
      reps: 10,
      exerciseProperties: {}
    }),
    romanianDeadlift: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.romanianDeadlift._id,
      weight: 135,
      reps: 12,
      exerciseProperties: {}
    }),
    dumbbellLateralRaise: WorkoutExerciseCalibrationSchema.parse({
      userId: this.userId,
      workoutExerciseId: this.STANDARD_EXERCISES.dumbbellLateralRaise._id,
      weight: 20,
      reps: 15,
      exerciseProperties: {}
    })
  } as const;
}

const workoutTestUtil = new WorkoutTestUtil();
export default workoutTestUtil;
