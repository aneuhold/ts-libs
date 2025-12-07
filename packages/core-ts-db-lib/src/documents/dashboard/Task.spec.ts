import { describe, expect, it } from 'vitest';
import DocumentService from '../../services/DocumentService.js';
import { DashboardTaskSchema } from './Task.js';

describe('Unit Tests', () => {
  describe('DashboardTaskSchema', () => {
    it('should validate a minimal task with only userId', () => {
      const userId = DocumentService.generateID();
      const result = DashboardTaskSchema.safeParse({ userId });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(userId);
        expect(result.data._id).toBeDefined();
        expect(result.data.docType).toBe('task');
        expect(result.data.title).toBe('');
        expect(result.data.completed).toBe(false);
        expect(result.data.sharedWith).toEqual([]);
        expect(result.data.category).toBe('default');
      }
    });

    it('should validate a complete task', () => {
      const userId = DocumentService.generateID();
      const task = {
        userId,
        title: 'Test Task',
        completed: true,
        description: 'Test Description',
        tags: { [userId]: ['tag1', 'tag2'] },
        category: 'work'
      };
      const result = DashboardTaskSchema.safeParse(task);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Test Task');
        expect(result.data.completed).toBe(true);
        expect(result.data.description).toBe('Test Description');
        expect(result.data.tags[userId]).toEqual(['tag1', 'tag2']);
        expect(result.data.category).toBe('work');
      }
    });

    it('should set default dates for createdDate and lastUpdatedDate', () => {
      const userId = DocumentService.generateID();
      const result = DashboardTaskSchema.safeParse({ userId });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.createdDate).toBeInstanceOf(Date);
        expect(result.data.lastUpdatedDate).toBeInstanceOf(Date);
      }
    });

    it('should fail when userId is missing', () => {
      const result = DashboardTaskSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
