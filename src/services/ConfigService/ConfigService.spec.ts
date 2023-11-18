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
    });

    it('should throw an error when loading configuration fails', async () => {
      const env = 'invalid_env';
      const errorLogger = console.error;
      console.error = jest.fn(); // suppress console.error
      await expect(ConfigService.useConfig(env)).rejects.toThrow();
      console.error = errorLogger; // restore console.log
    });
  });
});
