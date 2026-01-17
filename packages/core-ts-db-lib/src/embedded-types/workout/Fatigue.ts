import { z } from 'zod';

/**
 * Zod schema for {@link Fatigue}.
 */
export const FatigueSchema = z.object({
  /**
   * Joint and connective tissue disruption score (0-3).
   *
   * - 0: You had minimal to no pain or perturbation in your joints or connective tissues
   * - 1: You had some pain or perturbation in your joints and connective tissues but recovered by the next day
   * - 2: You had some persistent pain or tightness in your connective tissues that lasted through the following day or several days
   * - 3: You develop chronic pain in the joints and connective tissues that persists across days to weeks or longer
   */
  jointAndTissueDisruption: z.number().min(0).max(3).nullish(),
  /**
   * Perceived effort score (0-3).
   *
   * - 0: Training felt very easy and hardly taxed you psychologically
   * - 1: You put effort into the training, but felt recovered by the end of the day
   * - 2: You put a large effort into the training and felt drained through the next day
   * - 3: You put an all-out effort into the training and felt drained for days
   */
  perceivedEffort: z.number().min(0).max(3).nullish(),
  /**
   * Unused muscle performance score (0-3).
   *
   * - 0: Performance on subsequent exercises targeting unused muscles was better than expected
   * - 1: Performance on subsequent exercises targeting unused muscles was as expected
   * - 2: Performance on subsequent exercises targeting unused muscles was worse than expected
   * - 3: Your performance on subsequent exercises targeting unused muscles was hugely deteriorated
   */
  unusedMusclePerformance: z.number().min(0).max(3).nullish()
});

/**
 * Fatigue measurement for a workout session or exercise.
 *
 * The Stimulus to Fatigue Ratio (SFR) can be calculated as RSM / total fatigue score.
 */
export type Fatigue = z.infer<typeof FatigueSchema>;
