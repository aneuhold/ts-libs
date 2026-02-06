# Phase 1: Foundation - Base Classes and Directory Structure

## Prerequisites

- `core-ts-db-lib` package has all workout document schemas exported
- Familiarity with existing `be-ts-db-lib` patterns (BaseRepository, DashboardBaseRepository)

## Objectives

1. Create `WorkoutBaseRepository` with automatic `lastUpdatedDate` handling
2. Create `WorkoutBaseWithUserIdRepository` for user-scoped documents
3. Set up directory structure for validators
4. Add CleanDocument helper methods
5. Verify the foundation works correctly

## Files to Create

### 1. WorkoutBaseRepository

**Path**: `src/repositories/workout/WorkoutBaseRepository.ts`

```typescript
import type {
  BaseDocumentWithType,
  BaseDocumentWithUpdatedAndCreatedDates
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { BulkWriteResult, DeleteResult, UpdateResult } from 'mongodb';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import type IValidator from '../../validators/BaseValidator.js';
import BaseRepository from '../BaseRepository.js';

/**
 * A base repository for the `workout` collection.
 */
export default abstract class WorkoutBaseRepository<
  TBaseType extends BaseDocumentWithType & BaseDocumentWithUpdatedAndCreatedDates
> extends BaseRepository<TBaseType> {
  private static COLLECTION_NAME = 'workout';

  constructor(
    protected docType: string,
    validator: IValidator<TBaseType>,
    updateCleaner?: (doc: Partial<TBaseType>) => Partial<TBaseType>
  ) {
    const defaultUpdateCleaner = (updatedDoc: Partial<TBaseType>) => {
      const cleaned = CleanDocument.docType(CleanDocument.createdDate(updatedDoc));
      cleaned.lastUpdatedDate = new Date();
      return updateCleaner ? updateCleaner(cleaned) : cleaned;
    };
    const defaultFilter = { docType } as Partial<TBaseType>;
    super(WorkoutBaseRepository.COLLECTION_NAME, validator, defaultFilter, defaultUpdateCleaner);
  }

  override async insertNew(
    newDoc: TBaseType,
    meta?: DbOperationMetaData
  ): Promise<TBaseType | null> {
    meta?.recordDocTypeTouched(this.docType);
    return super.insertNew(newDoc, meta);
  }

  override async insertMany(
    newDocs: TBaseType[],
    meta?: DbOperationMetaData
  ): Promise<TBaseType[]> {
    meta?.recordDocTypeTouched(this.docType);
    return super.insertMany(newDocs, meta);
  }

  override async update(
    updatedDoc: Partial<TBaseType>,
    meta?: DbOperationMetaData
  ): Promise<UpdateResult> {
    meta?.recordDocTypeTouched(this.docType);
    return super.update(updatedDoc, meta);
  }

  override async updateMany(
    updatedDocs: Partial<TBaseType>[],
    meta?: DbOperationMetaData
  ): Promise<BulkWriteResult> {
    meta?.recordDocTypeTouched(this.docType);
    return super.updateMany(updatedDocs, meta);
  }

  override async delete(docId: UUID, meta?: DbOperationMetaData): Promise<DeleteResult> {
    meta?.recordDocTypeTouched(this.docType);
    return super.delete(docId, meta);
  }

  override async deleteList(docIds: UUID[], meta?: DbOperationMetaData): Promise<DeleteResult> {
    meta?.recordDocTypeTouched(this.docType);
    return super.deleteList(docIds, meta);
  }

  override async deleteAll(meta?: DbOperationMetaData): Promise<DeleteResult> {
    meta?.recordDocTypeTouched(this.docType);
    return super.deleteAll();
  }
}
```

### 2. WorkoutBaseWithUserIdRepository

**Path**: `src/repositories/workout/WorkoutBaseWithUserIdRepository.ts`

