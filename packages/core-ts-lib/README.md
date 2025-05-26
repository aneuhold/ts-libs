# core-ts-lib

[![JSR](https://jsr.io/badges/@aneuhold/core-ts-lib)](https://jsr.io/@aneuhold/core-ts-lib)
[![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fcore-ts-lib)](https://www.npmjs.com/package/@aneuhold/core-ts-lib)
[![License](https://img.shields.io/github/license/aneuhold/ts-libs)](https://github.com/aneuhold/ts-libs/blob/main/LICENSE)

A library containing TypeScript that I am sharing among most TypeScript-based projects. This package is published using ES Modules only.

## 📦 Installation

To add to a repo, follow the instructions below for your environment:

### For Node using NPM

Run `pnpm add @aneuhold/core-ts-lib`

### For Node using JSR

The below instructions still allow for things like Renovate to work, and normal commands with pnpm such as `pnpm up`.

1. Add the required JSR configuration to a `.npmrc` file if not there already:
   ```
   @jsr:registry=https://npm.jsr.io
   ```
1. Add the package with `pnpm add @jsr/aneuhold__core-ts-lib`

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
