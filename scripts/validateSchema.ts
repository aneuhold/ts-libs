import DbSchemaUpdater from '../src/util/DbSchemaUpdater.js';

void DbSchemaUpdater.updateSchemaForAllRepos().then(() => {
  process.exit(0);
});
