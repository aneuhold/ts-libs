import Config from './services/ConfigService/ConfigDefinition.js';
import ConfigService from './services/ConfigService/ConfigService.js';
import TranslationService, {
  TranslationSource
} from './services/TranslationService/TranslationService.js';

// Export all the functions and classes from this library
export { ConfigService, TranslationService, TranslationSource };

// Export TypeScript types where needed
export type { Config };
