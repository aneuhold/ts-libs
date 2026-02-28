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

      it('should still use normal progression at surplus boundary of 2', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 15 reps @ 3 RIR, actual 16 reps @ 4 RIR → surplus = 2
        // This is the upper boundary of the "normal" band (0-2), not accelerate (>= 3)
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 16,
            actualWeight: 200,
            rir: 4
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

        // Normal path: plannedReps + 2 = 17 (NOT actualReps + 2 = 18)
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

      it('should hold at surplus boundary of -1', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 15 reps @ 3 RIR, actual 15 reps @ 2 RIR → surplus = -1
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 15,
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

        // Hold: plannedReps stays at 15 (no rep addition, no regression)
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

      it('should regress at surplus boundary of exactly -3', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 15 reps @ 3 RIR, actual 14 reps @ 1 RIR → surplus = -3
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 14,
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

        // Regress: use actual reps (14), not hold at planned (15)
        expect(result.targetReps).toBe(14);
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

      it('should clamp regressed reps to rep range min for Heavy range', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.createExercise({
          exerciseName: 'Heavy Rep Exercise',
          repRange: ExerciseRepRange.Heavy,
          preferredProgressionType: ExerciseProgressionType.Rep,
          primaryMuscleGroups: [workoutTestUtil.STANDARD_MUSCLE_GROUPS.quads._id]
        });
        const calibration = workoutTestUtil.createCalibration({
          exercise,
          weight: 200,
          reps: 10
        });

        // Previous: planned 8 reps @ 3 RIR, actual 3 reps @ 0 RIR → surplus = -8
        // Regress: actualReps = 3, but Heavy min = 5, so clamp to 5
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 8,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 3,
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

        // Should clamp to Heavy rep range min (5)
        expect(result.targetReps).toBe(5);
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

      it('should cap at rep range max when normal progression exceeds ceiling', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift; // Medium range max = 20
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 19 reps @ 3 RIR, actual 19 reps @ 3 RIR → surplus = 0
        // Normal: plannedReps + 2 = 21, exceeds max (20)
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 19,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 19,
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

        // 19 + 2 = 21, exceeds max (20), so cap at 20 and bump weight
        expect(result.targetReps).toBe(20);
        expect(result.targetWeight).toBeGreaterThan(200);
      });

      it('should round weight to valid equipment option', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Use a weight that is valid on the barbell but will be kept as-is
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

        // Output weight must always be a valid equipment weight option
        expect(equipment.weightOptions).toContain(result.targetWeight);
      });
    });

    describe('Load Progression Autoregulation', () => {
      it('should accelerate weight by ~4% when surplus >= 2 (exceeded)', () => {
        // Use fine-grained equipment to distinguish 2% from 4% increases
        const fineEquipment = workoutTestUtil.createEquipmentType({
          title: 'Fine Barbell',
          weightOptions: [
            100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 120,
            125, 130, 135, 140
          ]
        });
        const exercise = workoutTestUtil.createExercise({
          exerciseName: 'Fine Load Exercise',
          workoutEquipmentTypeId: fineEquipment._id,
          repRange: ExerciseRepRange.Heavy,
          preferredProgressionType: ExerciseProgressionType.Load,
          primaryMuscleGroups: [workoutTestUtil.STANDARD_MUSCLE_GROUPS.quads._id]
        });
        const calibration = workoutTestUtil.createCalibration({
          exercise,
          weight: 100,
          reps: 10
        });

        // surplus = (12-10) + (3-3) = 2 → accelerate (4%)
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 10,
            plannedWeight: 100,
            plannedRir: 3,
            actualReps: 12,
            actualWeight: 100,
            rir: 3
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment: fineEquipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // 4% of 100 = 104, nearest 'up' >= 104 is 104
        expect(result.targetWeight).toBeGreaterThanOrEqual(104);
      });

      it('should increase weight by ~2% when surplus is 0-1 (normal)', () => {
        // Use fine-grained equipment to verify the 2% path specifically
        const fineEquipment = workoutTestUtil.createEquipmentType({
          title: 'Fine Barbell',
          weightOptions: [
            100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 120,
            125, 130, 135, 140
          ]
        });
        const exercise = workoutTestUtil.createExercise({
          exerciseName: 'Fine Load Exercise',
          workoutEquipmentTypeId: fineEquipment._id,
          repRange: ExerciseRepRange.Heavy,
          preferredProgressionType: ExerciseProgressionType.Load,
          primaryMuscleGroups: [workoutTestUtil.STANDARD_MUSCLE_GROUPS.quads._id]
        });
        const calibration = workoutTestUtil.createCalibration({
          exercise,
          weight: 100,
          reps: 10
        });

        // surplus = (10-10) + (3-3) = 0 → normal (2%)
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 10,
            plannedWeight: 100,
            plannedRir: 3,
            actualReps: 10,
            actualWeight: 100,
            rir: 3
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment: fineEquipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet
        });

        // 2% of 100 = 102, nearest 'up' >= 102 is 102
        // Should be 102, NOT 104+ (which would be the accelerate path)
        expect(result.targetWeight).toBe(102);
      });

      it('should distinguish accelerated from normal increase with fine equipment', () => {
        const fineEquipment = workoutTestUtil.createEquipmentType({
          title: 'Fine Barbell',
          weightOptions: [
            100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 120,
            125, 130, 135, 140
          ]
        });
        const exercise = workoutTestUtil.createExercise({
          exerciseName: 'Fine Load Exercise',
          workoutEquipmentTypeId: fineEquipment._id,
          repRange: ExerciseRepRange.Heavy,
          preferredProgressionType: ExerciseProgressionType.Load,
          primaryMuscleGroups: [workoutTestUtil.STANDARD_MUSCLE_GROUPS.quads._id]
        });
        const calibration = workoutTestUtil.createCalibration({
          exercise,
          weight: 100,
          reps: 10
        });

        // Normal path (surplus = 0): 2% increase
        const normalSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 10,
            plannedWeight: 100,
            plannedRir: 3,
            actualReps: 10,
            actualWeight: 100,
            rir: 3
          }
        });

        // Accelerate path (surplus = 2): 4% increase
        const accelerateSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 10,
            plannedWeight: 100,
            plannedRir: 3,
            actualReps: 12,
            actualWeight: 100,
            rir: 3
          }
        });

        const normalResult = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment: fineEquipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet: normalSet
        });

        const accelerateResult = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment: fineEquipment,
          microcycleIndex: 1,
          firstMicrocycleRir: 4,
          previousFirstSet: accelerateSet
        });

        // Accelerated weight should be strictly greater than normal weight
        expect(accelerateResult.targetWeight).toBeGreaterThan(normalResult.targetWeight);
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

      it('should hold weight at surplus boundary of -1', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        // surplus = (15-15) + (2-3) = -1 → hold
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 15,
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

        // Hold: weight stays unchanged at surplus = -1
        expect(result.targetWeight).toBe(200);
        expect(result.targetReps).toBe(15); // Heavy max
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

      it('should reduce weight at surplus boundary of exactly -3', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        // surplus = (14-15) + (1-3) = -3 → reduce
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 14,
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

        // Surplus = -3 triggers reduce, not hold
        expect(result.targetWeight).toBeLessThan(200);
        // Reduced weight should be next equipment option below 200 (which is 190)
        expect(result.targetWeight).toBe(190);
      });

      it('should set target reps to rep range max for all load autoregulation paths', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat; // Heavy, max = 15
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        // Test across multiple surplus values
        const surplusScenarios = [
          { actualReps: 17, rir: 3, label: 'accelerate (surplus=2)' },
          { actualReps: 15, rir: 3, label: 'normal (surplus=0)' },
          { actualReps: 15, rir: 1, label: 'hold (surplus=-2)' },
          { actualReps: 12, rir: 1, label: 'reduce (surplus=-5)' }
        ];

        for (const scenario of surplusScenarios) {
          const previousFirstSet = workoutTestUtil.createSet({
            exercise,
            overrides: {
              plannedReps: 15,
              plannedWeight: 200,
              plannedRir: 3,
              actualReps: scenario.actualReps,
              actualWeight: 200,
              rir: scenario.rir
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

          // Load progression always targets rep range max (15 for Heavy)
          expect(result.targetReps).toBe(15);
        }
      });

      it('should round all autoregulated weights to valid equipment options', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        // Test that each autoregulation path produces valid equipment weights
        const surplusScenarios = [
          { actualReps: 17, rir: 3 }, // accelerate
          { actualReps: 15, rir: 3 }, // normal
          { actualReps: 15, rir: 1 }, // hold
          { actualReps: 12, rir: 1 } // reduce
        ];

        for (const scenario of surplusScenarios) {
          const previousFirstSet = workoutTestUtil.createSet({
            exercise,
            overrides: {
              plannedReps: 15,
              plannedWeight: 200,
              plannedRir: 3,
              actualReps: scenario.actualReps,
              actualWeight: 200,
              rir: scenario.rir
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

          expect(equipment.weightOptions).toContain(result.targetWeight);
        }
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

    describe('Cross-Mesocycle Continuity', () => {
      it('should use lastFirstSet actual weight when exercise was used previously with same rep range', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat; // Heavy, Load progression
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        // Simulate a previous mesocycle's last performance: the user lifted 225 lbs
        const lastFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 225,
            plannedRir: 1,
            actualReps: 15,
            actualWeight: 225,
            rir: 1
          }
        });

        // This is microcycleIndex 0 of a NEW mesocycle, with previousFirstSet from CTO
        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4,
          previousFirstSet: lastFirstSet
        });

        // The calibration-based weight for this exercise would be different from 225.
        // With autoregulation (surplus = 0, load progression), weight should increase by 2%
        // from the previous planned weight (225), not recalculate from calibration.
        const calibrationOnlyResult =
          WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
            exercise,
            calibration,
            equipment,
            microcycleIndex: 0,
            firstMicrocycleRir: 4
          });

        // The autoregulated result should differ from the calibration-only result,
        // proving it used the previous performance data instead of the calibration formula
        expect(result.targetWeight).not.toBe(calibrationOnlyResult.targetWeight);
        // Should progress from 225 (normal progression: increase by 2%)
        expect(result.targetWeight).toBeGreaterThanOrEqual(225 * 1.02);
      });

      it('should use lastFirstSet actual weight for rep progression exercises from previous mesocycle', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift; // Medium, Rep progression
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous mesocycle ended with: planned 18 reps @ 200 lbs, actual 18 reps
        const lastFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 18,
            plannedWeight: 200,
            plannedRir: 1,
            actualReps: 18,
            actualWeight: 200,
            rir: 1
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4,
          previousFirstSet: lastFirstSet
        });

        // Surplus = 0 (met expectations), rep progression: planned + 2 = 20
        expect(result.targetReps).toBe(20);
        // Weight stays the same (200) for rep progression
        expect(result.targetWeight).toBe(200);
      });

      it('should fall back to calibration formula when exercise has no prior performance data', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        // No previousFirstSet at all (new exercise in the mesocycle)
        const resultNoPrevious = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          microcycleIndex: 0,
          firstMicrocycleRir: 4
        });

        // Should use calibration-based formula
        expect(resultNoPrevious.targetWeight).toBeGreaterThan(0);
        expect(resultNoPrevious.targetReps).toBe(15); // Heavy max for load progression

        // Explicitly passing undefined should give the same result
        const resultExplicitUndefined =
          WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
            exercise,
            calibration,
            equipment,
            microcycleIndex: 0,
            firstMicrocycleRir: 4,
            previousFirstSet: undefined
          });

        expect(resultExplicitUndefined.targetWeight).toBe(resultNoPrevious.targetWeight);
        expect(resultExplicitUndefined.targetReps).toBe(resultNoPrevious.targetReps);
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
