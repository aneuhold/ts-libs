# Personal Backend Database Library

[![JSR](https://jsr.io/badges/@aneuhold/be-ts-db-lib)](https://jsr.io/@aneuhold/be-ts-db-lib)
[![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fbe-ts-db-lib)](https://www.npmjs.com/package/@aneuhold/be-ts-db-lib)

This is used to actually interact with databases in personal projects.

## 📦 Installation

To add to a repo, follow the instructions below for your environment:

### For Node using NPM

Run `yarn add @aneuhold/be-ts-db-lib`

### For Node using JSR

The below instructions still allow for things like Renovate to work, and normal commands with yarn such as `yarn up`.

1. Add the required JSR configuration to a `.yarnrc.yml` file if not there already:
   ```yml
   npmScopes:
     jsr:
       npmRegistryServer: 'https://npm.jsr.io'
   ```
1. Add the package with `yarn add @jsr/aneuhold__be-ts-db-lib`

### For Deno

Run `deno add jsr:@aneuhold/be-ts-db-lib`

## 🟢 Usage

Pull in one of the services and use it like so:

```ts
import { DocumentService } from '@aneuhold/be-ts-db-lib';
// If using Node with JSR
// import { DocumentService } from '@jsr/aneuhold__be-ts-db-lib';

export default function deepCopy() {
  DocumentService.deepCopy({ someProperty: 'someString' });
}
```

[See full documentation on usage at JSR!](https://jsr.io/@aneuhold/be-ts-db-lib/doc)

## 🛠️ Development

Possible next tasks:

- Make the validators have an updateMany validation that is more performant.

### Creating a new Repository

1. Copy an existing one over
1. Create an associated validator

## Schema Validation for DB

If any of the base document types are updated, make sure to run `yarn validate` to ensure that the DB is up-to-date as well.

## Manual Database Operations

Go ahead and run these as code in a test in the `BaseRepository.spec.ts` file.
