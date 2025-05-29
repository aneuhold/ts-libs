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

## Notes

- Verdaccio is used to proxy packages so they can be published locally and used as if they were published, without actually publishing them yet.

## How it Works

### Build / Watch System Requirements

1. Watch & Local Publishing System

   - Implement a watch command that rebuilds packages on file changes.
   - Automatically publish updated packages to a local Verdaccio registry.
     - On startup, the system should check if `verdaccio-memory` is running and start it if not.
     - Published packages should use a versioning scheme that incorporates a timestamp (e.g., `1.2.3-timestamp`) or manage versions by unpublishing and republishing the same version to ensure updates are picked up.
   - Support running the watch command for individual packages or all packages.
   - Only the modified package should be rebuilt and re-published locally.
   - Implement a system (potentially a new package like `@aneuhold/local-npm-registry`) to manage local package installations and updates:
     - Maintain a local JSON file to act as a "store" for locally published package names and their versions.
     - Provide a command (e.g., `local-install package-name`) that:
       - Updates the `package.json` of the consuming project to use the locally published version.
       - Sets up a watch process (e.g., using `nodemon`) on the local JSON store.
       - When the store indicates a new version of a watched package, the consuming project should update its `package.json` and reinstall the package.
   - The intended flow:
     1. A change is made to a watched package.
     2. The package is rebuilt and published to the local Verdaccio registry with an updated version.
     3. The local JSON store is updated with the new version for that package.
     4. Watch processes in consuming projects detect the change in the store.
     5. Consuming projects update their `package.json` and reinstall the new version of the watched package.
   - Do not worry about:
     - Circular dependencies.
     - Incremental rebuilds, unless it is easy to do so / comes along with the tooling used. Full rebuilds are acceptable.
     - Testing as part of rebuilding.

2. Overall

   - Build home-grown solutions without relying on monorepo frameworks
   - Leverage existing tooling you've already created. For example, the code in `core-ts-lib` or `main-scripts`.
