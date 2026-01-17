import { describe, expect, it } from 'vitest';
import type { Fatigue } from '../../../../embedded-types/workout/Fatigue.js';
import type { RSM } from '../../../../embedded-types/workout/Rsm.js';
import WorkoutSFRService from './WorkoutSFRService.js';

describe('Unit Tests', () => {
  const service = new WorkoutSFRService();

  describe('getRsmTotal', () => {
    it('should return the sum of RSM components', () => {
      const rsm: RSM = {
        mindMuscleConnection: 2,
        pump: 3,
        disruption: 1
      };

      const result = service.getRsmTotal(rsm);

      expect(result).toBe(6);
    });

    it('should return null when RSM data is not present', () => {
      const result = service.getRsmTotal(null);

      expect(result).toBeNull();
    });

    it('should return null when RSM data is undefined', () => {
      const result = service.getRsmTotal(undefined);

      expect(result).toBeNull();
    });

    it('should return null when any RSM component is null', () => {
      const rsm: RSM = {
        mindMuscleConnection: 2,
        pump: null,
        disruption: 1
      };

      const result = service.getRsmTotal(rsm);

      expect(result).toBeNull();
    });
  });

  describe('getFatigueTotal', () => {
    it('should return the sum of fatigue components', () => {
      const fatigue: Fatigue = {
        jointAndTissueDisruption: 1,
        perceivedEffort: 2,
        unusedMusclePerformance: 1
      };

      const result = service.getFatigueTotal(fatigue);

      expect(result).toBe(4);
    });

    it('should return null when fatigue data is not present', () => {
      const result = service.getFatigueTotal(null);

      expect(result).toBeNull();
    });

    it('should return null when fatigue data is undefined', () => {
      const result = service.getFatigueTotal(undefined);

      expect(result).toBeNull();
    });

    it('should return null when any fatigue component is null', () => {
      const fatigue: Fatigue = {
        jointAndTissueDisruption: 1,
        perceivedEffort: null,
        unusedMusclePerformance: 1
      };

      const result = service.getFatigueTotal(fatigue);

      expect(result).toBeNull();
    });
  });

  describe('getSFR', () => {
    it('should calculate the Stimulus to Fatigue Ratio', () => {
      const rsm: RSM = {
        mindMuscleConnection: 2,
        pump: 3,
        disruption: 1
      };
      const fatigue: Fatigue = {
        jointAndTissueDisruption: 1,
        perceivedEffort: 2,
        unusedMusclePerformance: 1
      };

      const result = service.getSFR(rsm, fatigue);

      expect(result).toBe(1.5);
    });

    it('should return null when RSM data is missing', () => {
      const fatigue: Fatigue = {
        jointAndTissueDisruption: 1,
        perceivedEffort: 2,
        unusedMusclePerformance: 1
      };

      const result = service.getSFR(null, fatigue);

      expect(result).toBeNull();
    });

    it('should return null when fatigue data is missing', () => {
      const rsm: RSM = {
        mindMuscleConnection: 2,
        pump: 3,
        disruption: 1
      };

      const result = service.getSFR(rsm, null);

      expect(result).toBeNull();
    });

    it('should return RSM total when fatigue total is 0', () => {
      const rsm: RSM = {
        mindMuscleConnection: 2,
        pump: 3,
        disruption: 1
      };
      const fatigue: Fatigue = {
        jointAndTissueDisruption: 0,
        perceivedEffort: 0,
        unusedMusclePerformance: 0
      };

      const result = service.getSFR(rsm, fatigue);

      expect(result).toBe(6);
    });
  });
});
