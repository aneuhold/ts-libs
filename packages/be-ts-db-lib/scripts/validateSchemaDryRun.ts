import DbSchemaUpdater from '../src/util/DbSchemaUpdater.js';

void DbSchemaUpdater.updateSchemaForAllRepos(true).then(() => {
  process.exit(0);
});
