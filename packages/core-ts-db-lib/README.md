# Personal Core Database Library

[![JSR](https://jsr.io/badges/@aneuhold/core-ts-db-lib)](https://jsr.io/@aneuhold/core-ts-db-lib)
[![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fcore-ts-db-lib)](https://www.npmjs.com/package/@aneuhold/core-ts-db-lib)

This is used to export types used in various places for database interactions in personal projects.

## 📦 Installation

To add to a repo, follow the instructions below for your environment:

### For Node using NPM

Run `pnpm add @aneuhold/core-ts-db-lib`

### For Node using JSR

The below instructions still allow for things like Renovate to work, and normal commands with pnpm such as `pnpm up`.

1. Add the required JSR configuration to a `.npmrc` file if not there already:
   ```
   @jsr:registry=https://npm.jsr.io
   ```
1. Add the package with `pnpm add @jsr/aneuhold__core-ts-db-lib`

### For Deno

Run `deno add jsr:@aneuhold/core-ts-db-lib`

## 🟢 Usage

Pull in one of the services and use it like so:

```ts
import { DocumentService } from '@aneuhold/core-ts-db-lib';
// If using Node with JSR
// import { DocumentService } from '@jsr/aneuhold__core-ts-db-lib';

export default function deepCopy() {
  DocumentService.deepCopy({ someProperty: 'someString' });
}
```

[See full documentation on usage at JSR!](https://jsr.io/@aneuhold/core-ts-db-lib/doc)

## 🛠️ Development

### Document structure

Project-specific documents can be held in a single collection. So those should inherit from the `BaseDocumentWithType` class.

When different document types are held under a specific collection, they should get their own folder.

### Guidelines

> Note that documents cannot have really special types or classes with functions. For example `Set` cannot be used.

### Updating an existing document

If a property is being moved or a new required property is added, then take the
following steps

1. Update the document
1. Update the validator
1. Push the changes to NPM
1. Go to `be-ts-db-lib` and update the versions there with `pnpm upgrade:core`
1. Update the migration service in that repo and double check it looks okay
1. Run the migration with `pnpm migrate:dry` then `pnpm migrate`
1. Run validation to ensure everything is alright with `pnpm validate:dry` then `pnpm validate` if needed
1. Run tests
1. Update tests if needed then re-validate
1. Push a new version of the `be-ts-db-lib` to NPM
1. Pull the new versions into `digital-ocean-functions` and deploy
1. Pull the new versions into `core-ts-api-lib` and push to NPM
1. Pull the new versions into any relevant frontends and deploy
1. Test out the frontends to make sure it works okay and double check MongoDB directly
