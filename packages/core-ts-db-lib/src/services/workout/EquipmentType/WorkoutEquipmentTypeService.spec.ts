import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../../test-utils/WorkoutTestUtil.js';
import WorkoutEquipmentTypeService from './WorkoutEquipmentTypeService.js';

describe('Unit Tests', () => {
  describe('generateWeightOptions', () => {
    it('should generate weight options with standard increment', () => {
      const result = WorkoutEquipmentTypeService.generateWeightOptions(45, 5, 70);

      expect(result).toEqual([45, 50, 55, 60, 65, 70]);
    });

    it('should generate weight options with small increment', () => {
      const result = WorkoutEquipmentTypeService.generateWeightOptions(20, 2.5, 30);

      expect(result).toEqual([20, 22.5, 25, 27.5, 30]);
    });

    it('should handle single weight when min equals max', () => {
      const result = WorkoutEquipmentTypeService.generateWeightOptions(45, 5, 45);

      expect(result).toEqual([45]);
    });

    it('should stop at or before maxWeight', () => {
      const result = WorkoutEquipmentTypeService.generateWeightOptions(45, 10, 73);

      expect(result).toEqual([45, 55, 65]);
    });
  });

  describe('generatePlateWeightOptions', () => {
    it('should generate weights from a single plate type', () => {
      const result = WorkoutEquipmentTypeService.generatePlateWeightOptions(45, [
        { weight: 45, pairs: 2 }
      ]);

      expect(result).toEqual([45, 135, 225]);
    });

    it('should generate all combinations from multiple plate types', () => {
      const result = WorkoutEquipmentTypeService.generatePlateWeightOptions(45, [
        { weight: 25, pairs: 1 },
        { weight: 10, pairs: 1 }
      ]);

      // bar only: 45
      // +25 pair: 45 + 50 = 95
      // +10 pair: 45 + 20 = 65
      // +25 pair +10 pair: 45 + 50 + 20 = 115
      expect(result).toEqual([45, 65, 95, 115]);
    });

    it('should return just bar weight when plates array is empty', () => {
      const result = WorkoutEquipmentTypeService.generatePlateWeightOptions(45, []);

      expect(result).toEqual([45]);
    });

    it('should skip plates with zero or negative weight', () => {
      const result = WorkoutEquipmentTypeService.generatePlateWeightOptions(45, [
        { weight: 0, pairs: 2 },
        { weight: -5, pairs: 1 },
        { weight: 10, pairs: 1 }
      ]);

      expect(result).toEqual([45, 65]);
    });

    it('should skip plates with zero or negative pairs', () => {
      const result = WorkoutEquipmentTypeService.generatePlateWeightOptions(45, [
        { weight: 10, pairs: 0 },
        { weight: 25, pairs: 1 }
      ]);

      expect(result).toEqual([45, 95]);
    });
  });

  describe('findNearestWeight', () => {
    const equipmentType = workoutTestUtil.createEquipmentType({
      title: 'Test Equipment',
      weightOptions: [10, 15, 20, 25, 30, 35, 40]
    });

    describe('direction: up', () => {
      it('should find the smallest weight >= targetWeight', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(equipmentType, 22, 'up');

        expect(result).toBe(25);
      });

      it('should return exact match when available', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(equipmentType, 25, 'up');

        expect(result).toBe(25);
      });

      it('should return null when no weight >= targetWeight exists', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(equipmentType, 45, 'up');

        expect(result).toBeNull();
      });
    });

    describe('direction: down', () => {
      it('should find the largest weight <= targetWeight', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(equipmentType, 22, 'down');

        expect(result).toBe(20);
      });

      it('should return exact match when available', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(equipmentType, 25, 'down');

        expect(result).toBe(25);
      });

      it('should return null when no weight <= targetWeight exists', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(equipmentType, 5, 'down');

        expect(result).toBeNull();
      });
    });

    describe('direction: nearest', () => {
      it('should find the closest weight to targetWeight', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(equipmentType, 22, 'nearest');

        expect(result).toBe(20);
      });

      it('should return exact match when available', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(equipmentType, 25, 'nearest');

        expect(result).toBe(25);
      });

      it('should handle edge case at lower bound', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(equipmentType, 5, 'nearest');

        expect(result).toBe(10);
      });

      it('should handle edge case at upper bound', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(equipmentType, 45, 'nearest');

        expect(result).toBe(40);
      });
    });

    describe('direction: prefer-down', () => {
      it('should find weight <= targetWeight when available', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(
          equipmentType,
          22,
          'prefer-down'
        );

        expect(result).toBe(20);
      });

      it('should fallback to weight >= targetWeight when no lower weight exists', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(
          equipmentType,
          5,
          'prefer-down'
        );

        expect(result).toBe(10);
      });

      it('should return exact match when available', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(
          equipmentType,
          25,
          'prefer-down'
        );

        expect(result).toBe(25);
      });

      it('should return null when no weights are available', () => {
        const emptyEquipment = workoutTestUtil.createEquipmentType({
          title: 'Empty Equipment',
          weightOptions: []
        });

        const result = WorkoutEquipmentTypeService.findNearestWeight(
          emptyEquipment,
          25,
          'prefer-down'
        );

        expect(result).toBeNull();
      });
    });

    describe('direction: prefer-up', () => {
      it('should find weight >= targetWeight when available', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(
          equipmentType,
          22,
          'prefer-up'
        );

        expect(result).toBe(25);
      });

      it('should fallback to weight <= targetWeight when no higher weight exists', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(
          equipmentType,
          45,
          'prefer-up'
        );

        expect(result).toBe(40);
      });

      it('should return exact match when available', () => {
        const result = WorkoutEquipmentTypeService.findNearestWeight(
          equipmentType,
          25,
          'prefer-up'
        );

        expect(result).toBe(25);
      });

      it('should return null when no weights are available', () => {
        const emptyEquipment = workoutTestUtil.createEquipmentType({
          title: 'Empty Equipment',
          weightOptions: []
        });

        const result = WorkoutEquipmentTypeService.findNearestWeight(
          emptyEquipment,
          25,
          'prefer-up'
        );

        expect(result).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('should return null when weightOptions is null', () => {
        const emptyEquipment = workoutTestUtil.createEquipmentType({
          title: 'Empty Equipment',
          weightOptions: null
        });

        const result = WorkoutEquipmentTypeService.findNearestWeight(emptyEquipment, 25, 'nearest');

        expect(result).toBeNull();
      });

      it('should return null when weightOptions is empty', () => {
        const emptyEquipment = workoutTestUtil.createEquipmentType({
          title: 'Empty Equipment',
          weightOptions: []
        });

        const result = WorkoutEquipmentTypeService.findNearestWeight(emptyEquipment, 25, 'nearest');

        expect(result).toBeNull();
      });
    });
  });
});
