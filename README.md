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
- The system for verdaccio could potentially be another package, called @aneuhold/local-npm-registry.
- The way it could potentially work:
  1. On startup, check if the `verdaccio-memory` system is running. If it isn't, then turn it on.
  2. Check if there is a local JSON file of some kind that will act as the "store". This store will just handle the package names (unless verdaccio has this feature built in?), and what folder paths have installed a package / where a package has come from.
  3. Build the local JSON file but make it empty at first
  4. Setup a nodemon script that will watch the folder where the initial command was ran for changes. When that folder changes it will publish a new package version to the local registry.
  5. In another folder, hook it up so that when a new command is ran from @aneuhold/local-npm-registry for a particular package (like `local-install package-name`) it will try and find that package in the local JSON file. If it finds it then two things happen:
     1. The version of the package in the current folder's package.json is set to the one that was published locally (version-sometimestamp).
     2. A nodemon process is setup that will watch the local JSON file for changes. When changes occur, it will re-install the latest package for any packages that have a different version from the `package.json` that is setup locally.
  6. This should result in the flow being "Change is made to 1 package that is publishing to local" -> "Package is published locally" -> "Local JSON store is updated with new version for that package" -> "Nodemon script is triggered in all packages watching" -> "All packages watching compare versions, and update their local package.json version + install the new package they are watching if there is a difference".
