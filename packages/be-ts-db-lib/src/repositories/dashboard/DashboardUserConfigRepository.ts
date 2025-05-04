import { DashboardUserConfig, User } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
import {
  AnyBulkWriteOperation,
  BulkWriteResult,
  UpdateFilter,
  UpdateResult
} from 'mongodb';
import { RepoListeners } from '../../services/RepoSubscriptionService.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import DashboardUserConfigValidator from '../../validators/dashboard/UserConfigValidator.js';
import DashboardBaseRepository from './DashboardBaseRepository.js';

/**
 * The repository that contains {@link DashboardUserConfig} documents.
 */
export default class DashboardUserConfigRepository extends DashboardBaseRepository<DashboardUserConfig> {
  private static singletonInstance?: DashboardUserConfigRepository;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    super(
      DashboardUserConfig.docType,
      new DashboardUserConfigValidator(),
      CleanDocument.userId
    );
  }

  /**
   * Gets the listeners for the user repository.
   *
   * @returns The listeners for the user repository.
   */
  static getListenersForUserRepo(): RepoListeners<User> {
    const userConfigRepo = DashboardUserConfigRepository.getRepo();
    return {
      deleteOne: async (userId) => {
        const collection = await userConfigRepo.getCollection();
        await collection.deleteOne({ userId });
        await collection.updateMany(
          { collaborators: userId },
          { $pull: { collaborators: userId } }
        );
      },
      deleteList: async (userIds) => {
        const collection = await userConfigRepo.getCollection();
        await collection.deleteMany({
          userId: { $in: userIds }
        });
        await collection.updateMany({ collaborators: { $in: userIds } }, {
          $pull: { collaborators: { $in: userIds } }
        } as UpdateFilter<DashboardUserConfig>);
      },
      insertNew: async (user) => {
        if (user.projectAccess.dashboard) {
          await userConfigRepo.insertNew(new DashboardUserConfig(user._id));
        }
      },
      insertMany: async (users) => {
        const usersThatNeedConfig = users.filter(
          (user) => user.projectAccess.dashboard
        );
        await userConfigRepo.insertMany(
          usersThatNeedConfig.map((user) => new DashboardUserConfig(user._id))
        );
      }
    };
  }

  protected setupSubscribers(): void {}

  /**
   * Gets the singleton instance of the {@link DashboardUserConfigRepository}.
   *
   * @returns The singleton instance.
   */
  public static getRepo(): DashboardUserConfigRepository {
    if (!DashboardUserConfigRepository.singletonInstance) {
      DashboardUserConfigRepository.singletonInstance =
        new DashboardUserConfigRepository();
    }
    return DashboardUserConfigRepository.singletonInstance;
  }

  /**
   * Inserts a new config for a user. If the user has collaborators, those
   * collaborators will have the current user added to their collaborators list.
   *
   * @param newDoc The new {@link DashboardUserConfig} document to insert.
   * @returns The inserted document or null if insertion failed.
   */
  async insertNew(
    newDoc: DashboardUserConfig
  ): Promise<DashboardUserConfig | null> {
    const result = await super.insertNew(newDoc);
    if (newDoc.collaborators.length > 0) {
      await this.updateCollaboratorsIfNeeded([
        {
          originalDoc: new DashboardUserConfig(newDoc.userId),
          updatedDoc: newDoc
        }
      ]);
    }
    return result;
  }

  /**
   * Inserts a list of new configs for users. If the users have collaborators,
   * those collaborators will have the current user added to their collaborators
   * list.
   *
   * @param newDocs The list of new {@link DashboardUserConfig} documents to insert.
   * @returns The list of inserted documents.
   */
  async insertMany(
    newDocs: DashboardUserConfig[]
  ): Promise<DashboardUserConfig[]> {
    const result = await super.insertMany(newDocs);
    // Simulate having no collaborators originally.
    await this.updateCollaboratorsIfNeeded(
      newDocs.map((doc) => ({
        originalDoc: new DashboardUserConfig(doc.userId),
        updatedDoc: doc
      }))
    );
    return result;
  }

  /**
   * Updates a user config. If the user has collaborators, those collaborators
   * will have the current user added to their collaborators list.
   *
   * @param updatedDoc The updated {@link DashboardUserConfig} document.
   * @returns The result of the update operation.
   */
  async update(
    updatedDoc: Partial<DashboardUserConfig>
  ): Promise<UpdateResult<DashboardUserConfig>> {
    // Get the config before the update
    const originalDoc = await super.get({ _id: updatedDoc._id });
    const result = await super.update(updatedDoc);
    if (originalDoc) {
      await this.updateCollaboratorsIfNeeded([
        { originalDoc, updatedDoc: updatedDoc as DashboardUserConfig }
      ]);
    }
    return result;
  }

  /**
   * Updates multiple user configs. If the users have collaborators, those collaborators
   * will have the current user added to their collaborators list.
   *
   * @param updatedDocs The list of updated {@link DashboardUserConfig} documents.
   * @returns The result of the bulk update operation.
   */
  async updateMany(
    updatedDocs: Partial<DashboardUserConfig>[]
  ): Promise<BulkWriteResult> {
    const docIds: ObjectId[] = [];
    updatedDocs.forEach((doc) => {
      if (doc._id) {
        docIds.push(doc._id);
      }
    });
    const originalDocs = await super.getList(docIds);
    const result = await super.updateMany(updatedDocs);
    await this.updateCollaboratorsIfNeeded(
      originalDocs.map((originalDoc, index) => ({
        originalDoc,
        updatedDoc: updatedDocs[index] as DashboardUserConfig
      }))
    );
    return result;
  }

  /**
   * Gets the config for a given user.
   *
   * @param userId The ID of the user to get the config for.
   * @returns The user config or null if not found.
   */
  async getForUser(userId: ObjectId): Promise<DashboardUserConfig | null> {
    const collection = await this.getCollection();
    const result = await collection.findOne({ userId });
    return result as DashboardUserConfig | null;
  }

  /**
   * Updates the user configs for the collaborators of the provided user
   * configs.
   *
   * If a collaborator is removed from a user config, the collaborator will
   * have the user removed from their collaborators list.
   *
   * If a collaborator is added to a user config, the collaborator will have
   * the user added to their collaborators list.
   *
   * @param docSets The array of document sets containing original and updated documents.
   */
  private async updateCollaboratorsIfNeeded(
    docSets: Array<{
      originalDoc: DashboardUserConfig;
      updatedDoc: Partial<DashboardUserConfig>;
    }>
  ) {
    const bulkOps: AnyBulkWriteOperation<DashboardUserConfig>[] = [];
    // For each set of documents
    docSets.forEach((docSet) => {
      const originalCollaborators = docSet.originalDoc.collaborators;
      const updatedCollaborators = docSet.updatedDoc.collaborators;
      if (
        updatedCollaborators &&
        !this.objectIdArraysAreEqual(
          originalCollaborators,
          updatedCollaborators
        )
      ) {
        // For each original collaborator, if they are not in the updated list,
        // remove the user from their collaborators list
        originalCollaborators.forEach((collaboratorId) => {
          if (!updatedCollaborators.includes(collaboratorId)) {
            bulkOps.push({
              updateOne: {
                filter: { userId: collaboratorId },
                update: { $pull: { collaborators: docSet.originalDoc.userId } }
              }
            });
          }
        });
        // For each updated collaborator, if they are not in the original list,
        // add the user to their collaborators list
        updatedCollaborators.forEach((collaboratorId) => {
          if (!originalCollaborators.includes(collaboratorId)) {
            bulkOps.push({
              updateOne: {
                filter: { userId: collaboratorId },
                update: {
                  $addToSet: { collaborators: docSet.originalDoc.userId }
                }
              }
            });
          }
        });
      }
    });
    if (bulkOps.length !== 0) {
      const collection = await this.getCollection();
      await collection.bulkWrite(bulkOps);
    }
  }
}
