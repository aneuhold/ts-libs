import MigrationService from '../src/services/MigrationService.js';

// Set the .env file to pull from
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

void MigrationService.migrateDb().then(() => process.exit(0));
