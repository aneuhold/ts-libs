import { DashboardTask, DashboardUserConfig, User } from '@aneuhold/core-ts-db-lib';
import { ObjectId } from 'bson';
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
  const newUser = new User(getTestUserName());
  const createResult = await userRepository.insertNew(newUser);
  expect(createResult).toBeTruthy();

  await cleanupDoc(userRepository, newUser);
}, 10000);

// -- Manual Database Operations Section -- //

it.skip('can add a new test user', async () => {
  const userRepository = UserRepository.getRepo();
  const newUser = new User('demoUser2');
  newUser.auth.password = crypto.randomUUID();
  const createResult = await userRepository.insertNew(newUser);
  expect(createResult).toBeTruthy();
});

it.skip('can setup the demo accounts', async () => {
  const demoUser1Id = new ObjectId('68a270cad40eb5223ce94547');
  const demoUser2Id = new ObjectId('68a270d3a9b3cc9b224596af');
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
    const newConfig = new DashboardUserConfig(user._id);
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
    const newTask = new DashboardTask(user._id);
    newTask.title = 'Test Task';
    await taskRepo.insertNew(newTask);
  }
});

afterAll(async () => {
  return DocumentDb.closeDbConnection();
});
