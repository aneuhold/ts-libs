# ts-libs

Monrepo for TypeScript libraries that I work on

## Notes

- Verdaccio is used to proxy packages so they can be published locally and used as if they were published, without actually publishing them yet.

## How it Works

### Build / Watch System Requirements

1. Watch & Local Publishing System

   - Implement a watch command that rebuilds packages on file changes
   - Automatically publish updated packages to local Verdaccio registry
   - Support running for individual packages or all packages
   - Only the modified package should be re-published locally. Do not worry about dependencies up the chain locally if they don't have the watch command running. If they do have the watch command running, then
   - Do not worry about
     - Circular dependencies
     - Incremental rebuilds, unless it is easy to do so / comes along with the tooling used. Full rebuilds are acceptable.
     - Testing as part of rebuilding.

2. JSR Publishing System

   - To be able to run `jsr:validate` and `jsr:publish` for any individual package, or all packages at once. The code for this command is found in [`PackageService`](packages/core-ts-lib/src/services/PackageService.ts). The biggest challenge at the moment is this, because JSR wants the actual set of TypeScript files in each package, along with a valid package.json. So no `workspace:` versions can be specified. They have to be replaced with actual versions first.
   - JSR publishing only needs to be ran as a check. JSR never needs to be published locally, it only needs to be validated in CI and published via CI. It will not be part of the watch process in any way.

3. Custom Implementation

   - Build home-grown solutions without relying on monorepo frameworks
   - Leverage existing tooling you've already created. For example, the code in `core-ts-lib` or `main-scripts`.

WIP Implementation notes:

- It seems like the first step is going to be to publish a package locally that has some timestamp at the end of the package version. Like version `1.2.3-reallylongtimestamp`. Or, maybe unpublish from verdaccio (to keep things clean) and publish again the same version. Need to see if that works.
