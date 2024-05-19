import DbSchemaUpdater from '../util/DbSchemaUpdater';

void DbSchemaUpdater.updateSchemaForAllRepos().then(() => {
  process.exit(0);
});
