import type Config from './services/ConfigService/ConfigDefinition.js';
import ConfigService from './services/ConfigService/Config.service.js';
import TranslationService, {
  TranslationSource
} from './services/TranslationService/Translation.service.js';

// Export all the functions and classes from this library
export { ConfigService, TranslationService, TranslationSource };

// Export TypeScript types where needed
export type { Config };
