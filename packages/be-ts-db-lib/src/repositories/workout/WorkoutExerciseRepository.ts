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
import type { Document } from 'mongodb';
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
   * Uses three parallel MongoDB aggregation pipelines:
   * - Pipeline A: exercise + equipmentType + bestCalibration + bestSet
   * - Pipeline B (true latest): lastSessionExercise + lastSessionSets from the most
   *   recent completed session, regardless of cycle type / deload status.
   * - Pipeline C (accumulation): lastAccumulationSessionExercise +
   *   lastAccumulationSessionSets from the most recent completed non-deload session.
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

    /** Raw shape of Pipeline B/C results. */
    interface LastSessionRow {
      _id: string;
      lastSessionExercise: WorkoutSessionExercise;
      _lastSessionSetsArr: WorkoutSet[];
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

    // Builds the pipeline that finds, per exercise, the most recent session
    // exercise from a completed session — optionally restricted to non-deload
    // sessions (where plannedRir is not null on at least one set).
    const buildLastSessionPipeline = (accumulationOnly: boolean): Document[] => {
      const accumulationFilter: Document[] = accumulationOnly
        ? [
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
            { $match: { '_nonDeload.0': { $exists: true } } }
          ]
        : [];

      return [
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
        ...accumulationFilter,
        // Per exercise, keep only the most recent session exercise ($first after sort)
        {
          $group: {
            _id: '$_se.workoutExerciseId',
            lastSessionExercise: { $first: '$_se' }
          }
        },
        // Join all sets from the session exercise's setOrder
        {
          $lookup: {
            from: collName,
            let: { setIds: '$lastSessionExercise.setOrder' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$_id', '$$setIds'] },
                  docType: WorkoutSet_docType
                }
              },
              // Preserve the original setOrder by sorting on index position
              {
                $addFields: {
                  _sortIdx: { $indexOfArray: ['$$setIds', '$_id'] }
                }
              },
              { $sort: { _sortIdx: 1 } },
              { $project: { _sortIdx: 0 } }
            ],
            as: '_lastSessionSetsArr'
          }
        }
      ];
    };

    // Pipeline B: most recent session exercise per exercise (any cycle type)
    const pipelineBPromise = collection
      .aggregate<LastSessionRow>(buildLastSessionPipeline(false))
      .toArray();

    // Pipeline C: most recent accumulation (non-deload) session exercise per exercise
    const pipelineCPromise = collection
      .aggregate<LastSessionRow>(buildLastSessionPipeline(true))
      .toArray();

    const [rawExercises, rawLastSessions, rawLastAccumulationSessions] = await Promise.all([
      pipelineAPromise,
      pipelineBPromise,
      pipelineCPromise
    ]);

    const lastSessionMap = new Map(rawLastSessions.map((row) => [row._id, row]));
    const lastAccumulationMap = new Map(rawLastAccumulationSessions.map((row) => [row._id, row]));

    // Assemble and validate CTOs
    return rawExercises.map((raw) => {
      const { _equipArr, _bestCalArr, _bestSetArr, ...exerciseFields } = raw;
      if (_equipArr.length === 0) {
        throw new Error(`Equipment type not found for exercise ${raw._id}`);
      }

      const lastRow = lastSessionMap.get(raw._id);
      const lastAccumulationRow = lastAccumulationMap.get(raw._id);

      return WorkoutExerciseCTOSchema.parse({
        ...exerciseFields,
        equipmentType: _equipArr[0],
        bestCalibration: _bestCalArr[0] ?? null,
        bestSet: _bestSetArr[0] ?? null,
        lastSessionExercise: lastRow?.lastSessionExercise ?? null,
        lastSessionSets: lastRow?._lastSessionSetsArr,
        lastAccumulationSessionExercise: lastAccumulationRow?.lastSessionExercise ?? null,
        lastAccumulationSessionSets: lastAccumulationRow?._lastSessionSetsArr
      });
    });
  }
}
