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
    describe('Calibration-Based Initial Targets', () => {
      it('should compute initial weight from calibration for rep progression', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: []
        });

        // Medium range midpoint = 15 reps
        expect(result.targetReps).toBe(15);
        expect(result.targetWeight).toBeGreaterThan(0);
        expect(equipment.weightOptions).toContain(result.targetWeight);
      });

      it('should compute initial weight from calibration for load progression', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.barbellSquat;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.barbellSquat;

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: []
        });

        // Heavy max = 15 reps for load progression
        expect(result.targetReps).toBe(15);
        expect(result.targetWeight).toBeGreaterThan(0);
        expect(equipment.weightOptions).toContain(result.targetWeight);
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
          firstMicrocycleRir: 4,
          previousSets: []
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
          firstMicrocycleRir: 4,
          previousSets: []
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
          firstMicrocycleRir: 4,
          previousSets: []
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
        });

        // Hold: plannedReps stays at 15 (no rep addition, no regression)
        expect(result.targetReps).toBe(15);
        expect(result.targetWeight).toBe(200);
      });

      it('should regress reps without weight change when surplus is exactly -3', () => {
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
        });

        // Regress: use actual reps (14), keep weight
        expect(result.targetReps).toBe(14);
        expect(result.targetWeight).toBe(200);
      });

      it('should regress reps AND reduce weight when surplus < -3 (severely missed)', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous: planned 15 reps @ 3 RIR, actual 12 reps @ 2 RIR → surplus = -4
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 12,
            actualWeight: 200,
            rir: 2
          }
        });

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
        });

        // Severe regress: use actual reps (clamped to min 10) AND reduce weight
        expect(result.targetReps).toBe(12);
        expect(result.targetWeight).toBeLessThan(200);
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
        });

        // Should clamp to Heavy rep range min (5)
        expect(result.targetReps).toBe(5);
      });

      it('should reset to midpoint and bump weight when acceleration exceeds ceiling', () => {
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
        });

        // 22 + 2 = 24, exceeds max (20), so reset to midpoint (15) and bump weight
        expect(result.targetReps).toBe(15);
        expect(result.targetWeight).toBeGreaterThan(200);
      });

      it('should reset to midpoint when normal progression exceeds ceiling', () => {
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
        });

        // 19 + 2 = 21, exceeds max (20), so reset to midpoint (15) and bump weight
        expect(result.targetReps).toBe(15);
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
        });

        // Output weight must always be a valid equipment weight option
        expect(equipment.weightOptions).toContain(result.targetWeight);
      });
    });

    describe('Multi-Set Surplus Averaging', () => {
      it('should average surplus across all sets and trigger regress when average is -3', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift; // Medium, Rep progression
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Set 1: planned 15 @ 3 RIR, actual 14 @ 2 RIR → surplus = -2
        const set1 = workoutTestUtil.createSet({
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

        // Set 2: planned 13 @ 3 RIR, actual 11 @ 1 RIR → surplus = -4 (terrible)
        const set2 = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 13,
            plannedWeight: 200,
            plannedRir: 3,
            actualReps: 11,
            actualWeight: 200,
            rir: 1
          }
        });

        // Average surplus = (-2 + -4) / 2 = -3
        // With only first set (surplus = -2), algorithm would "hold" at planned reps (15)
        // With averaged surplus (-3), it triggers "regress" to actual reps (14)
        const resultMultiSet = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: [set1, set2]
        });

        const resultFirstSetOnly = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: [set1]
        });

        // First set only: surplus = -2, "hold" → keeps planned reps (15)
        expect(resultFirstSetOnly.targetReps).toBe(15);
        expect(resultFirstSetOnly.targetWeight).toBe(200);

        // Multi-set averaged: surplus = -3, "regress" → uses first set's actual reps (14)
        expect(resultMultiSet.targetReps).toBe(14);
        expect(resultMultiSet.targetWeight).toBe(200);
      });

      it('should trigger severe regress (weight reduction) when multi-set average is very negative', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Set 1: planned 15 @ 4 RIR, actual 15 @ 1 RIR → surplus = -3
        const set1 = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 15,
            plannedWeight: 200,
            plannedRir: 4,
            actualReps: 15,
            actualWeight: 200,
            rir: 1
          }
        });

        // Set 2: planned 13 @ 4 RIR, actual 10 @ 0 RIR → surplus = -7
        const set2 = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 13,
            plannedWeight: 200,
            plannedRir: 4,
            actualReps: 10,
            actualWeight: 200,
            rir: 0
          }
        });

        // Average surplus = (-3 + -7) / 2 = -5 → severe regress (< -3)
        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: [set1, set2]
        });

        // Severe regress: actual reps from first set (15) AND reduced weight
        expect(result.targetReps).toBe(15);
        expect(result.targetWeight).toBeLessThan(200);
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [normalSet]
        });

        const accelerateResult = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment: fineEquipment,
          firstMicrocycleRir: 4,
          previousSets: [accelerateSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
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
            firstMicrocycleRir: 4,
            previousSets: [previousFirstSet]
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
            firstMicrocycleRir: 4,
            previousSets: [previousFirstSet]
          });

          expect(equipment.weightOptions).toContain(result.targetWeight);
        }
      });
    });

    describe('Forecasting from planned data', () => {
      it('should forecast from planned values when previousSets has no actual data', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // Previous set with no actual data (generated but not yet performed)
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

        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
        });

        // Forecasting treats planned as actual with surplus = 0.
        // Rep progression, surplus 0: plannedReps + 2 = 17, weight stays at 200.
        expect(result.targetReps).toBe(17);
        expect(result.targetWeight).toBe(200);
      });

      it('should fall back to calibration when previousSets has no planned RIR', () => {
        const equipment = workoutTestUtil.STANDARD_EQUIPMENT_TYPES.barbell;
        const exercise = workoutTestUtil.STANDARD_EXERCISES.deadlift;
        const calibration = workoutTestUtil.STANDARD_CALIBRATIONS.deadlift;

        // A deload set has no plannedRir, so forecasting cannot produce a surplus
        const previousFirstSet = workoutTestUtil.createSet({
          exercise,
          overrides: {
            plannedReps: 8,
            plannedWeight: 100,
            plannedRir: null,
            actualReps: null,
            actualWeight: null,
            rir: null
          }
        });

        const resultWithPrevious = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: [previousFirstSet]
        });

        const resultWithout = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: []
        });

        // With no planned RIR, forecasting can't work — falls back to calibration
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
            firstMicrocycleRir: 4,
            previousSets: []
          })
        ).toThrow('No weight options defined');
      });
    });

    describe('Cross-Mesocycle Continuity', () => {
      it('should use lastAccumulationSessionSets actual weight when exercise was used previously with same rep range', () => {
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

        // First microcycle of a NEW mesocycle, with previousSets from CTO
        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: [lastFirstSet]
        });

        // The calibration-based weight for this exercise would be different from 225.
        // With autoregulation (surplus = 0, load progression), weight should increase by 2%
        // from the previous planned weight (225), not recalculate from calibration.
        const calibrationOnlyResult =
          WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
            exercise,
            calibration,
            equipment,
            firstMicrocycleRir: 4,
            previousSets: []
          });

        // The autoregulated result should differ from the calibration-only result,
        // proving it used the previous performance data instead of the calibration formula
        expect(result.targetWeight).not.toBe(calibrationOnlyResult.targetWeight);
        // Should progress from 225 (normal progression: increase by 2%)
        expect(result.targetWeight).toBeGreaterThanOrEqual(225 * 1.02);
      });

      it('should use lastAccumulationSessionSets actual weight for rep progression exercises from previous mesocycle', () => {
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
          firstMicrocycleRir: 4,
          previousSets: [lastFirstSet]
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

        // No previousSets (empty array — new exercise in the mesocycle)
        const result = WorkoutExerciseService.calculateTargetRepsAndWeightForFirstSet({
          exercise,
          calibration,
          equipment,
          firstMicrocycleRir: 4,
          previousSets: []
        });

        // Should use calibration-based formula
        expect(result.targetWeight).toBeGreaterThan(0);
        expect(result.targetReps).toBe(15); // Heavy max for load progression
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
          firstMicrocycleRir: 4,
          previousSets: []
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
          firstMicrocycleRir: 4,
          previousSets: []
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
          firstMicrocycleRir: 4,
          previousSets: []
        });

        // Rep progression: starts at midpoint (22)
        expect(result.targetReps).toBe(22);
      });
    });
  });
});
