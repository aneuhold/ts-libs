import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    exclude: ['lib/**/*', 'node_modules/**/*', 'tmp/**/*'],
    testTimeout: 10000, // 10 seconds per test for integration tests
    globalSetup: ['./test-utils/globalSetup.ts'],
    poolOptions: {
      forks: {
        singleFork: true // Use a single fork for tests to avoid issues with local registry
      }
    },
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
