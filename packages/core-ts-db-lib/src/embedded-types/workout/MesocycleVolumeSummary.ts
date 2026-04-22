import { z } from 'zod';
import { UUIDSchema } from '../../schemas/UUIDSchema.js';
import { CycleType } from '../../documents/workout/WorkoutMesocycle.js';

/**
 * The schema for {@link MesocycleVolumeSummary}.
 *
 * Summarizes volume data for a muscle group within a single completed
 * mesocycle. Used by {@link WorkoutMuscleGroupVolumeCTO} to provide
 * historical context for volume landmark estimation and progression planning.
 */
export const MesocycleVolumeSummarySchema = z.object({
  /** The mesocycle these stats are from. */
  mesocycleId: UUIDSchema,

  /** The cycle type (MuscleGain, Cut, Resensitization, FreeForm). */
  cycleType: z.enum(CycleType),

  /**
   * Total sets for this muscle group in the first microcycle.
   * Approximates the starting volume (roughly MEV if calibrated correctly).
   */
  startingSetCount: z.number(),

  /**
   * Maximum total sets for this muscle group in any single microcycle.
   * Approximates the peak volume reached (approaching MRV).
   */
  peakSetCount: z.number(),

  /** Average RSM across all session exercises targeting this muscle group. */
  avgRsm: z.number().nullable(),

  /** Average soreness score (0-3) across all session exercises. */
  avgSorenessScore: z.number().nullable(),

  /** Average performance score (0-3) across all session exercises. */
  avgPerformanceScore: z.number().nullable(),

  /**
   * How many session exercises for this muscle group were marked as
   * recovery (isRecoveryExercise = true) during this mesocycle.
   */
  recoverySessionCount: z.number(),

  /** When the mesocycle was completed. Null if not yet completed. */
  completedDate: z.date().nullable()
});

/**
 * Summarizes volume data for a muscle group within a single completed
 * mesocycle, including set counts, RSM/soreness/performance averages,
 * and recovery session counts.
 */
export type MesocycleVolumeSummary = z.infer<typeof MesocycleVolumeSummarySchema>;
