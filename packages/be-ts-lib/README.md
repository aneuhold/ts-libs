# Personal Backend TypeScript Library

[![JSR](https://jsr.io/badges/@aneuhold/be-ts-lib)](https://jsr.io/@aneuhold/be-ts-lib)
[![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fbe-ts-lib)](https://www.npmjs.com/package/@aneuhold/be-ts-lib)

This is a library meant to contain any common code between backend TypeScript projects.

## 📦 Installation

To add to a repo, follow the instructions below for your environment:

### For Node using NPM

Run `yarn add @aneuhold/be-ts-lib`

### For Node using JSR

The below instructions still allow for things like Renovate to work, and normal commands with yarn such as `yarn up`.

1. Add the required JSR configuration to a `.yarnrc.yml` file if not there already:
   ```yml
   npmScopes:
     jsr:
       npmRegistryServer: 'https://npm.jsr.io'
   ```
1. Add the package with `yarn add @jsr/aneuhold__be-ts-lib`

### For Deno

Run `deno add jsr:@aneuhold/be-ts-lib`

## 🟢 Usage

Pull in one of the services and use it like so:

```ts
import { ConfigService } from '@aneuhold/be-ts-lib';
// If using Node with JSR
// import { ConfigService } from '@jsr/aneuhold__be-ts-lib';

export default async function getConfig() {
  await ConfigService.useConfig('local');
  const config = ConfigService.config;
  console.log(config);
}
```

[See full documentation on usage at JSR!](https://jsr.io/@aneuhold/be-ts-lib/doc)
