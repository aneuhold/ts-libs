import { Translations } from '@aneuhold/core-ts-api-lib';
import { DR } from '@aneuhold/core-ts-lib';
import 'dotenv/config';
import { parse } from 'jsonc-parser';
import GitHubService from '../GitHubService.js';

/**
 * An enum which defines the sources of translations which can be loaded.
 */
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
   *
   * @param source - The source of the translations.
   * @returns The translations for the provided source.
   */
  static async getTranslations(
    source: TranslationSource
  ): Promise<Translations> {
    try {
      const jsonString = await GitHubService.getContentFromRepo(
        'translations',
        `${source}.jsonc`
      );
      return parse(jsonString) as Translations;
    } catch (error) {
      DR.logger.error(
        `Failed to load ${source}.json, error: ${error as string}`
      );
      throw error;
    }
  }
}
