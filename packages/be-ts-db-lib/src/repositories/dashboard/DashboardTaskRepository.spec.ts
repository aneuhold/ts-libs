import type { User } from '@aneuhold/core-ts-db-lib';
import { DashboardTaskSchema, UserSchema } from '@aneuhold/core-ts-db-lib';
import crypto from 'crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { cleanupDoc, getTestUserName } from '../../tests/testsUtil.js';
import DocumentDb from '../../util/DocumentDb.js';
import UserRepository from '../common/UserRepository.js';
import DashboardTaskRepository from './DashboardTaskRepository.js';
import DashboardUserConfigRepository from './DashboardUserConfigRepository.js';

const userRepo = UserRepository.getRepo();
const taskRepo = DashboardTaskRepository.getRepo();

describe('Create operations', () => {
  it('can create a new task', async () => {
    const newUser = await createNewTestUser();
    const newTask = DashboardTaskSchema.parse({ userId: newUser._id });
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
    const newTask = DashboardTaskSchema.parse({ userId: newUser._id });
    const insertResult = await taskRepo.insertNew(newTask);
    expect(insertResult).toBeTruthy();

    const otherUser = await createNewTestUser();
    const otherUserTask = DashboardTaskSchema.parse({ userId: otherUser._id });
    const insertResult2 = await taskRepo.insertNew(otherUserTask);
    expect(insertResult2).toBeTruthy();

    const tasks = await taskRepo.getAllForUser(newUser._id);
    expect(tasks.length).toBe(1);
    expect(tasks[0]._id).toEqual(newTask._id);

    await cleanupDoc(userRepo, newUser);
    await cleanupDoc(userRepo, otherUser);
  });

  it('can get a set of tasks for a user, including tasks shared with that user', async () => {
    const configRepo = DashboardUserConfigRepository.getRepo();
    const newUser = await createNewTestUser();
    const newTask = DashboardTaskSchema.parse({ userId: newUser._id });
    const insertResult = await taskRepo.insertNew(newTask);
    expect(insertResult).toBeTruthy();

    const otherUser = await createNewTestUser();
    const otherUserTask = DashboardTaskSchema.parse({ userId: otherUser._id });

    // Add other user as collaborator
    const otherUserConfig = await configRepo.get({ userId: otherUser._id });
    expect(otherUserConfig).toBeTruthy();
    if (!otherUserConfig) {
      return;
    }
    otherUserConfig.collaborators.push(newUser._id);
    await configRepo.update(otherUserConfig);
    otherUserTask.sharedWith.push(newUser._id);
    const insertResult2 = await taskRepo.insertNew(otherUserTask);
    expect(insertResult2).toBeTruthy();

    const tasks = await taskRepo.getAllForUser(newUser._id);
    expect(tasks.length).toBe(2);
    expect(tasks[0]._id).toEqual(newTask._id);
    expect(tasks[1]._id).toEqual(otherUserTask._id);

    await cleanupDoc(userRepo, newUser);
    await cleanupDoc(userRepo, otherUser);
  });
});

afterAll(async () => {
  return DocumentDb.closeDbConnection();
});

/**
 * Create a new test user
 *
 * @returns The new user
 */
async function createNewTestUser(): Promise<User> {
  const newUser = UserSchema.parse({
    userName: getTestUserName(`${crypto.randomUUID()}dashboardTaskTest`)
  });
  const insertResult = await userRepo.insertNew(newUser);
  expect(insertResult).toBeTruthy();
  return newUser;
}
