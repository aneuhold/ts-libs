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

## Changelog Generation

This monorepo uses a custom changelog generation system to maintain consistent, semantic versioning-aligned changelogs across all packages. Each package maintains its own `CHANGELOG.md` file following the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, inspired by the [Commander.js changelog](https://raw.githubusercontent.com/tj/commander.js/395cf7145fe28122f5a69026b310e02df114f907/CHANGELOG.md).

### Format Structure

Each changelog follows this structure:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.0.1] (2025-06-19)

### Fixed

- Bug fixes for this version

## [1.0.0] (2025-06-18)

### Added

- Initial release
```

**Note**: There is no "Unreleased" section since every merge to main requires a version bump when packages are changed.

### Requirements

1. **Individual Package Changelogs**: Each package maintains its own `CHANGELOG.md` file in the package root directory

2. **Validation Integration**: Changelog validation is automatically triggered during:

   - `npm:validate` commands (via `tb pkg validateNpm`)
   - `jsr:validate` commands (via `tb pkg validateJsr`)
   - Both commands utilize the `PackageService` from `core-ts-lib`

3. **Version Validation**: The system validates that:

   - The changelog contains an entry for the current package version
   - The version entry includes at least one of the required section types:
     - `### Added` - for new features
     - `### Changed` - for changes in existing functionality
     - `### Fixed` - for bug fixes
     - `### Removed` - for removed features
   - Each required section contains meaningful content (not just the header)

4. **Content Requirements**:

   - Sections must have content beyond the header (e.g., bullet points, descriptions)
   - Empty sections or placeholder text will fail validation
   - Breaking changes should be prefixed with `*Breaking*:` within the appropriate section

5. **Parsing Strategy**:

   - Changelogs are parsed by splitting on `##` markers to identify version sections
   - Within each version section, content is parsed by splitting on `###` to identify change type sections
   - This approach maintains strict format compliance

6. **Initialization Support**:

   - `ChangelogService` provides methods to initialize a new changelog for packages that don't have one
   - New changelogs are created with the standard header and an initial version entry
   - Initialization is idempotent - calling it multiple times will not duplicate content
   - If a changelog already exists with content for the current version, no changes are made

7. **Service Implementation**:

   - New `ChangelogService` class in `core-ts-lib` handles all changelog operations
   - Integrates with existing `PackageService` validation workflows
   - Provides both validation and initialization capabilities
   - If shared logic is needed between `ChangelogService` and `PackageService`, create a separate service with an appropriate name to avoid circular dependencies

8. **Architecture Principles**:
   - Services maintain single responsibility and avoid circular dependencies
   - Shared functionality is extracted to appropriately named utility services
   - All operations are designed to be idempotent and safe to run multiple times

### Benefits

- **Consistency**: Uniform changelog format across all packages
- **Automation**: Reduces manual changelog maintenance overhead
- **Quality Assurance**: Ensures changelogs are updated with each version bump
- **Semantic Versioning**: Aligns with semantic versioning principles
- **Developer Experience**: Clear expectations for changelog maintenance
