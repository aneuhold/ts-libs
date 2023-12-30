import MigrationService from '../services/MigrationService';

MigrationService.migrateDb(true).then(() => process.exit(0));
