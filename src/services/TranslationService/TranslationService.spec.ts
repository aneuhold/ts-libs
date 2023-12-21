import TranslationService, { TranslationProject } from './TranslationService';

describe('TranslationService', () => {
  describe('getTranslations', () => {
    /**
     * Depends upon a GitHub token being available in the local environment.
     * This will be a local `.env` file with the CONFIG_GITHUB_TOKEN variable
     * set.
     */
    it('should load translations from GitHub', async () => {
      const translations = await TranslationService.getTranslations(
        TranslationProject.dashboard
      );
      expect(translations['test-translation'].value).toEqual('something');
    });
  });
});
