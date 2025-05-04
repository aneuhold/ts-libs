import MigrationService from '../src/services/MigrationService.js';

void MigrationService.migrateDb().then(() => process.exit(0));
