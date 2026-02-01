import dotenv from 'dotenv';
import DocumentDb from '../src/util/DocumentDb.js';

// Set the .env file to pull from before the tests run
dotenv.config({ path: '../../.env' });

/**
 * Global teardown function that runs once after all test suites.
 */
export async function teardown(): Promise<void> {
  // Close the connection to the database
  try {
    await DocumentDb.closeDbConnection();
    console.log('Database connection closed successfully.');
  } catch {
    // Ignore errors during cleanup
  }
}
