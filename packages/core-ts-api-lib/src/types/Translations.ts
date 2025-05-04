/**
 * An individual translation as defined in the translations repo.
 */
export type Translation = {
  value: string;
  description: string;
};

/**
 * A collection of translations for a given project.
 */
export interface Translations {
  [key: string]: Translation;
}
