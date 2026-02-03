import type { User, WorkoutExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutExercise_docType } from '@aneuhold/core-ts-db-lib';
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
}
