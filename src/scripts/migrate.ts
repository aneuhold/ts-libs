import MigrationService from '../services/MigrationService';

MigrationService.migrateDb().then(() => process.exit(0));
