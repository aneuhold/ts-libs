import crypto from 'crypto';
import {
  DashboardTask,
  DashboardUserConfig,
  User
} from '@aneuhold/core-ts-db-lib';
import UserRepository from '../../repositories/common/UserRepository';
import { cleanupDoc, getTestUserName } from '../testsUtil';
import DocumentDb from '../../util/DocumentDb';
import DashboardUserConfigRepository from '../../repositories/dashboard/DashboardUserConfigRepository';
import DashboardTaskRepository from '../../repositories/dashboard/DashboardTaskRepository';

it('can create a new document and delete it', async () => {
  const userRepository = UserRepository.getRepo();
  const newUser = new User(getTestUserName());
  const createResult = await userRepository.insertNew(newUser);
  expect(createResult).toBeTruthy();

  await cleanupDoc(userRepository, newUser);
});

// -- Manual Database Operations Section -- //

it.skip('can add a new test user', async () => {
  const userRepository = UserRepository.getRepo();
  const newUser = new User('someUser');
  newUser.auth.password = crypto.randomUUID();
  const createResult = await userRepository.insertNew(newUser);
  expect(createResult).toBeTruthy();
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
  const user = await userRepo.get({ userName: 'testUser' });
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
