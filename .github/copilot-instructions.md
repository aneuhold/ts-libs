## Overall

Unless otherwise specified, always make suggested edits in the files directly instead of printing them out if you have access to the files.

## Project Features

- Uses TypeScript for the source code
- Uses Vitest for testing
- Uses pnpm for package management

## Formatting

- Always add types when it is not clear what the type of something is. If a type is an object any larger than a single property, it should be a separately declared `type` and not defined inline.
- When creating types in their own file, always use PascalCase for the type name.
  - The file name should match primary type name that is being exported from the file.
- Use arrow-functions where possible to reduce lines of code and simplify things
- Always add JS Doc comments for methods, functions, and classes. Only add JSDoc comments for class properties if they are public, or they could be considered complex in their usage. Always add @param, but do not add @returns.
- Never prefix a function or method with underscores.
- Always order methods in a class by visibility (public, protected, private). If multiple methods have the same visibility, the order doesn't matter.
- Use `async` and `await` for asynchronous code instead of `.then()`.
- Use `const` and `let` instead of `var`.

## Logical Structure

### Imports

- Always use relative imports for files in the same package. Use package references (`import { something } from 'my-package'`) for files in other packages.
- Never use `import * as something from '...'` syntax. Always use named imports.
- Always import at the top of a file. Never inline imports within a function or method unless absolutely necessary.

### Files

- For TypeScript libraries (with exception of libraries that are CLI tools), always include an `index.ts` file at the root of the package that exports all public types and functions. Never include an `index.ts` file anywhere else in the package.
  - Libraries that are CLI tools should still have an `index.ts` file, but it will contain the CLI entry point instead of exports.

## Testing

- When creating tests, make the file name the same as the associated file being tested, but instead of `.ts`, use `.spec.ts`.
- Never test private methods directly in a test.
- At the root of test files, name the first describe block as "Unit Tests" or "Integration Tests" depending on the type of tests being written. The first set of nested describe blocks should be named after the method that is being tested.
