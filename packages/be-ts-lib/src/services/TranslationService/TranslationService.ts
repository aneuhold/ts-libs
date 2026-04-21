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
      const parsed: unknown = parse(jsonString);
      if (!TranslationService.isTranslations(parsed)) {
        throw new Error(`Loaded ${source}.jsonc did not match the expected Translations shape.`);
      }
      return parsed;
    } catch (error) {
      DR.logger.error(`Failed to load ${source}.json, error: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Type guard that checks whether an unknown value matches the {@link Translations} shape.
   * Only the outer container is validated; non-translation entries (e.g. a `$schema` key) are
   * tolerated so the file can include metadata alongside translations.
   *
   * @param value The value to narrow.
   */
  private static isTranslations(value: unknown): value is Translations {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
