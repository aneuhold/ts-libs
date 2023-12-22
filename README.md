# Personal Core Database Library

![npm](https://img.shields.io/npm/v/%40aneuhold%2Fcore-ts-db-lib)

This is used to export types used in various places for database interactions in personal projects.

## Document structure

Project-specific documents can be held in a single collection. So those should inherit from the `BaseDocumentWithType` class.

When different document types are held under a specific collection, they should get their own folder.
