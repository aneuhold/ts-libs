import DbSchemaUpdater from '../util/DbSchemaUpdater';

void DbSchemaUpdater.updateSchemaForAllRepos(true).then(() => {
  process.exit(0);
});
