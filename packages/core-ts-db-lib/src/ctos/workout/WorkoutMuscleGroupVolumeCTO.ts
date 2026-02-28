import { z } from 'zod';
import { WorkoutMuscleGroupSchema } from '../../documents/workout/WorkoutMuscleGroup.js';
import { MesocycleVolumeSummarySchema } from '../../embedded-types/workout/MesocycleVolumeSummary.js';

/**
 * The schema for {@link WorkoutMuscleGroupVolumeCTO}.
 *
 * Bundles a muscle group with its per-mesocycle volume history. Enables
 * volume landmark estimation, recovery session return logic, and cycle-type
 * volume adjustments without core service methods needing to query across
 * mesocycles.
 */
export const WorkoutMuscleGroupVolumeCTOSchema = z.object({
  ...WorkoutMuscleGroupSchema.shape,

  /**
   * Volume history for this muscle group across completed mesocycles.
   * Ordered newest-first. Limited to the last 10 mesocycles to keep the CTO
   * lightweight.
   */
  mesocycleHistory: z.array(MesocycleVolumeSummarySchema)
});

/**
 * A CTO that bundles a workout muscle group with its per-mesocycle volume
 * history, including set counts, RSM/soreness/performance averages, and
 * recovery session counts across completed mesocycles.
 */
export type WorkoutMuscleGroupVolumeCTO = z.infer<typeof WorkoutMuscleGroupVolumeCTOSchema>;
