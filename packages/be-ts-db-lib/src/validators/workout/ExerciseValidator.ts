import type { WorkoutExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutExerciseSchema } from '@aneuhold/core-ts-db-lib';
import { ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import WorkoutEquipmentTypeRepository from '../../repositories/workout/WorkoutEquipmentTypeRepository.js';
import WorkoutMuscleGroupRepository from '../../repositories/workout/WorkoutMuscleGroupRepository.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutExerciseValidator extends IValidator<WorkoutExercise> {
  constructor() {
    super(WorkoutExerciseSchema, WorkoutExerciseSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(newExercise: WorkoutExercise): Promise<void> {
    const errors: string[] = [];

    // Collect all muscle group IDs
    const allMuscleGroupIds = [
      ...newExercise.primaryMuscleGroups,
      ...newExercise.secondaryMuscleGroups
    ];

    // Validate muscle groups exist
    if (allMuscleGroupIds.length > 0) {
      const muscleGroupRepo = WorkoutMuscleGroupRepository.getRepo();
      const muscleGroups = await muscleGroupRepo.getList(allMuscleGroupIds);
      if (muscleGroups.length !== allMuscleGroupIds.length) {
        errors.push(
          `Not all muscle groups exist. Found: ${muscleGroups.length}, expected: ${allMuscleGroupIds.length}`
        );
      }
    }

    // Validate equipment type exists
    const equipmentRepo = WorkoutEquipmentTypeRepository.getRepo();
    const equipment = await equipmentRepo.get({ _id: newExercise.workoutEquipmentTypeId });
    if (!equipment) {
      errors.push(`Equipment type with ID ${newExercise.workoutEquipmentTypeId} does not exist`);
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newExercise);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedExercise: Partial<WorkoutExercise>
  ): Promise<void> {
    const errors: string[] = [];

    if (!updatedExercise._id) {
      errors.push('No _id defined for WorkoutExercise update.');
    }

    // Collect all muscle group IDs if being updated
    const allMuscleGroupIds: UUID[] = [];
    if (updatedExercise.primaryMuscleGroups) {
      allMuscleGroupIds.push(...updatedExercise.primaryMuscleGroups);
    }
    if (updatedExercise.secondaryMuscleGroups) {
      allMuscleGroupIds.push(...updatedExercise.secondaryMuscleGroups);
    }

    // Validate muscle groups if being updated
    if (allMuscleGroupIds.length > 0) {
      const muscleGroupRepo = WorkoutMuscleGroupRepository.getRepo();
      const muscleGroups = await muscleGroupRepo.getList(allMuscleGroupIds);
      if (muscleGroups.length !== allMuscleGroupIds.length) {
        errors.push(
          `Not all muscle groups exist. Found: ${muscleGroups.length}, expected: ${allMuscleGroupIds.length}`
        );
      }
    }

    // Validate equipment type if being updated
    if (updatedExercise.workoutEquipmentTypeId) {
      const equipmentRepo = WorkoutEquipmentTypeRepository.getRepo();
      const equipment = await equipmentRepo.get({ _id: updatedExercise.workoutEquipmentTypeId });
      if (!equipment) {
        errors.push(
          `Equipment type with ID ${updatedExercise.workoutEquipmentTypeId} does not exist`
        );
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedExercise);
    }
  }

  validateRepositoryInDb(): Promise<void> {
    return Promise.resolve();
  }
}
