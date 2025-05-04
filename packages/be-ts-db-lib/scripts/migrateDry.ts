import MigrationService from '../src/services/MigrationService.js';

void MigrationService.migrateDb(true).then(() => process.exit(0));
