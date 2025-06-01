import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['lib/**/*', 'node_modules/**/*', 'tmp/**/*'],
    testTimeout: 10000, // 10 seconds per test for integration tests
    globalSetup: ['./test-utils/globalSetup.ts'],
    // Disable parallelism for test files because it causes issues with
    // the file locking mechanism.
    fileParallelism: false,
    env: {
      // Clear npm configuration environment variables that interfere with local registry tests
      npm_config_registry: undefined,
      npm_config_prefer_workspace_packages: undefined,
      npm_config_frozen_lockfile: undefined,
      npm_config_link_workspace_packages: undefined,
      npm_config__jsr_registry: undefined,
      npm_config__predictiveindex_registry: undefined,
      // Resolve yarn issues when running in CI
      YARN_ENABLE_HARDENED_MODE: '0',
      // Disable Yarn Berry lockfile immutability for tests
      YARN_ENABLE_IMMUTABLE_INSTALLS: 'false'
    }
  }
});
