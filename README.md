# ts-libs

Monorepo for TypeScript libraries that I work on.

## Packages

<!-- prettier-ignore -->
| Package | Description | NPM | JSR |
|---------|-------------|-----|-----|
| [`@aneuhold/core-ts-lib`](packages/core-ts-lib) | A core library for all of my TypeScript projects | [![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fcore-ts-lib)](https://www.npmjs.com/package/@aneuhold/core-ts-lib) | [![JSR](https://jsr.io/badges/@aneuhold/core-ts-lib)](https://jsr.io/@aneuhold/core-ts-lib) |
| [`@aneuhold/core-ts-db-lib`](packages/core-ts-db-lib) | A core database library used for personal projects | [![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fcore-ts-db-lib)](https://www.npmjs.com/package/@aneuhold/core-ts-db-lib) | [![JSR](https://jsr.io/badges/@aneuhold/core-ts-db-lib)](https://jsr.io/@aneuhold/core-ts-db-lib) |
| [`@aneuhold/core-ts-api-lib`](packages/core-ts-api-lib) | A library for interacting with the backend and defining the backend API for personal projects | [![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fcore-ts-api-lib)](https://www.npmjs.com/package/@aneuhold/core-ts-api-lib) | [![JSR](https://jsr.io/badges/@aneuhold/core-ts-api-lib)](https://jsr.io/@aneuhold/core-ts-api-lib) |
| [`@aneuhold/be-ts-lib`](packages/be-ts-lib) | A backend TypeScript library used for common functionality in personal backend projects | [![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fbe-ts-lib)](https://www.npmjs.com/package/@aneuhold/be-ts-lib) | [![JSR](https://jsr.io/badges/@aneuhold/be-ts-lib)](https://jsr.io/@aneuhold/be-ts-lib) |
| [`@aneuhold/be-ts-db-lib`](packages/be-ts-db-lib) | A backend database library meant to actually interact with various databases in personal projects | [![NPM](https://img.shields.io/npm/v/%40aneuhold%2Fbe-ts-db-lib)](https://www.npmjs.com/package/@aneuhold/be-ts-db-lib) | [![JSR](https://jsr.io/badges/@aneuhold/be-ts-db-lib)](https://jsr.io/@aneuhold/be-ts-db-lib) |
| [`@aneuhold/local-npm-registry`](packages/local-npm-registry) | Manages local npm package installations and updates across your machine | [![NPM](https://img.shields.io/npm/v/%40aneuhold%2Flocal-npm-registry)](https://www.npmjs.com/package/@aneuhold/local-npm-registry) | [![JSR](https://jsr.io/badges/@aneuhold/local-npm-registry)](https://jsr.io/@aneuhold/local-npm-registry) |

<details>
<summary><h2>Making Updates to the Monorepo</h2></summary>

Follow this general flow when making updates to any package in the monorepo:

1. **Create a new branch** with any descriptive name:

   ```bash
   git checkout -b your-feature-name
   ```

1. **Make your changes** to the relevant package(s)

1. **Run the preparePkg script** to bump versions and initialize changelog updates:

   ```bash
   pnpm preparePkg
   ```

1. **Commit your changes** if there are any remaining uncommitted changes:

   ```bash
   git add .
   git commit -m "Your commit message"
   ```

1. **Push your branch** and create a pull request (it helps to do this first for Copilot):

   ```bash
   git push
   ```

1. **Generate changelogs** using the Copilot prompt:

   ```
   /changelog
   ```

   This will automatically populate the changelog entries for all modified packages.

1. **Merge the PR** once all checks pass. Updated packages will automatically publish to NPM and JSR registries.

</details>

## Other Documentation

- 🚜 [CI/CD Process](./docs/ci.md)
- 🛠️ [Dev Tooling Detailed Info](./docs/dev-tooling.md)
