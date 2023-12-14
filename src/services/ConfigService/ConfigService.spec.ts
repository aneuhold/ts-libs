import { assert } from 'console';
import ConfigService from './ConfigService';

describe('ConfigService', () => {
  describe('useConfig', () => {
    /**
     * Depends upon a GitHub token being available in the local environment.
     * This will be a local `.env` file with the CONFIG_GITHUB_TOKEN variable
     * set.
     */
    it('should load configuration from GitHub', async () => {
      const env = 'local';
      await ConfigService.useConfig(env);
      assert(ConfigService.config.someKey === 'SOME_VALUE');
    });
  });
});
