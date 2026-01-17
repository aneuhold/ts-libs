import { z } from 'zod';

/**
 * Zod schema for {@link Rsm}.
 */
export const RsmSchema = z.object({
  /**
   * Mind muscle connection score (0-3).
   *
   * - 0: You felt barely aware of your target muscles during the exercise
   * - 1: You felt like your target muscles worked, but mildly
   * - 2: You felt a good amount of tension and/or burn in the target muscles
   * - 3: You felt tension and burn close to the limit in your target muscles
   */
  mindMuscleConnection: z.number().min(0).max(3),
  /**
   * Pump score (0-3).
   *
   * - 0: You got no pump at all in the target muscles
   * - 1: You got a very mild pump in the target muscles
   * - 2: You got a decent pump in the target muscles
   * - 3: You got close to maximal pump in the target muscles
   */
  pump: z.number().min(0).max(3),
  /**
   * Muscle disruption score (0-3).
   *
   * - 0: You had no fatigue, perturbation, or soreness in the target muscles
   * - 1: You had some weakness and stiffness after the session in the target muscles, but recovered by the next day
   * - 2: You had weakness and stiffness after the session and experienced soreness the following day
   * - 3: You got much weaker and felt perturbation in the target muscles right after the session and also had soreness for a few days or more
   */
  disruption: z.number().min(0).max(3)
});

/**
 * Raw Stimulus Magnitude (RSM) - the amount of muscle growth stimulus any given
 * workout session or exercise gives.
 *
 * The total RSM score is the sum of mindMuscleConnection, pump, and disruption (0-9).
 */
export type Rsm = z.infer<typeof RsmSchema>;
