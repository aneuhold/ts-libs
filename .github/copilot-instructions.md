## Overall

Unless otherwise specified, always make suggested edits in the files directly instead of printing them out if you have access to the files.

## Project Features

- Uses TypeScript for the source code

## Formatting

### TypeScript

- Always add types when it is not clear what the type of something is. If a type is an object any larger than a single property, it should be a separately declared `type` and not defined inline.
- When creating types in their own file, always use PascalCase for the type name.
  - The file name should match primary type name that is being exported from the file.
- Use arrow-functions where possible to reduce lines of code and simplify things
- Always add JS Doc comments for methods, functions, and classes. Only add JSDoc comments for class properties if they are public, or they could be considered complex in their usage. Always add @param, but do not add @returns.
- Never prefix a function or method with underscores.
- Always order methods in a class by visibility (public, protected, private). If multiple methods have the same visibility, the order doesn't matter.
- Use `async` and `await` for asynchronous code instead of `.then()`.
- Use `const` and `let` instead of `var`.

## Structure

- For TypeScript libraries, always include an `index.ts` file at the root of the package that exports all public types and functions. Never include an `index.ts` file anywhere else in the package.
