import DbSchemaUpdater from '../util/DbSchemaUpdater';

DbSchemaUpdater.updateSchemaForAllRepos(true).then(() => {
  process.exit(0);
});
