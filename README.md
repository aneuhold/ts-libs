# Personal Core Database Library

![npm](https://img.shields.io/npm/v/%40aneuhold%2Fcore-ts-db-lib)

This is used to export types used in various places for database interactions in personal projects.

## Document structure

Project-specific documents can be held in a single collection. So those should inherit from the `BaseDocumentWithType` class.

When different document types are held under a specific collection, they should get their own folder.

## Updating an existing document

If a property is being moved or a new required property is added, then take the
following steps

1. Update the document
1. Update the validator
1. Push the changes to NPM
1. Go to `be-ts-db-lib` and update the versions there with `yarn upgrade:core`
1. Update the migration service in that repo and double check it looks okay
1. Run the migration with `yarn migrate:dry` then `yarn migrate`
1. Run validation to ensure everything is alright with `yarn validate:dry` then `yarn validate` if needed
1. Run tests
1. Push a new version of the `be-ts-db-lib` to NPM
1. Pull the new versions into `digital-ocean-functions` and deploy
1. Pull the new versions into `core-ts-api-lib` and push to NPM
1. Pull the new versions into any relevant frontends and deploy
