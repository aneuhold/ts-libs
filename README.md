# Personal Core API Library

[![JSR](https://jsr.io/badges/@aneuhold/core-ts-api-lib)](https://jsr.io/@aneuhold/core-ts-api-lib)
[![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fcore-ts-api-lib)](https://www.npmjs.com/package/@aneuhold/core-ts-api-lib)

A library for interacting with the backend and defining the backend API for personal projects.

## 📦 Installation

To add to a repo, follow the instructions below for your environment:

### For Node using NPM

Run `yarn add @aneuhold/core-ts-api-lib`

### For Node using JSR

The below instructions still allow for things like Renovate to work, and normal commands with yarn such as `yarn up`.

1. Add the required JSR configuration to a `.yarnrc.yml` file if not there already:
   ```yml
   npmScopes:
     jsr:
       npmRegistryServer: 'https://npm.jsr.io'
   ```
1. Add the package with `yarn add @jsr/aneuhold__core-ts-api-lib`

### For Deno

Run `deno add jsr:@aneuhold/core-ts-api-lib`

## 🟢 Usage

Pull in one of the services and use it like so:

```ts
import { APIService } from '@aneuhold/core-ts-api-lib';
// If using Node with JSR
// import { APIService } from '@jsr/aneuhold__core-ts-api-lib';

export default async function validateUser() {
  const userInfo = await APIService.validateUser({
    username: 'user',
    password: 'pass'
  });
  console.log(userInfo);
}
```

[See full documentation on usage at JSR!](https://jsr.io/@aneuhold/core-ts-api-lib/doc)
