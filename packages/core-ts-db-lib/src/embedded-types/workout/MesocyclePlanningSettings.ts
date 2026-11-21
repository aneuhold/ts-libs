import { z } from 'zod';

export enum WorkoutRecoverySessionBehavior {
  /**
   * The recovery session uses half of the previous microcycle's set count,
   * with a minimum of 1 set. This is the default behavior.
   */
  HalveSets = 'halveSets',
  /**
   * The recovery session keeps the previous microcycle's set count, with no
   * added sets. It still reduces the weight and reps if needed.
   */
  MaintainSets = 'maintainSets'
}

/**
 * The schema for {@link WorkoutMesocyclePlanningSettings}.
 */
export const WorkoutMesocyclePlanningSettingsSchema = z.object({
  /**
   * How recovery sessions are treated when planning mesocycles.
   */
  recoverySessionBehavior: z
    .enum(WorkoutRecoverySessionBehavior)
    .default(WorkoutRecoverySessionBehavior.HalveSets)
});

/**
 * A user's settings that control how mesocycles are planned.
 */
export type WorkoutMesocyclePlanningSettings = z.infer<
  typeof WorkoutMesocyclePlanningSettingsSchema
>;
