import type {
  User,
  WorkoutMuscleGroup,
  WorkoutMuscleGroupVolumeCTO
} from '@aneuhold/core-ts-db-lib';
import {
  WorkoutExercise_docType,
  WorkoutMesocycle_docType,
  WorkoutMicrocycle_docType,
  WorkoutMuscleGroup_docType,
  WorkoutMuscleGroupVolumeCTOSchema,
  WorkoutSession_docType,
  WorkoutSessionExercise_docType
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { RepoListeners } from '../../services/RepoSubscriptionService.js';
import WorkoutMuscleGroupValidator from '../../validators/workout/MuscleGroupValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutMuscleGroup} documents.
 */
export default class WorkoutMuscleGroupRepository extends WorkoutBaseWithUserIdRepository<WorkoutMuscleGroup> {
  private static singletonInstance?: WorkoutMuscleGroupRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(WorkoutMuscleGroup_docType, new WorkoutMuscleGroupValidator());
  }

  static getListenersForUserRepo(): RepoListeners<User> {
    const muscleGroupRepo = WorkoutMuscleGroupRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await muscleGroupRepo.deleteAllForUser(userId, meta);
      },
      deleteList: async (userIds, meta) => {
        await muscleGroupRepo.deleteAllForUsers(userIds, meta);
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link WorkoutMuscleGroupRepository}.
   */
  public static getRepo(): WorkoutMuscleGroupRepository {
    if (!WorkoutMuscleGroupRepository.singletonInstance) {
      WorkoutMuscleGroupRepository.singletonInstance = new WorkoutMuscleGroupRepository();
    }
    return WorkoutMuscleGroupRepository.singletonInstance;
  }

  /**
   * Builds {@link WorkoutMuscleGroupVolumeCTO} objects for all muscle groups
   * belonging to a user. Fetches muscle groups directly, then runs an
   * aggregation pipeline for volume history across completed mesocycles.
   *
   * @param userId The user whose muscle group volume CTOs to build.
   */
  async buildMuscleGroupVolumeCTOsForUser(userId: UUID): Promise<WorkoutMuscleGroupVolumeCTO[]> {
    /** Raw shape of volume pipeline results (grouped by mesocycle + muscle group). */
    interface VolumeRow {
      _id: { mesocycleId: string; muscleGroupId: string };
      startingSetCount: number;
      peakSetCount: number;
      rsmSum: number;
      rsmCount: number;
      sorenessSum: number;
      sorenessCount: number;
      performanceSum: number;
      performanceCount: number;
      recoverySessionCount: number;
      cycleType: string;
      completedDate: Date | null;
    }

    const collection = await this.getCollection();
    const collName = this.collectionName;

    // Part A: fetch all muscle groups
    const muscleGroupsPromise = this.getAllForUser(userId);

    // Part B: aggregation pipeline for volume data
    const volumePromise = collection
      .aggregate<VolumeRow>([
        // Start with completed mesocycles for this user
        {
          $match: {
            docType: WorkoutMesocycle_docType,
            userId,
            completedDate: { $type: 'date' }
          }
        },
        // Most recent first
        { $sort: { completedDate: -1 } },
        // Limit to 10 most recent
        { $limit: 10 },
        // Join microcycles, sorted by start date
        {
          $lookup: {
            from: collName,
            let: { mesoId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$workoutMesocycleId', '$$mesoId'] },
                  docType: WorkoutMicrocycle_docType
                }
              },
              { $sort: { startDate: 1 } }
            ],
            as: '_microcycles'
          }
        },
        // One row per microcycle, tracking index for starting/peak logic
        { $unwind: { path: '$_microcycles', includeArrayIndex: '_microIdx' } },
        // Join sessions for each microcycle
        {
          $lookup: {
            from: collName,
            let: { microId: '$_microcycles._id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$workoutMicrocycleId', '$$microId'] },
                  docType: WorkoutSession_docType
                }
              }
            ],
            as: '_sessions'
          }
        },
        // One row per session (drop empty microcycles)
        { $unwind: { path: '$_sessions', preserveNullAndEmptyArrays: false } },
        // Join session exercises
        {
          $lookup: {
            from: collName,
            let: { sessId: '$_sessions._id' },
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
        // One row per session exercise
        { $unwind: '$_se' },
        // Join exercise doc to get muscle group arrays
        {
          $lookup: {
            from: collName,
            let: { exId: '$_se.workoutExerciseId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$exId'] },
                  docType: WorkoutExercise_docType
                }
              }
            ],
            as: '_exercise'
          }
        },
        // One row per exercise
        { $unwind: '$_exercise' },
        // Combine primary + secondary muscle group IDs
        {
          $addFields: {
            _muscleGroups: {
              $concatArrays: [
                { $ifNull: ['$_exercise.primaryMuscleGroups', []] },
                { $ifNull: ['$_exercise.secondaryMuscleGroups', []] }
              ]
            }
          }
        },
        // One row per (mesocycle, microcycle, session exercise, muscle group)
        { $unwind: '$_muscleGroups' },
        // First group: per (mesocycle, muscleGroup, microcycleIndex) — count sets, sum metrics
        {
          $group: {
            _id: {
              mesocycleId: '$_id',
              muscleGroupId: '$_muscleGroups',
              microIdx: '$_microIdx'
            },
            setCount: { $sum: { $size: { $ifNull: ['$_se.setOrder', []] } } },
            rsmSum: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $ifNull: ['$_se.rsm.mindMuscleConnection', null] }, null] },
                      { $ne: [{ $ifNull: ['$_se.rsm.pump', null] }, null] },
                      { $ne: [{ $ifNull: ['$_se.rsm.disruption', null] }, null] }
                    ]
                  },
                  {
                    $add: ['$_se.rsm.mindMuscleConnection', '$_se.rsm.pump', '$_se.rsm.disruption']
                  },
                  0
                ]
              }
            },
            rsmCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $ifNull: ['$_se.rsm.mindMuscleConnection', null] }, null] },
                      { $ne: [{ $ifNull: ['$_se.rsm.pump', null] }, null] },
                      { $ne: [{ $ifNull: ['$_se.rsm.disruption', null] }, null] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            sorenessSum: {
              $sum: {
                $cond: [
                  { $ne: [{ $ifNull: ['$_se.sorenessScore', null] }, null] },
                  '$_se.sorenessScore',
                  0
                ]
              }
            },
            sorenessCount: {
              $sum: {
                $cond: [{ $ne: [{ $ifNull: ['$_se.sorenessScore', null] }, null] }, 1, 0]
              }
            },
            performanceSum: {
              $sum: {
                $cond: [
                  { $ne: [{ $ifNull: ['$_se.performanceScore', null] }, null] },
                  '$_se.performanceScore',
                  0
                ]
              }
            },
            performanceCount: {
              $sum: {
                $cond: [{ $ne: [{ $ifNull: ['$_se.performanceScore', null] }, null] }, 1, 0]
              }
            },
            recoveryCount: {
              $sum: { $cond: [{ $eq: ['$_se.isRecoveryExercise', true] }, 1, 0] }
            },
            cycleType: { $first: '$cycleType' },
            completedDate: { $first: '$completedDate' }
          }
        },
        // Sort by microcycle index so $first gives the starting microcycle
        { $sort: { '_id.microIdx': 1 } },
        // Second group: per (mesocycle, muscleGroup) — starting/peak set counts, aggregate metrics
        {
          $group: {
            _id: {
              mesocycleId: '$_id.mesocycleId',
              muscleGroupId: '$_id.muscleGroupId'
            },
            startingSetCount: { $first: '$setCount' },
            peakSetCount: { $max: '$setCount' },
            rsmSum: { $sum: '$rsmSum' },
            rsmCount: { $sum: '$rsmCount' },
            sorenessSum: { $sum: '$sorenessSum' },
            sorenessCount: { $sum: '$sorenessCount' },
            performanceSum: { $sum: '$performanceSum' },
            performanceCount: { $sum: '$performanceCount' },
            recoverySessionCount: { $sum: '$recoveryCount' },
            cycleType: { $first: '$cycleType' },
            completedDate: { $first: '$completedDate' }
          }
        }
      ])
      .toArray();

    const [muscleGroups, volumeRows] = await Promise.all([muscleGroupsPromise, volumePromise]);

    // Group volume rows by muscleGroupId
    const historyMap = new Map<string, VolumeRow[]>();
    for (const row of volumeRows) {
      const mgId = row._id.muscleGroupId;
      if (!historyMap.has(mgId)) {
        historyMap.set(mgId, []);
      }
      const arr = historyMap.get(mgId);
      if (arr) {
        arr.push(row);
      }
    }

    // Assemble CTOs
    return muscleGroups.map((mg) => {
      const rows = historyMap.get(mg._id) ?? [];
      const mesocycleHistory = rows.map((row) => ({
        mesocycleId: row._id.mesocycleId,
        cycleType: row.cycleType,
        startingSetCount: row.startingSetCount,
        peakSetCount: row.peakSetCount,
        avgRsm: row.rsmCount > 0 ? row.rsmSum / row.rsmCount : null,
        avgSorenessScore: row.sorenessCount > 0 ? row.sorenessSum / row.sorenessCount : null,
        avgPerformanceScore:
          row.performanceCount > 0 ? row.performanceSum / row.performanceCount : null,
        recoverySessionCount: row.recoverySessionCount,
        completedDate: row.completedDate
      }));

      return WorkoutMuscleGroupVolumeCTOSchema.parse({
        ...mg,
        mesocycleHistory
      });
    });
  }
}
