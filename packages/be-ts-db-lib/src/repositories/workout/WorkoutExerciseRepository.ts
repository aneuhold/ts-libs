import type {
  User,
  WorkoutEquipmentType,
  WorkoutExercise,
  WorkoutExerciseCalibration,
  WorkoutExerciseCTO,
  WorkoutSessionExercise,
  WorkoutSet
} from '@aneuhold/core-ts-db-lib';
import {
  WorkoutEquipmentType_docType,
  WorkoutExercise_docType,
  WorkoutExerciseCalibration_docType,
  WorkoutExerciseCalibrationService,
  WorkoutExerciseCTOSchema,
  WorkoutSession_docType,
  WorkoutSessionExercise_docType,
  WorkoutSet_docType
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutExerciseValidator from '../../validators/workout/ExerciseValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';
import WorkoutExerciseCalibrationRepository from './WorkoutExerciseCalibrationRepository.js';

/**
 * The repository that contains {@link WorkoutExercise} documents.
 */
export default class WorkoutExerciseRepository extends WorkoutBaseWithUserIdRepository<WorkoutExercise> {
  private static singletonInstance?: WorkoutExerciseRepository;

  private constructor() {
    super(WorkoutExercise_docType, new WorkoutExerciseValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const exerciseRepo = WorkoutExerciseRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await exerciseRepo.deleteAllForUser(userId, meta);
      },
      deleteList: async (userIds, meta) => {
        await exerciseRepo.deleteAllForUsers(userIds, meta);
      }
    };
  }

  protected setupSubscribers(): void {
    this.subscribeToChanges(WorkoutExerciseCalibrationRepository.getListenersForExerciseRepo());
  }

  public static getRepo(): WorkoutExerciseRepository {
    if (!WorkoutExerciseRepository.singletonInstance) {
      WorkoutExerciseRepository.singletonInstance = new WorkoutExerciseRepository();
    }
    return WorkoutExerciseRepository.singletonInstance;
  }

  /**
   * Builds {@link WorkoutExerciseCTO} objects for all exercises belonging to a user.
   * Uses two parallel MongoDB aggregation pipelines:
   * - Pipeline A: exercise + equipmentType + bestCalibration + bestSet
   * - Pipeline B: lastSessionExercise + lastFirstSet (from most recent non-deload session)
   *
   * @param userId The user whose exercise CTOs to build.
   */
  async buildExerciseCTOsForUser(userId: UUID): Promise<WorkoutExerciseCTO[]> {
    /** Raw shape of Pipeline A results. */
    interface PipelineARow extends WorkoutExercise {
      _equipArr: WorkoutEquipmentType[];
      _bestCalArr: WorkoutExerciseCalibration[];
      _bestSetArr: WorkoutSet[];
    }

    /** Raw shape of Pipeline B results. */
    interface PipelineBRow {
      _id: string;
      lastSessionExercise: WorkoutSessionExercise;
      _lastFirstSetArr: WorkoutSet[];
    }

    const collection = await this.getCollection();
    const collName = this.collectionName;

    // Pipeline A: Exercise base + equipmentType + bestCalibration + bestSet
    const pipelineAPromise = collection
      .aggregate<PipelineARow>([
        // Start with all exercises for this user
        { $match: { docType: WorkoutExercise_docType, userId } },
        // Join equipment type by workoutEquipmentTypeId
        {
          $lookup: {
            from: collName,
            let: { equipId: '$workoutEquipmentTypeId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$equipId'] },
                  docType: WorkoutEquipmentType_docType
                }
              }
            ],
            as: '_equipArr'
          }
        },
        // Find the best calibration by highest estimated 1RM
        {
          $lookup: {
            from: collName,
            let: { exId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$workoutExerciseId', '$$exId'] },
                  docType: WorkoutExerciseCalibration_docType
                }
              },
              {
                $addFields: {
                  _1rm: WorkoutExerciseCalibrationService.get1RMMongoExpr('$weight', '$reps')
                }
              },
              { $sort: { _1rm: -1 } },
              { $limit: 1 },
              { $project: { _1rm: 0 } }
            ],
            as: '_bestCalArr'
          }
        },
        // Find the best completed set by highest estimated 1RM
        {
          $lookup: {
            from: collName,
            let: { exId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$workoutExerciseId', '$$exId'] },
                  docType: WorkoutSet_docType,
                  actualWeight: { $ne: null },
                  actualReps: { $ne: null }
                }
              },
              {
                $addFields: {
                  _1rm: WorkoutExerciseCalibrationService.get1RMMongoExpr(
                    '$actualWeight',
                    '$actualReps'
                  )
                }
              },
              { $sort: { _1rm: -1 } },
              { $limit: 1 },
              { $project: { _1rm: 0 } }
            ],
            as: '_bestSetArr'
          }
        }
      ])
      .toArray();

    // Pipeline B: lastSessionExercise + lastFirstSet per exercise
    const pipelineBPromise = collection
      .aggregate<PipelineBRow>([
        // Start with all completed sessions for this user
        { $match: { docType: WorkoutSession_docType, userId, complete: true } },
        // Most recent sessions first
        { $sort: { startTime: -1 } },
        // Join each session's session exercises
        {
          $lookup: {
            from: collName,
            let: { sessId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$workoutSessionId', '$$sessId'] },
                  docType: WorkoutSessionExercise_docType
                }
              }
            ],
            as: '_se'
          }
        },
        // One row per session exercise (unwind coalescence optimization)
        { $unwind: '$_se' },
        // Check for non-deload sets (plannedRir is not null)
        {
          $lookup: {
            from: collName,
            let: { seId: '$_se._id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$workoutSessionExerciseId', '$$seId'] },
                  docType: WorkoutSet_docType,
                  plannedRir: { $ne: null }
                }
              },
              { $limit: 1 }
            ],
            as: '_nonDeload'
          }
        },
        // Keep only session exercises with at least one non-deload set
        { $match: { '_nonDeload.0': { $exists: true } } },
        // Per exercise, keep only the most recent session exercise ($first after sort)
        {
          $group: {
            _id: '$_se.workoutExerciseId',
            lastSessionExercise: { $first: '$_se' }
          }
        },
        // Join the first set from that session exercise's setOrder
        {
          $lookup: {
            from: collName,
            let: { firstSetId: { $arrayElemAt: ['$lastSessionExercise.setOrder', 0] } },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$firstSetId'] },
                  docType: WorkoutSet_docType
                }
              }
            ],
            as: '_lastFirstSetArr'
          }
        }
      ])
      .toArray();

    const [rawExercises, rawLastSessions] = await Promise.all([pipelineAPromise, pipelineBPromise]);

    // Build lookup map from Pipeline B
    const lastSessionMap = new Map<
      string,
      {
        lastSessionExercise: WorkoutSessionExercise;
        lastFirstSet: WorkoutSet | null;
      }
    >();
    for (const row of rawLastSessions) {
      lastSessionMap.set(row._id, {
        lastSessionExercise: row.lastSessionExercise,
        lastFirstSet: row._lastFirstSetArr[0] ?? null
      });
    }

    // Assemble and validate CTOs
    return rawExercises.map((raw) => {
      const { _equipArr, _bestCalArr, _bestSetArr, ...exerciseFields } = raw;
      if (_equipArr.length === 0) {
        throw new Error(`Equipment type not found for exercise ${raw._id}`);
      }

      const lastData = lastSessionMap.get(raw._id as string);

      return WorkoutExerciseCTOSchema.parse({
        ...exerciseFields,
        equipmentType: _equipArr[0],
        bestCalibration: _bestCalArr[0] ?? null,
        bestSet: _bestSetArr[0] ?? null,
        lastSessionExercise: lastData?.lastSessionExercise ?? null,
        lastFirstSet: lastData?.lastFirstSet ?? null
      });
    });
  }
}
