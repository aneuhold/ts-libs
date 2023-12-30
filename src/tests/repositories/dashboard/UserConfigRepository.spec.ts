import crypto from 'crypto';
import { User } from '@aneuhold/core-ts-db-lib';
import UserRepository from '../../../repositories/common/UserRepository';
import { cleanupDoc, getTestUserName } from '../../testsUtil';
import DocumentDb from '../../../util/DocumentDb';
import DashboardUserConfigRepository from '../../../repositories/dashboard/DashboardUserConfigRepository';

const userRepo = UserRepository.getRepo();
const configRepo = DashboardUserConfigRepository.getRepo();

describe('Create operations', () => {
  it('can create a new user config', async () => {
    // User configs are created automatically when a new user is created
    const newUser = await createNewTestUser();
    const newConfig = await configRepo.get({ userId: newUser._id });
    expect(newConfig).toBeTruthy();
    if (!newConfig) {
      return;
    }

    await cleanupDoc(userRepo, newUser);
  });
});

describe('Update operations', () => {
  it('can update an existing user config', async () => {
    const newUser = await createNewTestUser();
    const newConfig = await configRepo.get({ userId: newUser._id });
    expect(newConfig).toBeTruthy();
    if (!newConfig) {
      return;
    }

    newConfig.enableDevMode = true;
    await configRepo.update(newConfig);
    const updatedConfig = await configRepo.get({ _id: newConfig._id });
    expect(updatedConfig?.enableDevMode).toBe(true);

    await cleanupDoc(userRepo, newUser);
  });
});

afterAll(async () => {
  return DocumentDb.closeDbConnection();
});

async function createNewTestUser() {
  const newUser = new User(
    getTestUserName(`${crypto.randomUUID()}userconfigtest`)
  );
  newUser.projectAccess.dashboard = true;
  const insertResult = await userRepo.insertNew(newUser);
  expect(insertResult).toBeTruthy();
  return newUser;
}
