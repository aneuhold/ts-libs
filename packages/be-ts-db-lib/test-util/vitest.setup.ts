import dotenv from 'dotenv';
import UserRepository from '../src/repositories/common/UserRepository.js';
import DocumentDb from '../src/util/DocumentDb.js';
import { TEST_USER_NAME_PREFIX } from '../src/util/globalTestVariables.js';

// Set the .env file to pull from before the tests run
dotenv.config({ path: '../../.env' });

/**
 * Global teardown function that runs once after all test suites.
 */
export async function teardown(): Promise<void> {
  try {
    // Delete all test users (this will cascade delete all their sub-documents)
    const userRepo = UserRepository.getRepo();
    const usersToDelete = await userRepo.getListWithFilter({
      userName: { $regex: `^${TEST_USER_NAME_PREFIX}` }
    });
    const deleteResult = await userRepo.deleteList(usersToDelete.map((user) => user._id));
    console.log(`Cleaned up ${deleteResult.deletedCount} test users.`);
  } catch (error) {
    console.error('Error cleaning up test users:', error);
  }

  // Close the connection to the database
  try {
    await DocumentDb.closeDbConnection();
    console.log('Database connection closed successfully.');
  } catch {
    // Ignore errors during cleanup
  }
}
