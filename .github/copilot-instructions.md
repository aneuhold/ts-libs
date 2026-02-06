## Overall Project Guidelines

- TypeScript source code with Vitest testing and pnpm package management
- Avoid code duplication; reuse existing code when possible
- Reference `../docs/ci.md` for the CI/CD process and `../docs/dev-tooling.md` for development tooling details
- Make sure to run `pnpm check`, `pnpm test`, and `pnpm lint` before considering a task complete if you are making code changes. Run it within the package that is being modified, or at the monorepo root to check all packages.
- Keep responses and code concise, focused, and clean.

## Code Style

### Types & Functions

- Add explicit types when unclear; extract complex object types to separate `type` declarations
- Use PascalCase for type names; file names should match the primary exported type
- Use arrow functions and `const`/`let` (never `var`)
- Use `async`/`await` instead of `.then()`
- NEVER use `any` type
- Almost never use `unknown`. The only way this should be used, is to override an external library type that is incorrect, which is exceedingly rare.
- NEVER use `!` non-null assertion operator. Check for null / undefined properly if it can be null.

### Documentation & Naming

- Add JSDoc for all methods, functions, and classes (only include `@param` if they are complicated / non-intuitive. If you do add `@param`, it needs to be added for all params, omit `@returns` always)
- Add JSDoc for public class properties only if complex
- Never prefix functions/methods with underscores

### Class Structure

- Order methods by visibility: public, protected, private
- Within same visibility, order doesn't matter
- Put static methods before instance methods

### Syntax and Best Practices

- NEVER use `['propertyName']` syntax to access properties, always use `.propertyName` unless the property name is dynamic. Even then though, a variable / constant should be used instead of a string literal.
- Use object destructuring when accessing multiple properties from an object
- Prefer template literals over string concatenation.

### Enums

- Use PascalCase for enum names and values
- Use TypeScript `enum` (not `const enum` or `type`)

## File Organization

### Imports

- Use relative imports within package, package references for external packages
- Use named imports only (never `import * as`)
- Import at file top (inline only when absolutely necessary)

### Package Structure

- Include `index.ts` at package root exporting all public APIs
- Exception: CLI tools use `index.ts` for entry point instead of exports
- Never include `index.ts` elsewhere in package

## Testing

- Test files: `filename.spec.ts` (matching source file name)
- Never test private methods directly
- Structure: Root describe as "Unit Tests"/"Integration Tests", nested describes named after tested methods
- Always prefer to use the built-in Vitest VS Code extension for testing
