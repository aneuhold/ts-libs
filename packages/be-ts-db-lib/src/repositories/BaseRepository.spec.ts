import {
  DashboardTaskSchema,
  DashboardUserConfigSchema,
  DocumentService,
  UserSchema
} from '@aneuhold/core-ts-db-lib';
import crypto from 'crypto';
import { afterAll, describe, expect, it } from 'vitest';
import workoutTestUtil from '../../test-util/projects/workout/workoutTestUtil.js';
import { getTestUserName } from '../../test-util/testsUtil.js';
import DemoAccountsService from '../services/DemoAccountsService/DemoAccounts.service.js';
import DocumentDb from '../util/DocumentDb.js';
import UserRepository from './common/UserRepository.js';
import DashboardTaskRepository from './dashboard/DashboardTaskRepository.js';
import DashboardUserConfigRepository from './dashboard/DashboardUserConfigRepository.js';
import WorkoutEquipmentTypeRepository from './workout/WorkoutEquipmentTypeRepository.js';

describe('Integration Tests', () => {
  it('can create a new document and delete it', async () => {
    const userRepository = UserRepository.getRepo();
    const newUser = UserSchema.parse({ userName: getTestUserName() });
    const createResult = await userRepository.insertNew(newUser);
    expect(createResult).toBeTruthy();
  }, 10000);

  describe('insertManyIfAbsent', () => {
    const repo = WorkoutEquipmentTypeRepository.getRepo();

    it('inserts only the new documents, returns them, and leaves existing ones unchanged', async () => {
      const testUser = await workoutTestUtil.insertUser('insertManyIfAbsent');
      const existing = await workoutTestUtil.insertEquipmentType(testUser._id, 'Existing');
      const newDoc = workoutTestUtil.createEquipmentType(testUser._id, 'New');

      const result = await repo.insertManyIfAbsent([{ ...existing, title: 'Changed' }, newDoc]);

      expect(result.map((doc) => doc._id)).toEqual([newDoc._id]);
      const stored = await repo.getList([existing._id, newDoc._id]);
      expect(stored.find((doc) => doc._id === existing._id)?.title).toBe('Existing');
      expect(stored.find((doc) => doc._id === newDoc._id)?.title).toBe('New');
    });

    it('can repeat the same insert without creating duplicates', async () => {
      const testUser = await workoutTestUtil.insertUser('insertManyIfAbsent');
      const doc = workoutTestUtil.createEquipmentType(testUser._id);

      await repo.insertManyIfAbsent([doc]);
      const retryResult = await repo.insertManyIfAbsent([doc]);

      expect(retryResult).toEqual([]);
      expect(await repo.getList([doc._id])).toHaveLength(1);
    });

    it('fails when the _id belongs to a document of another type', async () => {
      const testUser = await workoutTestUtil.insertUser('insertManyIfAbsent');
      const muscleGroup = await workoutTestUtil.insertMuscleGroup(testUser._id);
      const doc = { ...workoutTestUtil.createEquipmentType(testUser._id), _id: muscleGroup._id };

      await expect(repo.insertManyIfAbsent([doc])).rejects.toThrow(/duplicate key/);
    });
  });

  // -- Manual Database Operations Section -- //

  it.skip('can add a new test user', async () => {
    const userRepository = UserRepository.getRepo();
    const newUser = UserSchema.parse({ userName: 'testUserForDeletion' });
    newUser.auth.password = crypto.randomUUID();
    console.log(`New test user password: ${newUser.auth.password}`);
    const createResult = await userRepository.insertNew(newUser);
    expect(createResult).toBeTruthy();
  });

  it.skip('can setup the demo accounts', async () => {
    const demoUser1Id = DocumentService.toUUID('01935b78-3b48-7000-8000-000000000001');
    const demoUser2Id = DocumentService.toUUID('01935b78-3b48-7000-8000-000000000002');
    await DemoAccountsService.seedDashboardDemoAccounts(demoUser1Id, demoUser2Id);
    // Basic sanity check: ensure at least one shared task exists for each user
    const taskRepo = DashboardTaskRepository.getRepo();
    const u1Tasks = await taskRepo.getAllForUser(demoUser1Id);
    const u2Tasks = await taskRepo.getAllForUser(demoUser2Id);
    expect(u1Tasks.length).toBeGreaterThan(0);
    expect(u2Tasks.length).toBeGreaterThan(0);
  });

  it.skip('can create a dashboard config for a user', async () => {
    const userRepo = UserRepository.getRepo();
    const user = await userRepo.get({ userName: 'usernameHere' });
    expect(user).toBeTruthy();

    if (user) {
      const configRepo = DashboardUserConfigRepository.getRepo();
      const newConfig = DashboardUserConfigSchema.parse({ userId: user._id });
      newConfig.enableDevMode = true;
      await configRepo.insertNew(newConfig);
    }
  });

  it.skip(`can create a new task for a user`, async () => {
    const userRepo = UserRepository.getRepo();
    const user = await userRepo.get({ userName: 'usernameHere' });
    expect(user).toBeTruthy();

    if (user) {
      const taskRepo = DashboardTaskRepository.getRepo();
      const newTask = DashboardTaskSchema.parse({ userId: user._id });
      newTask.title = 'Test Task';
      await taskRepo.insertNew(newTask);
    }
  });

  afterAll(async () => {
    return DocumentDb.closeDbConnection();
  });
});
