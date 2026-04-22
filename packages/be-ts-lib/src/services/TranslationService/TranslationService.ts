import type { Translations } from '@aneuhold/core-ts-api-lib';
import { DR } from '@aneuhold/core-ts-lib';
import 'dotenv/config';
import { parse } from 'jsonc-parser';
import GitHubService from '../GitHubService.js';

/**
 * Defines the available sources for translation files.
 *
 * Each source corresponds to a specific project or module that has
 * its own translation file stored in the translations repository.
 */
export enum TranslationSource {
  /** Translations for the dashboard project */
  Dashboard = 'dashboard'
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
  static async getTranslations(source: TranslationSource): Promise<Translations> {
    try {
      const jsonString = await GitHubService.getContentFromRepo('translations', `${source}.jsonc`);
      // The translations file has arbitrary string keys by design (including
      // `$schema` metadata), so a structural type guard would accept any
      // object anyway. Trust the source and cast.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return parse(jsonString) as Translations;
    } catch (error) {
      DR.logger.error(`Failed to load ${source}.json, error: ${String(error)}`);
      throw error;
    }
  }
}
