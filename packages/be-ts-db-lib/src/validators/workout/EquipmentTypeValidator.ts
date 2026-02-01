import type { WorkoutEquipmentType } from '@aneuhold/core-ts-db-lib';
import { WorkoutEquipmentTypeSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
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

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
