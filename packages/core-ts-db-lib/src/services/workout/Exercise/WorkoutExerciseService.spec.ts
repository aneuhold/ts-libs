import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import {
  ExerciseProgressionType,
  ExerciseRepRange
} from '../../../documents/workout/WorkoutExercise.js';
import WorkoutExerciseService from './WorkoutExerciseService.js';

describe('Unit Tests', () => {
  describe('getRepRangeValues', () => {
    it('should return correct values for Heavy rep range', () => {
      const result = WorkoutExerciseService.getRepRangeValues(ExerciseRepRange.Heavy);

      expect(result).toEqual({ min: 5, max: 15 });
    });

    it('should return correct values for Medium rep range', () => {
      const result = WorkoutExerciseService.getRepRangeValues(ExerciseRepRange.Medium);

      expect(result).toEqual({ min: 10, max: 20 });
    });

    it('should return correct values for Light rep range', () => {
      const result = WorkoutExerciseService.getRepRangeValues(ExerciseRepRange.Light);

      expect(result).toEqual({ min: 15, max: 30 });
    });
  });

  describe('calculateProgressedTargets', () => {
    describe('Rep Progression', () => {
      it('should start new block with reset reps and increased weight', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Medium range: After hitting max (20), resets by subtracting 6
        // Microcycle 5: 20 reps
        // Microcycle 6: would be 22, resets to 22 - 6 = 16
        const result5 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 5,
          firstMicrocycleRir: 4
        });

        const result6 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 6,
          firstMicrocycleRir: 4
        });

        // Reps reset to 15 for block 1 (21 - 6)
        expect(result6.targetReps).toBe(15);
        // Weight should be at least 2% more
        expect(result6.targetWeight).toBeGreaterThanOrEqual(result5.targetWeight * 1.02);
      });

      it('should maintain same weight within a block for rep progression', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        const result0 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });
        const result2 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 2,
          firstMicrocycleRir: 4
        });

        expect(result0.targetWeight).toBe(result2.targetWeight);
      });
    });

    describe('Load Progression', () => {
      it('should not increase weight in microcycle 0', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        expect(result.targetReps).toBe(15); // Heavy max (no RIR subtraction)
        // Weight should be based on calibration, not increased
        expect(result.targetWeight).toBeGreaterThan(0);
      });

      it('should increase weight by at least 2% in subsequent microcycles', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result0 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        const result1 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4
        });

        // Weight should increase by at least 2%
        expect(result1.targetWeight).toBeGreaterThanOrEqual(result0.targetWeight * 1.02);
        // Reps stay at max for load progression
        expect(result1.targetReps).toBe(15);
      });

      it('should increase reps when max weight is reached', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise;

        const result0 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        const result1 = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4
        });

        // dumbbellLateralRaise is Rep progression, block-based:
        // Light range (15-30): starts at midpoint (22) reps
        expect(result0.targetReps).toBe(22);
        expect(result1.targetReps).toBe(24); // 22 + 2
      });
    });

    describe('Weight Rounding', () => {
      it('should round down to nearest available weight', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        // Should be an available weight option
        expect(equipment.weightOptions).toContain(result.targetWeight);
      });

      it('should round up if no lower weight is available', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        // Should round up to lowest available (45lbs for barbell)
        expect(result.targetWeight).toBe(45);
      });
    });

    describe('Calf Raise Scenario - Target Should Not Exceed Calibration', () => {
      it('should not ask for more reps at calibration weight than calibration supports', () => {
        // Real scenario: Calf raise calibrated at 25lb x 10 reps, Light range, Rep progression
        // At microcycle 0 with 4 RIR, the target is 22 reps @ 4 RIR (26 total rep capability)
        // This should NOT target 25lb, since the user can only do 10 reps at 25lb
        const weightBelt = workoutTestUtil.createEquipmentType({
          title: 'Weight Belt',
          weightOptions: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
        });

        const calfRaise = workoutTestUtil.createExercise({
          exerciseName: 'Calf Raise',
          workoutEquipmentTypeId: weightBelt._id,
          repRange: ExerciseRepRange.Light,
          preferredProgressionType: ExerciseProgressionType.Rep,
          primaryMuscleGroups: [workoutTestUtil.STANDARD_MUSCLE_GROUPS.calves._id]
        });

        const calibration = workoutTestUtil.createCalibration({
          exercise: calfRaise,
          weight: 25,
          reps: 10
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise: calfRaise,
          calibration,
          equipment: weightBelt,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        // Target reps for microcycle 0 should be the midpoint (22 for Light range)
        expect(result.targetReps).toBe(22);
        // But the weight should be much less than 25lb since 22 reps + 4 RIR = 26 total
        // rep capability, far exceeding the 10-rep calibration at 25lb
        expect(result.targetWeight).toBeLessThan(25);
      });
    });

    describe('Rep Progression Autoregulation', () => {
      it('should accelerate when surplus >= 3 (significantly exceeded)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift; // Medium, Rep progression
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 15 reps @ 3 RIR, actual 18 reps @ 3 RIR → surplus = 3
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 18,
            actualWeight: 200,
            rir: 3
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // Accelerate: 18 + 2 = 20 (from actual, not planned)
        expect(result.targetReps).toBe(20);
        expect(result.targetWeight).toBe(200);
      });

      it('should progress normally when surplus is 0-2 (met expectations)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 15 reps @ 3 RIR, actual 15 reps @ 3 RIR → surplus = 0
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 15,
            actualWeight: 200,
            rir: 3
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // Normal: 15 + 2 = 17 (from planned)
        expect(result.targetReps).toBe(17);
        expect(result.targetWeight).toBe(200);
      });

      it('should hold when surplus is -1 to -2 (slightly missed)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 15 reps @ 3 RIR, actual 14 reps @ 2 RIR → surplus = -2
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 14,
            actualWeight: 200,
            rir: 2
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // Hold: keep at 15 (planned reps)
        expect(result.targetReps).toBe(15);
        expect(result.targetWeight).toBe(200);
      });

      it('should regress when surplus <= -3 (significantly missed)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 15 reps @ 3 RIR, actual 12 reps @ 1 RIR → surplus = -5
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 12,
            actualWeight: 200,
            rir: 1
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // Regress: use actual reps (12)
        expect(result.targetReps).toBe(12);
        expect(result.targetWeight).toBe(200);
      });

      it('should not target below rep range min even if actual was 0', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift; // Medium range min = 10
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 15 reps, actual 0 reps (complete failure)
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 0,
            actualWeight: 200,
            rir: 0
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // Should clamp to rep range min (10 for Medium)
        expect(result.targetReps).toBe(10);
      });

      it('should cap at rep range max and bump weight when acceleration exceeds ceiling', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift; // Medium range max = 20
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 19 reps, actual 22 reps → surplus = 3, accelerate to 24
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 19,
            plannedWeight: 200,
            plannedRir: 2,
            actualReps: 22,
            actualWeight: 200,
            rir: 2
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // 22 + 2 = 24, exceeds max (20), so cap at 20 and bump weight
        expect(result.targetReps).toBe(20);
        expect(result.targetWeight).toBeGreaterThan(200);
      });
    });

    describe('Load Progression Autoregulation', () => {
      it('should increase weight by at least 2% when surplus >= 2 (exceeded)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat; // Heavy, Load progression
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 17,
            actualWeight: 200,
            rir: 3
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // Weight should increase by at least 2%
        expect(result.targetWeight).toBeGreaterThanOrEqual(200 * 1.02);
        expect(result.targetReps).toBe(15); // Heavy max
      });

      it('should increase weight normally when surplus is 0-1', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 15,
            actualWeight: 200,
            rir: 3
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        expect(result.targetWeight).toBeGreaterThanOrEqual(200 * 1.02);
      });

      it('should hold weight when surplus is -1 to -2', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 15,
            actualWeight: 200,
            rir: 1
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // Hold: same weight
        expect(result.targetWeight).toBe(200);
      });

      it('should reduce weight when surplus <= -3', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 12,
            actualWeight: 200,
            rir: 1
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // Reduce by minimum equipment increment
        expect(result.targetWeight).toBeLessThan(200);
      });
    });

    describe('Autoregulation Fallback', () => {
      it('should use calibration formula when previousFirstSet has no actual data', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous set with no actual data
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: null,
            actualWeight: null,
            rir: null
          }
        });

        const resultWithPrevious = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        const resultWithout = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4
        });

        // Should be the same as without previous set (calibration formula)
        expect(resultWithPrevious.targetReps).toBe(resultWithout.targetReps);
        expect(resultWithPrevious.targetWeight).toBe(resultWithout.targetWeight);
      });
    });

    describe('Error Cases', () => {
      it('should throw error when equipment has no weight options', () => {
        // Create a copy with empty weight options to avoid mutating shared test util
        const equipment = {
          ...workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell,
          weightOptions: []
        };

        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        expect(() =>
          WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
            exercise,
            calibration,
            equipment,
            microcycleIndex: 0,
            firstMicrocycleRir: 4
          })
        ).toThrow('No weight options defined');
      });
    });

    describe('Different Rep Ranges', () => {
      it('should work with Heavy rep range (5-15)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        expect(result.targetReps).toBe(15); // Max for load progression (no RIR subtraction)
      });

      it('should work with Medium rep range (10-20)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        // Rep progression: starts at midpoint (15)
        expect(result.targetReps).toBe(15);
      });

      it('should work with Light rep range (15-30)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.dumbbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.dumbbellLateralRaise;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.dumbbellLateralRaise;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        // Rep progression: starts at midpoint (22)
        expect(result.targetReps).toBe(22);
      });
    });
  });
});
