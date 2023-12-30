import crypto from 'crypto';
import { DashboardUserConfig, User } from '@aneuhold/core-ts-db-lib';
import UserRepository from '../../repositories/common/UserRepository';
import { cleanupDoc } from '../testsUtil';
import DocumentDb from '../../util/DocumentDb';
import DashboardUserConfigRepository from '../../repositories/dashboard/DashboardUserConfigRepository';

it('can create a new document and delete it', async () => {
  const userRepository = UserRepository.getRepo();
  const newUser = new User(crypto.randomUUID());
  const createResult = await userRepository.insertNew(newUser);
  expect(createResult).toBeTruthy();

  await cleanupDoc(userRepository, newUser);
});

// -- Manual Database Operations Section -- //

it.skip('can add a new test user', async () => {
  const userRepository = UserRepository.getRepo();
  const newUser = new User('someUser');
  newUser.password = crypto.randomUUID();
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

afterAll(async () => {
  return DocumentDb.closeDbConnection();
});
