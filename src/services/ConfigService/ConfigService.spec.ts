import { assert } from 'console';
import ConfigService from './ConfigService';
import TestUtils from '../../utils/TestUtils';

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
      assert(process.env.SOME_KEY === 'SOME_VALUE');
    });

    it('should throw an error when loading configuration fails', async () => {
      const env = 'invalid_env';
      TestUtils.suppressConsole();
      await expect(ConfigService.useConfig(env)).rejects.toThrow();
      TestUtils.restoreConsole();
    });
  });
});
