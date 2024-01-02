import crypto from 'crypto';
import { DashboardTask, User } from '@aneuhold/core-ts-db-lib';
import UserRepository from '../../../repositories/common/UserRepository';
import { cleanupDoc, getTestUserName } from '../../testsUtil';
import DocumentDb from '../../../util/DocumentDb';
import DashboardTaskRepository from '../../../repositories/dashboard/DashboardTaskRepository';

const userRepo = UserRepository.getRepo();
const taskRepo = DashboardTaskRepository.getRepo();

describe('Create operations', () => {
  it('can create a new task', async () => {
    const newUser = await createNewTestUser();
    const newTask = new DashboardTask(newUser._id);
    const insertResult = await taskRepo.insertNew(newTask);
    expect(insertResult).toBeTruthy();
    const insertedTask = await taskRepo.get({ _id: newTask._id });
    expect(insertedTask).toBeTruthy();
    expect(typeof insertedTask?.createdDate).toBe('object');
    if (!insertedTask) {
      return;
    }

    await cleanupDoc(userRepo, newUser);
    // Task should be deleted
    const deletedTask = await taskRepo.get({ _id: newTask._id });
    expect(deletedTask).toBeFalsy();
  });
});

afterAll(async () => {
  return DocumentDb.closeDbConnection();
});

async function createNewTestUser() {
  const newUser = new User(
    getTestUserName(`${crypto.randomUUID()}dashboardTaskTest`)
  );
  const insertResult = await userRepo.insertNew(newUser);
  expect(insertResult).toBeTruthy();
  return newUser;
}
