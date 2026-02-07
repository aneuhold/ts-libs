import type { WorkoutExercise } from '@aneuhold/core-ts-db-lib';
import { WorkoutExerciseSchema } from '@aneuhold/core-ts-db-lib';
import { DR, ErrorUtils } from '@aneuhold/core-ts-lib';
import type { UUID } from 'crypto';
import UserRepository from '../../repositories/common/UserRepository.js';
import WorkoutEquipmentTypeRepository from '../../repositories/workout/WorkoutEquipmentTypeRepository.js';
import WorkoutExerciseRepository from '../../repositories/workout/WorkoutExerciseRepository.js';
import WorkoutMuscleGroupRepository from '../../repositories/workout/WorkoutMuscleGroupRepository.js';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import IValidator from '../BaseValidator.js';

export default class WorkoutExerciseValidator extends IValidator<WorkoutExercise> {
  constructor() {
    super(WorkoutExerciseSchema, WorkoutExerciseSchema.partial());
  }

  protected async validateNewObjectBusinessLogic(
    newExercise: WorkoutExercise,
    meta?: DbOperationMetaData
  ): Promise<void> {
    const errors: string[] = [];

    // Collect all muscle group IDs
    const allMuscleGroupIds = [
      ...newExercise.primaryMuscleGroups,
      ...newExercise.secondaryMuscleGroups
    ];

    // Validate muscle groups exist
    if (allMuscleGroupIds.length > 0) {
      // Filter out muscle groups that are pending creation
      const muscleGroupIdsToCheck = allMuscleGroupIds.filter((id) => !meta?.hasPendingDoc(id));

      if (muscleGroupIdsToCheck.length > 0) {
        const muscleGroupRepo = WorkoutMuscleGroupRepository.getRepo();
        const muscleGroups = await muscleGroupRepo.getList(muscleGroupIdsToCheck);
        if (muscleGroups.length !== muscleGroupIdsToCheck.length) {
          errors.push(
            `Not all muscle groups exist. Found: ${muscleGroups.length}, expected: ${muscleGroupIdsToCheck.length}`
          );
        }
      }
    }

    // Validate equipment type exists
    const isPendingEquipmentType = meta?.hasPendingDoc(newExercise.workoutEquipmentTypeId);

    if (!isPendingEquipmentType) {
      const equipmentRepo = WorkoutEquipmentTypeRepository.getRepo();
      const equipment = await equipmentRepo.get({ _id: newExercise.workoutEquipmentTypeId });
      if (!equipment) {
        errors.push(`Equipment type with ID ${newExercise.workoutEquipmentTypeId} does not exist`);
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, newExercise);
    }
  }

  protected async validateUpdateObjectBusinessLogic(
    updatedExercise: Partial<WorkoutExercise>,
    meta?: DbOperationMetaData
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
      // Filter out muscle groups that are pending creation
      const muscleGroupIdsToCheck = allMuscleGroupIds.filter((id) => !meta?.hasPendingDoc(id));

      if (muscleGroupIdsToCheck.length > 0) {
        const muscleGroupRepo = WorkoutMuscleGroupRepository.getRepo();
        const muscleGroups = await muscleGroupRepo.getList(muscleGroupIdsToCheck);
        if (muscleGroups.length !== muscleGroupIdsToCheck.length) {
          errors.push(
            `Not all muscle groups exist. Found: ${muscleGroups.length}, expected: ${muscleGroupIdsToCheck.length}`
          );
        }
      }
    }

    // Validate equipment type if being updated
    if (updatedExercise.workoutEquipmentTypeId) {
      const isPendingEquipmentType = meta?.hasPendingDoc(updatedExercise.workoutEquipmentTypeId);

      if (!isPendingEquipmentType) {
        const equipmentRepo = WorkoutEquipmentTypeRepository.getRepo();
        const equipment = await equipmentRepo.get({ _id: updatedExercise.workoutEquipmentTypeId });
        if (!equipment) {
          errors.push(
            `Equipment type with ID ${updatedExercise.workoutEquipmentTypeId} does not exist`
          );
        }
      }
    }

    if (errors.length > 0) {
      ErrorUtils.throwErrorList(errors, updatedExercise);
    }
  }

  async validateRepositoryInDb(dryRun: boolean): Promise<void> {
    const exerciseRepo = WorkoutExerciseRepository.getRepo();
    const allExercises = await exerciseRepo.getAll();
    const allUserIds = await UserRepository.getRepo().getAllIdsAsHash();
    const allEquipmentTypeIds = await WorkoutEquipmentTypeRepository.getRepo().getAllIdsAsHash();
    const allMuscleGroupIds = await WorkoutMuscleGroupRepository.getRepo().getAllIdsAsHash();

    await this.runStandardValidationForRepository({
      dryRun,
      docName: 'Workout Exercise',
      allDocs: allExercises,
      shouldDelete: (exercise: WorkoutExercise) => {
        if (!allUserIds[exercise.userId]) {
          DR.logger.error(
            `Workout Exercise with ID: ${exercise._id} has no valid associated user.`
          );
          return true;
        }
        return false;
      },
      additionalValidation: (exercise: WorkoutExercise) => {
        const updatedDoc = { ...exercise };
        const errors: string[] = [];

        // Check equipment type
        if (!allEquipmentTypeIds[exercise.workoutEquipmentTypeId]) {
          errors.push(`Equipment type with ID: ${exercise.workoutEquipmentTypeId} does not exist.`);
        }

        // Check primary muscle groups
        const invalidPrimaryMuscleGroups = exercise.primaryMuscleGroups.filter(
          (id) => !allMuscleGroupIds[id]
        );
        if (invalidPrimaryMuscleGroups.length > 0) {
          errors.push(`Invalid primary muscle groups: ${invalidPrimaryMuscleGroups.join(', ')}`);
          updatedDoc.primaryMuscleGroups = exercise.primaryMuscleGroups.filter(
            (id) => allMuscleGroupIds[id]
          );
        }

        // Check secondary muscle groups
        const invalidSecondaryMuscleGroups = exercise.secondaryMuscleGroups.filter(
          (id) => !allMuscleGroupIds[id]
        );
        if (invalidSecondaryMuscleGroups.length > 0) {
          errors.push(
            `Invalid secondary muscle groups: ${invalidSecondaryMuscleGroups.join(', ')}`
          );
          updatedDoc.secondaryMuscleGroups = exercise.secondaryMuscleGroups.filter(
            (id) => allMuscleGroupIds[id]
          );
        }

        return { updatedDoc, errors };
      },
      deletionFunction: async (docIdsToDelete: UUID[]) => {
        await exerciseRepo.deleteList(docIdsToDelete);
      },
      updateFunction: async (docsToUpdate: WorkoutExercise[]) => {
        await exerciseRepo.updateMany(docsToUpdate);
      }
    });
  }
}
