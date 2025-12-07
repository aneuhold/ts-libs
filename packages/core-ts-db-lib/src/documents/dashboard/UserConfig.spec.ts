import { describe, expect, it } from 'vitest';
import DocumentService from '../../services/DocumentService.js';
import { DashboardUserConfigSchema } from './UserConfig.js';

describe('Unit Tests', () => {
  describe('DashboardUserConfigSchema', () => {
    it('should validate a minimal user config', () => {
      const userId = DocumentService.generateID();
      const result = DashboardUserConfigSchema.safeParse({ userId });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe(userId);
        expect(result.data._id).toBeDefined();
        expect(result.data.docType).toBe('userConfig');
        expect(result.data.collaborators).toEqual([]);
        expect(result.data.enableDevMode).toBe(false);
        expect(result.data.autoTaskDeletionDays).toBe(30);
      }
    });

    it('should validate enabledFeatures defaults', () => {
      const userId = DocumentService.generateID();
      const result = DashboardUserConfigSchema.safeParse({ userId });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabledFeatures.financePage).toBe(false);
        expect(result.data.enabledFeatures.automationPage).toBe(false);
        expect(result.data.enabledFeatures.entertainmentPage).toBe(false);
        expect(result.data.enabledFeatures.homePageLinks).toBe(false);
        expect(result.data.enabledFeatures.useConfettiForTasks).toBe(false);
        expect(result.data.enabledFeatures.catImageOnHomePage).toBe(false);
      }
    });

    it('should validate a complete user config', () => {
      const userId = DocumentService.generateID();
      const collaboratorId = DocumentService.generateID();
      const result = DashboardUserConfigSchema.safeParse({
        userId,
        collaborators: [collaboratorId],
        enableDevMode: true,
        enabledFeatures: {
          financePage: true,
          automationPage: true,
          entertainmentPage: false,
          homePageLinks: true,
          useConfettiForTasks: true,
          catImageOnHomePage: false
        },
        autoTaskDeletionDays: 45
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.collaborators).toEqual([collaboratorId]);
        expect(result.data.enableDevMode).toBe(true);
        expect(result.data.enabledFeatures.financePage).toBe(true);
        expect(result.data.autoTaskDeletionDays).toBe(45);
      }
    });
  });
});
