# Core TS DB Lib: Deep Dive & Zod Migration Report

## 1. Executive Summary

This report analyzes the current state of `core-ts-db-lib`, specifically focusing on document typing and validation, and explores the feasibility and benefits of migrating to [Zod](https://zod.dev/).

**Current Status:** The library uses TypeScript classes for document definitions and a custom, imperative validation system (`ValidateUtil`) that mutates objects to enforce types.
**Recommendation:** **Strongly recommend migrating to Zod.**
**Key Benefits:**
- **Unified Source of Truth:** One schema definition generates both TypeScript types and runtime validators.
- **Declarative Validation:** Replaces verbose manual checks with concise schema definitions.
- **Robustness:** Zod handles edge cases, coercion, and defaults more reliably than the current custom solution.
- **Ecosystem:** Better integration with frontend forms and API validation.

---

## 2. Deep Dive: Current System Analysis

### 2.1 Document Structure
Currently, documents are defined as TypeScript classes extending `BaseDocument` or `BaseDocumentWithType`.

**Example (`User.ts`):**
```typescript
export default class User extends BaseDocument {
  userName: string;
  email?: string;
  auth: { password?: string; googleId?: string; } = {};
  // ...
}
```

**Observations:**
- **Classes as Types:** The class itself serves as the type definition.
- **Initialization:** Constructors are used to set initial state, but often rely on default property values.
- **`ObjectId`:** Heavily relies on `bson`'s `ObjectId`.

### 2.2 Validation Mechanism
Validation is handled by a custom `ValidateUtil` class and specific validator functions (e.g., `validateUser`).

**Example (`ValidateUtil.ts`):**
```typescript
// Imperative and mutating
validate.string('userName', 'UsernameUnknown');
validate.optionalString('password');
```

**Critique:**
- **Mutation:** The validator modifies the object in place (e.g., setting defaults, deleting invalid fields). This can lead to unpredictable side effects.
- **Boilerplate:** Every field requires a manual function call. Adding a field requires updating the class *and* the validator.
- **Limited Expressiveness:** Complex validations (e.g., "string must be an email") require custom logic implementation.
- **Maintenance Burden:** The `ValidateUtil` class itself needs to be maintained and tested.

### 2.3 Embedded Types
Complex nested structures like `RecurrenceInfo` use separate interfaces and manual validation functions (`validateRecurrenceInfo`). This fragments the schema definition across multiple files and functions.

---

## 3. Zod Migration Strategy

Migrating to Zod involves shifting from **Class-based + Manual Validation** to **Schema-based + Inferred Types**.

### 3.1 Step 1: Setup & Base Schemas
First, install Zod and define a reusable schema for `ObjectId`.

```bash
pnpm add zod
```

**`src/schemas/common.ts`:**
```typescript
import { z } from 'zod';
import { ObjectId } from 'bson';

// Custom Zod schema for ObjectId
export const ObjectIdSchema = z.custom<ObjectId>(
  (val) => val instanceof ObjectId,
  { message: 'Invalid ObjectId' }
);

export const BaseDocumentSchema = z.object({
  _id: ObjectIdSchema.default(() => new ObjectId()),
});
```

### 3.2 Step 2: Migrating Enums & Embedded Types
Convert TypeScript enums and interfaces to Zod schemas.

**Example (`RecurrenceInfo`):**
```typescript
import { z } from 'zod';

export const RecurrenceFrequencyTypeEnum = z.nativeEnum(RecurrenceFrequencyType);

export const RecurrenceInfoSchema = z.object({
  frequency: RecurrenceFrequencySchema, // Define this similarly
  recurrenceBasis: z.nativeEnum(RecurrenceBasis),
  recurrenceEffect: z.nativeEnum(RecurrenceEffect),
});

export type RecurrenceInfo = z.infer<typeof RecurrenceInfoSchema>;
```

### 3.3 Step 3: Migrating Documents
Replace Document classes with Zod schemas.

**Example (`User.ts`):**
```typescript
import { z } from 'zod';
import { BaseDocumentSchema } from './common';

export const UserSchema = BaseDocumentSchema.extend({
  userName: z.string().default('UsernameUnknown'), // Replaces validate.string default
  email: z.string().email().optional(),
  auth: z.object({
    password: z.string().optional(),
    googleId: z.string().optional(),
  }).default({}),
  projectAccess: z.object({
    dashboard: z.boolean().default(true),
  }).default({ dashboard: true }),
});

// Infer the type from the schema
export type User = z.infer<typeof UserSchema>;
```

### 3.4 Step 4: Handling "Fixing" Behavior
The current system "fixes" invalid data (sets defaults, removes invalid fields). Zod is strict by default but can emulate this using `.catch()` or `.default()`.

- **Defaults:** `z.string().default('default')` handles missing values.
- **Catching Errors:** `z.string().catch('default')` handles invalid types (e.g., receiving a number instead of a string).
- **Stripping Unknowns:** `z.object({ ... }).passthrough()` or `.strict()` controls how unknown fields are handled. Zod strips unknown keys by default when parsing, which matches the "cleanup" behavior.

### 3.5 Step 5: Validation Service
Replace `DocumentValidator` functions with Zod parsing.

```typescript
export const validateUser = (data: unknown) => {
  const result = UserSchema.safeParse(data);
  if (!result.success) {
    return { 
      updatedDoc: null, 
      errors: result.error.flatten().fieldErrors 
    };
  }
  return { updatedDoc: result.data, errors: [] };
};
```

---

## 4. Benefits & Drawbacks

| Feature | Current System | Zod System |
| :--- | :--- | :--- |
| **Type Definition** | Manual Class | Inferred from Schema |
| **Validation Logic** | Imperative, Manual | Declarative, Auto-generated |
| **Runtime Safety** | Depends on implementation | Guaranteed by Schema |
| **Data Cleaning** | Mutates input | Returns new, clean object |
| **Maintenance** | High (Class + Validator) | Low (Schema only) |
| **Bundle Size** | Small (Custom code) | Medium (~12kb gzipped) |
| **Performance** | Fast (Native checks) | Fast (Optimized) |

### Key Advantages of Zod:
1.  **Co-location:** Type and validation logic live together. You cannot forget to update the validator when you add a field.
2.  **Rich Validation:** Easily add checks for emails, URLs, min/max lengths, regex patterns, etc.
3.  **Frontend Integration:** The same `UserSchema` can be used in the frontend with libraries like `react-hook-form` (via `@hookform/resolvers/zod`) to validate forms *before* sending data.
4.  **Immutability:** Zod encourages immutable data patterns, which reduces bugs related to side effects.

### Potential Challenges:
1.  **Class Methods:** If your current Document classes have methods (logic), you will need to move them to utility functions or use a pattern where the Class wraps the Zod data.
    *   *Mitigation:* Use "Anemic Domain Models" (data only) and separate Service classes for logic, which seems to be the direction of `core-ts-db-lib` anyway.
2.  **Migration Effort:** Requires rewriting all Document files.
    *   *Mitigation:* Can be done incrementally. Keep `BaseDocument` as is while migrating individual subclasses.

## 5. Conclusion

The `core-ts-db-lib` is a perfect candidate for Zod. The current validation system is a manual implementation of what Zod provides out-of-the-box. Migrating will significantly reduce code volume, improve type safety, and simplify future development for both backend and frontend consumers.

**Recommended Action:** Start by migrating `User` and `ApiKey` as a pilot to establish the patterns for `ObjectId` and `BaseDocument` before tackling the more complex `DashboardTask`.
