# core-ts-lib

[![JSR](https://jsr.io/badges/@aneuhold/core-ts-lib)](https://jsr.io/@aneuhold/core-ts-lib)

A library containing TypeScript that I am sharing among most TypeScript-based projects.

## 📦 Installation

To add to a repo, do the following:

1. Add the required JSR configuration to a `.yarnrc.yml` file if not there already:
   ```yml
   npmScopes:
     jsr:
       npmRegistryServer: 'https://npm.jsr.io'
   ```
1. Add the package with `yarn add @jsr/aneuhold__core-ts-lib`

## 🟢 Usage

Pull in one of the services and use it. For example:

```ts
import { Logger } from '@jsr/aneuhold__core-ts-lib';

export default function logSomething() {
  Logger.info('Something');
}
```

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
