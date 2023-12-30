import DbSchemaUpdater from '../util/DbSchemaUpdater';

DbSchemaUpdater.updateSchemaForAllRepos().then(() => {
  process.exit(0);
});
