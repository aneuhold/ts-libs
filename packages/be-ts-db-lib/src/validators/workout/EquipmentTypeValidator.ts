import type { WorkoutEquipmentType } from '@aneuhold/core-ts-db-lib';
import { WorkoutEquipmentTypeSchema } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../repositories/common/UserRepository.js';
import WorkoutEquipmentTypeRepository from '../../repositories/workout/WorkoutEquipmentTypeRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutEquipmentTypeValidator extends IValidator<WorkoutEquipmentType> {
  constructor() {
    super(WorkoutEquipmentTypeSchema, WorkoutEquipmentTypeSchema.partial());
  }

  protected validateNewObjectBusinessLogic(): Promise<void> {
    return Promise.resolve();
  }

  protected validateUpdateObjectBusinessLogic(
    updatedEquipmentType: Partial<WorkoutEquipmentType>
  ): Promise<void> {
    if (!updatedEquipmentType._id) {
      ErrorUtils.throwError(
        'No _id defined for WorkoutEquipmentType update.',
        updatedEquipmentType
      );
    }
    return Promise.resolve();
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const equipmentTypeRepo = WorkoutEquipmentTypeRepository.getRepo();
    const allEquipmentTypes = await equipmentTypeRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Workout Equipment Type',
      allDocs: allEquipmentTypes,
      shouldDelete: (equipmentType: WorkoutEquipmentType) => {
        if (!allUserIds[equipmentType.userId]) {
          DR.logger.error(
            `Workout Equipment Type with ID: ${equipmentType._id} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      deletionFunction: async (docIdsToDelete: UUID[]) => {
        await equipmentTypeRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: WorkoutEquipmentType[]) => {
        await equipmentTypeRepo.updateMany(docsToUpdate);
      }
    });
  }
}
