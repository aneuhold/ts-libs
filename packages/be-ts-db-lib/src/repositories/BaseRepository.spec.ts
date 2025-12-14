import {
  DashboardTaskSchema,
  DashboardUserConfigSchema,
  UserSchema
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import crypto from 'crypto';
import { afterAll, expect, it } from 'vitest';
import UserRepository from '../../repositories/common/UserRepository.js';
import DashboardTaskRepository from '../../repositories/dashboard/DashboardTaskRepository.js';
import DashboardUserConfigRepository from '../../repositories/dashboard/DashboardUserConfigRepository.js';
import { DemoAccountsService } from '../../services/DemoAccountsService/index.js';
import DocumentDb from '../../util/DocumentDb.js';
import { cleanupDoc, getTestUserName } from '../testsUtil.js';

it('can create a new document and delete it', async () => {
  const userRepository = UserRepository.getRepo();
  const newUser = UserSchema.parse({ userName: getTestUserName() });
  const createResult = await userRepository.insertNew(newUser);
  expect(createResult).toBeTruthy();

  await cleanupDoc(userRepository, newUser);
}, 10000);

// -- Manual Database Operations Section -- //

it.skip('can add a new test user', async () => {
  const userRepository = UserRepository.getRepo();
  const newUser = UserSchema.parse({ userName: 'demoUser2' });
  newUser.auth.password = crypto.randomUUID();
  const createResult = await userRepository.insertNew(newUser);
  expect(createResult).toBeTruthy();
});

it.skip('can setup the demo accounts', async () => {
  const demoUser1Id = '01935b78-3b48-7000-8000-000000000001' as UUID;
  const demoUser2Id = '01935b78-3b48-7000-8000-000000000002' as UUID;
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
