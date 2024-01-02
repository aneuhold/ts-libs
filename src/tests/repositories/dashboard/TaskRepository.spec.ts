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

describe('Get operations', () => {
  it('can get a set of tasks for a user, without any tasks from other users', async () => {
    const newUser = await createNewTestUser();
    const newTask = new DashboardTask(newUser._id);
    const insertResult = await taskRepo.insertNew(newTask);
    expect(insertResult).toBeTruthy();

    const otherUser = await createNewTestUser();
    const otherUserTask = new DashboardTask(otherUser._id);
    const insertResult2 = await taskRepo.insertNew(otherUserTask);
    expect(insertResult2).toBeTruthy();

    const tasks = await taskRepo.getAllForUser(newUser._id);
    expect(tasks.length).toBe(1);
    expect(tasks[0]._id).toEqual(newTask._id);

    await cleanupDoc(userRepo, newUser);
    await cleanupDoc(userRepo, otherUser);
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
