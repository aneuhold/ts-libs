## Project Setup

- TypeScript source code with Vitest testing and pnpm package management
- Make edits directly in files unless asked to create new ones

## Code Style

### Types & Functions

- Add explicit types when unclear; extract complex object types to separate `type` declarations
- Use PascalCase for type names; file names should match the primary exported type
- Use arrow functions and `const`/`let` (never `var`)
- Use `async`/`await` instead of `.then()`

### Documentation & Naming

- Add JSDoc for all methods, functions, and classes (include `@param`, omit `@returns`)
- Add JSDoc for public class properties only if complex
- Never prefix functions/methods with underscores

### Class Structure

- Order methods by visibility: public, protected, private
- Within same visibility, order doesn't matter

## File Organization

### Imports

- Use relative imports within package, package references for external packages
- Use named imports only (never `import * as`)
- Import at file top (inline only when absolutely necessary)

### Package Structure

- Include `index.ts` at package root exporting all public APIs
- Exception: CLI tools use `index.ts` for entry point instead of exports
- Never include `index.ts` elsewhere in package

### Enums

- Use PascalCase for enum names and values
- Use TypeScript `enum` (not `const enum` or `type`)

## Testing

- Test files: `filename.spec.ts` (matching source file name)
- Never test private methods directly
- Structure: Root describe as "Unit Tests"/"Integration Tests", nested describes named after tested methods