```typescript
import type {
  BaseDocumentWithType,
  BaseDocumentWithUpdatedAndCreatedDates,
  RequiredUserId
} from '@aneuhold/core-ts-db-lib';
import type { UUID } from 'crypto';
import type { BulkWriteResult, DeleteResult, Filter, UpdateResult } from 'mongodb';
import type DbOperationMetaData from '../../util/DbOperationMetaData.js';
import CleanDocument from '../../util/DocumentCleaner.js';
import type IValidator from '../../validators/BaseValidator.js';
import WorkoutBaseRepository from './WorkoutBaseRepository.js';

/**
 * A base repository for the `workout` collection that requires a `userId`.
 */
export default abstract class WorkoutBaseWithUserIdRepository<
  TBaseType extends BaseDocumentWithType & BaseDocumentWithUpdatedAndCreatedDates & RequiredUserId
> extends WorkoutBaseRepository<TBaseType> {
  constructor(
    docType: string,
    validator: IValidator<TBaseType>,
    updateCleaner?: (doc: Partial<TBaseType>) => Partial<TBaseType>
  ) {
    const defaultUpdateCleaner = (doc: Partial<TBaseType>) =>
      updateCleaner ? updateCleaner(CleanDocument.userId(doc)) : CleanDocument.userId(doc);
    super(docType, validator, defaultUpdateCleaner);
  }

  /**
   * Gets all items for a given user.
   */
  async getAllForUser(userId: UUID): Promise<TBaseType[]> {
    const collection = await this.getCollection();
    const filter = {
      $and: [this.getFilterWithDefault(), { userId }]
    } as Filter<TBaseType>;
    const result = await collection.find(filter).toArray();
    return result as TBaseType[];
  }

  /**
   * Deletes all documents for a specific user.
   */
  async deleteAllForUser(userId: UUID, meta?: DbOperationMetaData): Promise<DeleteResult> {
    const collection = await this.getCollection();
    const filter = {
      $and: [this.getFilterWithDefault(), { userId }]
    } as Filter<TBaseType>;
    meta?.recordDocTypeTouched(this.docType);
    meta?.addAffectedUserIds([userId]);
    return collection.deleteMany(filter);
  }

  override async insertNew(
    newDoc: TBaseType,
    meta?: DbOperationMetaData
  ): Promise<TBaseType | null> {
    const result = await super.insertNew(newDoc, meta);
    if (result) {
      meta?.addAffectedUserIds([result.userId]);
    }
    return result;
  }

  override async insertMany(
    newDocs: TBaseType[],
    meta?: DbOperationMetaData
  ): Promise<TBaseType[]> {
    const result = await super.insertMany(newDocs, meta);
    meta?.addAffectedUserIds(result.map((d) => d.userId));
    return result;
  }

  override async update(
    updatedDoc: Partial<TBaseType>,
    meta?: DbOperationMetaData
  ): Promise<UpdateResult> {
    if (meta && updatedDoc._id) {
      const docs = await this.fetchAndCacheDocsForMeta([updatedDoc._id], meta);
      if (docs.length > 0) {
        meta.addAffectedUserIds([docs[0].userId]);
      }
    }
    return super.update(updatedDoc, meta);
  }

  override async updateMany(
    updatedDocs: Partial<TBaseType>[],
    meta?: DbOperationMetaData
  ): Promise<BulkWriteResult> {
    if (meta && updatedDocs.length > 0) {
      const docIds = updatedDocs.map((doc) => doc._id).filter((id): id is UUID => id !== undefined);
      const cachedDocs = await this.fetchAndCacheDocsForMeta(docIds, meta);
      meta.addAffectedUserIds(cachedDocs.map((doc) => doc.userId));
    }
    return super.updateMany(updatedDocs, meta);
  }

  override async delete(docId: UUID, meta?: DbOperationMetaData): Promise<DeleteResult> {
    if (meta) {
      const docs = await this.fetchAndCacheDocsForMeta([docId], meta);
      if (docs.length > 0) {
        meta.addAffectedUserIds([docs[0].userId]);
      }
    }
    return super.delete(docId, meta);
  }

  override async deleteList(docIds: UUID[], meta?: DbOperationMetaData): Promise<DeleteResult> {
    if (meta) {
      const cachedDocs = await this.fetchAndCacheDocsForMeta(docIds, meta);
      meta.addAffectedUserIds(cachedDocs.map((doc) => doc.userId));
    }
    return super.deleteList(docIds, meta);
  }
}
```

### 3. Add CleanDocument Methods

**Path**: `src/util/DocumentCleaner.ts`

Add the following methods to the existing `CleanDocument` class:

```typescript
  static createdDate<TDocType extends BaseDocumentWithUpdatedAndCreatedDates>(
    updateDoc: Partial<TDocType>
  ) {
    const docCopy = { ...updateDoc };
    delete docCopy.createdDate;
    return docCopy;
  }

  static lastUpdatedDate<TDocType extends BaseDocumentWithUpdatedAndCreatedDates>(
    updateDoc: Partial<TDocType>
  ) {
    const docCopy = { ...updateDoc };
    delete docCopy.lastUpdatedDate;
    return docCopy;
  }
```

Also add the import at the top:

```typescript
import type {
  BaseDocument,
  BaseDocumentWithType,
  BaseDocumentWithUpdatedAndCreatedDates,
  RequiredUserId
} from '@aneuhold/core-ts-db-lib';
```

### 4. Create Directory Structure

```bash
mkdir -p src/repositories/workout
mkdir -p src/validators/workout
```

## Verification Steps

1. **Type checking**:

   ```bash
   cd packages/be-ts-db-lib
   pnpm check
   ```

2. **Import verification**:
   Create a temporary test file to verify imports work:

   ```typescript
   // temp-test.ts
   import WorkoutBaseRepository from './src/repositories/workout/WorkoutBaseRepository.js';
   import WorkoutBaseWithUserIdRepository from './src/repositories/workout/WorkoutBaseWithUserIdRepository.js';
   console.log('Imports successful');
   ```

3. **Verify directory structure**:
   ```bash
   ls -la src/repositories/workout
   ls -la src/validators/workout
   ```

## Acceptance Criteria

- [ ] `WorkoutBaseRepository.ts` exists and compiles without errors
- [ ] `WorkoutBaseWithUserIdRepository.ts` exists and compiles without errors
- [ ] CleanDocument helper methods added for createdDate and lastUpdatedDate
- [ ] Both files extend correct base classes
- [ ] TypeScript recognizes the generic constraints properly
- [ ] `lastUpdatedDate` is automatically set on every update
- [ ] Directory structure is created for validators
- [ ] `pnpm check` passes without errors

## Notes for Next Phase

- Phase 2 will implement the first concrete repositories (WorkoutMuscleGroup and WorkoutEquipmentType)
- These will be simple documents with minimal cross-document dependencies
- Each will need a corresponding validator
