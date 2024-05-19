import MigrationService from '../services/MigrationService';

void MigrationService.migrateDb().then(() => process.exit(0));
