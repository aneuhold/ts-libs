import 'dotenv/config';
import { Logger } from '@aneuhold/core-ts-lib';
import { Translations } from '@aneuhold/core-ts-api-lib';
import { parse } from 'jsonc-parser';
import GitHubService from '../GitHubService';

export enum TranslationSource {
  dashboard = 'dashboard'
}

/**
 * A class which can be used to get translations for personal projects. It is
 * expected that the translations will be loaded in fresh each time this class
 * is called.
 */
export default class TranslationService {
  /**
   * Gets translations for the provided source.
   */
  static async getTranslations(source: TranslationSource) {
    try {
      const jsonString = await GitHubService.getContentFromRepo(
        'translations',
        `${source}.jsonc`
      );
      return parse(jsonString) as Translations;
    } catch (error) {
      Logger.error(`Failed to load ${source}.json, error: ${error as string}`);
      throw error;
    }
  }
}
