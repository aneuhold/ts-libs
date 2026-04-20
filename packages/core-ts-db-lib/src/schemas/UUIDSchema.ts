import z from 'zod';
import DocumentService from '../services/DocumentService.js';

/**
 * Shared zod schema for UUIDv7 values that narrows the resulting string to the
 * branded {@link crypto.UUID} type without using a type assertion.
 */
export const UUIDSchema = z.uuidv7().transform((val) => DocumentService.toUUID(val));
