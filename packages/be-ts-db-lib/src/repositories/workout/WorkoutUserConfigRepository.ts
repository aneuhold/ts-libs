import type { User, WorkoutUserConfig } from '@aneuhold/core-ts-db-lib';
import { WorkoutUserConfig_docType, WorkoutUserConfigSchema } from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { RepoListeners } from '../../services/RepoSubscription.service.js';
import WorkoutUserConfigValidator from '../../validators/workout/UserConfigValidator.js';
import WorkoutBaseWithUserIdRepository from './WorkoutBaseWithUserIdRepository.js';

/**
 * The repository that contains {@link WorkoutUserConfig} documents.
 */
export default class WorkoutUserConfigRepository extends WorkoutBaseWithUserIdRepository<WorkoutUserConfig> {
  static #singletonInstance?: WorkoutUserConfigRepository;

  private constructor() {
    super(WorkoutUserConfig_docType, new WorkoutUserConfigValidator());
  }

  /**
   * Gets the listeners for the user repository. A config is created for each
   * new user with workout access, and deleted with the user.
   */
  static getListenersForUserRepo(): RepoListeners<User> {
    const userConfigRepo = WorkoutUserConfigRepository.getRepo();
    return {
      deleteOne: async (userId, meta) => {
        await userConfigRepo.deleteAllForUser(userId, meta);
      },
      deleteList: async (userIds, meta) => {
        await userConfigRepo.deleteAllForUsers(userIds, meta);
      },
      insertNew: async (user, meta) => {
        if (user.projectAccess.workout) {
          await userConfigRepo.insertNew(WorkoutUserConfigSchema.parse({ userId: user._id }), meta);
        }
      },
      insertMany: async (users, meta) => {
        const usersThatNeedConfig = users.filter((user) => user.projectAccess.workout);
        await userConfigRepo.insertMany(
          usersThatNeedConfig.map((user) => WorkoutUserConfigSchema.parse({ userId: user._id })),
          meta
        );
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link WorkoutUserConfigRepository}.
   */
  public static getRepo(): WorkoutUserConfigRepository {
    if (!WorkoutUserConfigRepository.#singletonInstance) {
      WorkoutUserConfigRepository.#singletonInstance = new WorkoutUserConfigRepository();
    }
    return WorkoutUserConfigRepository.#singletonInstance;
  }

  /**
   * Gets the config for a given user.
   *
   * @param userId The ID of the user to get the config for.
   */
  async getForUser(userId: UUID): Promise<WorkoutUserConfig | null> {
    const collection = await this.getCollection();
    return collection.findOne(this.getFilterWithDefault({ userId }));
  }
}
