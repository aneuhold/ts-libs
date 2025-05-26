import DbSchemaUpdater from '../src/util/DbSchemaUpdater.js';

// Set the .env file to pull from
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

void DbSchemaUpdater.updateSchemaForAllRepos().then(() => {
  process.exit(0);
});
