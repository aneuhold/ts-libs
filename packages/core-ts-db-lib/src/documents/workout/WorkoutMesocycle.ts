import type { UUID } from 'crypto';
import { z } from 'zod';
import { RequiredUserIdSchema } from '../../schemas/required-refs/RequiredUserId.js';
import {
  BaseDocumentWithTypeSchema,
  BaseDocumentWithUpdatedAndCreatedDatesSchema
} from '../BaseDocument.js';

/**
 * The type of mesocycle.
 *
 * - MuscleGain: Automatic recommendations will be made for muscle gain
 * - Resensitization: Automatic recommendations for MV training (maintenance)
 * - Cut: Automatic recommendations for fat loss while maintaining muscle
 * - FreeForm: No automatic recommendations, user has full control
 */
export enum CycleType {
  MuscleGain = 'MuscleGain',
  Resensitization = 'Resensitization',
  Cut = 'Cut',
  FreeForm = 'FreeForm'
}

/**
 * The docType value for WorkoutMesocycle documents.
 */
export const WorkoutMesocycle_docType = 'workoutMesocycle';

/**
 * The schema for {@link WorkoutMesocycle} documents.
 */
export const WorkoutMesocycleSchema = z
  .object({
    ...BaseDocumentWithTypeSchema.shape,
    ...RequiredUserIdSchema.shape,
    ...BaseDocumentWithUpdatedAndCreatedDatesSchema.shape,
    docType: z.literal(WorkoutMesocycle_docType).default(WorkoutMesocycle_docType),
    /**
     * An optional title for this mesocycle.
     */
    title: z.string().nullish(),
    /**
     * The IDs of WorkoutExerciseCalibration documents used for this mesocycle.
     *
     * This locks which calibration was used for a mesocycle so historical 1RM
     * values remain accurate even if calibrations are changed later.
     */
    calibratedExercises: z.array(z.uuidv7().transform((val) => val as UUID)).default([]),
    /**
     * The type of this mesocycle. See {@link CycleType} for details.
     */
    cycleType: z.enum(CycleType),
    /**
     * The planned number of workout sessions per microcycle.
     */
    plannedSessionCountPerMicrocycle: z.number(),
    /**
     * The planned length of each microcycle in days.
     *
     * Typically 7 days (one week), but can vary.
     */
    plannedMicrocycleLengthInDays: z.number(),
    /**
     * The planned rest days within each microcycle, represented as day indices.
     *
     * For example, [0, 3] would indicate rest on the first and fourth days of
     * the microcycle.
     */
    plannedMicrocycleRestDays: z.array(z.number()).default([]),
    /**
     * The planned total number of microcycles including accumulation and deload.
     *
     * Should typically be 5-9 microcycles (4-8 accumulation weeks + 1 deload week).
     */
    plannedMicrocycleCount: z.number().min(2).max(20).nullish(),
    /**
     * The date this mesocycle was completed.
     *
     * This should be set after the user gets a "success" completion screen and
     * has buttoned up any last prompts. This should guide them into the next
     * mesocycle.
     */
    completedDate: z.date().nullish()
  })
  .refine((data) => data.calibratedExercises.length >= data.plannedSessionCountPerMicrocycle, {
    message:
      'Number of calibrated exercises must be at least equal to planned sessions per microcycle.' +
      ' Create a slight variation of an existing exercise if needed.',
    path: ['calibratedExercises']
  });

/**
 * Represents a mesocycle - an organized sequence of microcycles ordered to
 * elicit a set of distinct training adaptations.
 *
 * A typical mesocycle is composed of two distinct phases:
 * 1. Accumulation phase: Progress from MEV towards MRV
 * 2. Deload phase: Shorter recovery period
 *
 * The accumulation phase should last 4-8 weeks, followed by a deload phase.
 */
export type WorkoutMesocycle = z.infer<typeof WorkoutMesocycleSchema>;
