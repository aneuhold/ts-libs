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
      // Resolve yarn issues when running in CI
      YARN_ENABLE_HARDENED_MODE: '0',
      // Disable Yarn Berry lockfile immutability for tests
      YARN_ENABLE_IMMUTABLE_INSTALLS: 'false'
    }
  }
});
