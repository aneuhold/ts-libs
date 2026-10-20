import { ProjectName, WorkoutEntitlement, WorkoutUserConfigSchema } from '@aneuhold/core-ts-db-lib';
import { describe, expect, it } from 'vitest';
import workoutTestUtil from '../../../test-util/projects/workout/workoutTestUtil.js';
import UserRepository from '../common/UserRepository.js';
import WorkoutUserConfigRepository from './WorkoutUserConfigRepository.js';

describe('Integration Tests', () => {
  describe('WorkoutUserConfigRepository', () => {
    const repo = WorkoutUserConfigRepository.getRepo();
    const userRepo = UserRepository.getRepo();

    describe('Lifecycle with User', () => {
      // Runs first so the user inserts are the first repository calls in this file
      it('creates one config per user when users are inserted concurrently', async () => {
        const [firstUser, secondUser] = await Promise.all([
          workoutTestUtil.insertUser('WorkoutUserConfigRepository'),
          workoutTestUtil.insertUser('WorkoutUserConfigRepository')
        ]);

        const configs = await repo.getAllForUsers([firstUser._id, secondUser._id]);

        expect(configs).toHaveLength(2);
      });

      it('creates a config when a user with workout access is created', async () => {
        const testUser = await workoutTestUtil.insertUser('WorkoutUserConfigRepository');

        const config = await repo.getForUser(testUser._id);

        expect(config?.docType).toBe('workoutUserConfig');
        expect(config?.entitlements).toEqual({});
      });

      it('does not create a config when a user without workout access is created', async () => {
        const testUser = workoutTestUtil.createUser('WorkoutUserConfigRepository');
        testUser.projectAccess[ProjectName.Workout] = false;
        await userRepo.insertNew(testUser);

        const config = await repo.getForUser(testUser._id);

        expect(config).toBeNull();
      });

      it('deletes the config when the user is deleted', async () => {
        const testUser = await workoutTestUtil.insertUser('WorkoutUserConfigRepository');

        await userRepo.delete(testUser._id);

        const config = await repo.getForUser(testUser._id);
        expect(config).toBeNull();
      });
    });

    describe('update', () => {
      it('updates the supporter entitlement expiry', async () => {
        const testUser = await workoutTestUtil.insertUser('WorkoutUserConfigRepository');
        const config = await repo.getForUser(testUser._id);
        if (!config) {
          throw new Error('Config was not created');
        }
        const expiresAt = new Date('3000-01-01');

        await repo.update({
          _id: config._id,
          entitlements: { [WorkoutEntitlement.Supporter]: { expiresAt } }
        });

        const updated = await repo.getForUser(testUser._id);
        expect(updated?.entitlements[WorkoutEntitlement.Supporter]?.expiresAt).toEqual(expiresAt);
      });
    });

    describe('Validation', () => {
      it('rejects a second config for the same user', async () => {
        const testUser = await workoutTestUtil.insertUser('WorkoutUserConfigRepository');

        await expect(
          repo.insertNew(WorkoutUserConfigSchema.parse({ userId: testUser._id }))
        ).rejects.toThrow('WorkoutUserConfig already exists');
      });

      it('rejects update without _id', async () => {
        await expect(
          repo.update({
            entitlements: { [WorkoutEntitlement.Supporter]: { expiresAt: new Date() } }
          })
        ).rejects.toThrow('No _id defined for WorkoutUserConfig update');
      });
    });
  });
});
