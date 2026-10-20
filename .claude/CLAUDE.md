# ts-libs

## Language

@../node_modules/@aneuhold/robot-instructions/src/instructions/lang/typescript.md

## Runtime

@../node_modules/@aneuhold/robot-instructions/src/instructions/runtime/node.md

## Tooling

@../node_modules/@aneuhold/robot-instructions/src/instructions/tooling/vitest.md

@../node_modules/@aneuhold/robot-instructions/src/instructions/tooling/npm-package.md

## This repo

- A pnpm monorepo of TypeScript packages, tested with Vitest.
- Reference `../docs/ci.md` for the CI/CD process.
- Read `../docs/dev-tooling.md` in full before using `pnpm watch`, `preparePkg`, `local-npm`, or a consumer's `sub:` scripts.
- The root describe in a test file is "Unit Tests" or "Integration Tests".
- Before considering a task complete, run `pnpm check`, `pnpm test`, and `pnpm lint`. Run them within the package being modified, or at the monorepo root to check all packages.