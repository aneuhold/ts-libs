# core-ts-lib

[![JSR](https://jsr.io/badges/@aneuhold/core-ts-lib)](https://jsr.io/@aneuhold/core-ts-lib)
[![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fcore-ts-lib)](https://www.npmjs.com/package/@aneuhold/core-ts-lib)
[![License](https://img.shields.io/github/license/aneuhold/core-ts-lib)](https://github.com/aneuhold/core-ts-lib/blob/main/LICENSE)

A library containing TypeScript that I am sharing among most TypeScript-based projects. This package is published using ES Modules only.

## 📦 Installation

To add to a repo, follow the instructions below for your environment:

### For Node using NPM

Run `yarn add @aneuhold/core-ts-lib`

### For Node using JSR

The below instructions still allow for things like Renovate to work, and normal commands with yarn such as `yarn up`.

1. Add the required JSR configuration to a `.yarnrc.yml` file if not there already:
   ```yml
   npmScopes:
     jsr:
       npmRegistryServer: 'https://npm.jsr.io'
   ```
1. Add the package with `yarn add @jsr/aneuhold__core-ts-lib`

### For Deno

Run `deno add jsr:@aneuhold/core-ts-lib`

## 🟢 Usage

Pull in one of the services and use it like so:

```ts
import { DependencyRegistry, ILogger } from '@aneuhold/core-ts-lib';
// If using Node with JSR
// import { DependencyRegistry, ILogger } from '@jsr/aneuhold__core-ts-lib';

// Get the logger instance from the registry
const logger: ILogger = DependencyRegistry.logger;

export default function logSomething() {
  logger.info('Something');
}
```

[See full documentation on usage at JSR!](https://jsr.io/@aneuhold/core-ts-lib/doc)

## 🛠️ Development

### Updating via PR

1. Create a new branch locally
1. Make some changes locally
1. Run `yarn version patch`
1. Push the branch up to a PR to make sure it passes checks
1. Once it passes checks, merge the PR and it will automatically get deployed.

### Updating via Push to Main

1. Make changes locally
2. Run `yarn version patch`
3. Run `yarn checkAll`
4. Push it up to main. This will get automatically deployed.
