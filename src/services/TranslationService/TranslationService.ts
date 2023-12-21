import 'dotenv/config';
import { Logger, StringService } from '@aneuhold/core-ts-lib';
import { Translations } from '@aneuhold/core-ts-api-lib';
import GitHubService from '../GitHubService';

export const TranslationProject = {
  dashboard: 'dashboard'
} as const;
export type TranslationProject =
  (typeof TranslationProject)[keyof typeof TranslationProject];

/**
 * A class which can be used to get translations for personal projects. It is
 * expected that the translations will be loaded in fresh each time this class
 * is called.
 */
export default class TranslationService {
  /**
   * Gets translations for the provided project.
   */
  static async getTranslations(project: TranslationProject) {
    try {
      const jsonString = await GitHubService.getContentFromRepo(
        'translations',
        `${project}.jsonc`
      );
      const strippedJson = StringService.stripJsonComments(jsonString);
      return JSON.parse(strippedJson) as Translations;
    } catch (error) {
      Logger.error(`Failed to load ${project}.json, error: ${error}`);
      throw error;
    }
  }
}
