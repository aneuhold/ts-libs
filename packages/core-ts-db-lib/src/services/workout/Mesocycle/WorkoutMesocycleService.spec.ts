import { describe, expect, it } from 'vitest';
import { CycleType, WorkoutMesocycleSchema } from '../../../documents/workout/WorkoutMesocycle.js';
import DocumentService from '../../DocumentService.js';
import WorkoutMesocycleService from './WorkoutMesocycleService.js';

describe('Unit Tests', () => {
  describe('generateInitialPlan', () => {
    it('should return a valid output structure', () => {
      const mesocycle = WorkoutMesocycleSchema.parse({
        userId: DocumentService.generateID(),
        cycleType: CycleType.MuscleGain,
        plannedSessionCountPerMicrocycle: 4,
        plannedMicrocycleLengthInDays: 7,
        plannedMicrocycleRestDays: [2, 5],
        plannedMicrocycleCount: 6,
        calibratedExercises: []
      });

      const result = WorkoutMesocycleService.generateInitialPlan(mesocycle, [], [], []);

      expect(result).toBeDefined();
      expect(result.microcycles).toBeDefined();
      expect(result.sessions).toBeDefined();
      expect(result.sessionExercises).toBeDefined();
      expect(result.sets).toBeDefined();
      expect(result.microcycles.create).toBeInstanceOf(Array);
      expect(result.microcycles.update).toBeInstanceOf(Array);
      expect(result.microcycles.delete).toBeInstanceOf(Array);
    });
  });
});
