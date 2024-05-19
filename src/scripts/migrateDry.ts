import MigrationService from '../services/MigrationService';

void MigrationService.migrateDb(true).then(() => process.exit(0));
