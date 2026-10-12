import type { WorkoutUserConfig } from '@aneuhold/core-ts-db-lib';
import { WorkoutUserConfigSchema } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../repositories/common/UserRepository.js';
import WorkoutUserConfigRepository from '../../repositories/workout/WorkoutUserConfigRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutUserConfigValidator extends IValidator<WorkoutUserConfig> {
  constructor() {
    super(WorkoutUserConfigSchema, WorkoutUserConfigSchema.partial());
  }

  /**
   * Rejects a new config unless its user exists and has no config yet. Every
   * user gets a config when the user is created, so this rejects any other
   * insert.
   *
   * @param newUserConfig The new config to validate.
   */
  protected async validateNewObjectBusinessLogic(newUserConfig: WorkoutUserConfig): Promise<void> {
    const existingConfig = await WorkoutUserConfigRepository.getRepo().getForUser(
      newUserConfig.userId
    );
    if (existingConfig) {
      ErrorUtils.throwError(
        `WorkoutUserConfig already exists for user: ${newUserConfig.userId}`,
        newUserConfig
      );
    }
    const user = await UserRepository.getRepo().get({ _id: newUserConfig.userId });
    if (!user) {
      ErrorUtils.throwError(`User does not exist: ${newUserConfig.userId}`, newUserConfig);
    }
  }

  protected validateUpdateObjectBusinessLogic(
    updatedUserConfig: Partial<WorkoutUserConfig>
  ): Promise<void> {
    if (!updatedUserConfig._id) {
      ErrorUtils.throwError('No _id defined for WorkoutUserConfig update.', updatedUserConfig);
    }
    return Promise.resolve();
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const userConfigRepo = WorkoutUserConfigRepository.getRepo();
    const allUserConfigs = await userConfigRepo.getAll();
    const allUsers = await UserRepository.getRepo().getAll();
    const allUserIds = new Set(allUsers.map((user) => user._id));
    const userIdsWithConfig = new Set(allUserConfigs.map((userConfig) => userConfig.userId));

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Workout User Config',
      allDocs: allUserConfigs,
      shouldDelete: (userConfig: WorkoutUserConfig) => {
        if (!allUserIds.has(userConfig.userId)) {
          DR.logger.error(
            `Workout User Config with ID: ${userConfig._id} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      deletionFunction: async (docIdsToDelete: UUID[]) => {
        await userConfigRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: WorkoutUserConfig[]) => {
        await userConfigRepo.updateMany(docsToUpdate);
      },
      missingDocs: {
        docs: allUsers
          .filter((user) => user.projectAccess.workout && !userIdsWithConfig.has(user._id))
          .map((user) => WorkoutUserConfigSchema.parse({ userId: user._id })),
        insertionFunction: async (docsToInsert: WorkoutUserConfig[]) => {
          await userConfigRepo.insertMany(docsToInsert);
        }
      }
    });
  }
}
