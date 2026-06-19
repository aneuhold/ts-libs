import { defineProject, mergeConfig } from 'vitest/config';
import { sharedProjectConfig } from '../../vitest.shared.js';

export default mergeConfig(
  sharedProjectConfig,
  defineProject({
    test: {
      exclude: ['tmp/**/*'],
      globalSetup: ['./test-utils/globalSetup.ts'],
      // A lot of the tests in local-npm-registry depend on the entire system and configuration
      // there, so we run them serially to avoid conflicts.
      fileParallelism: false,
      env: {
        // Resolve yarn issues when running in CI
        YARN_ENABLE_HARDENED_MODE: '0',
        // Disable Yarn Berry lockfile immutability for tests
        YARN_ENABLE_IMMUTABLE_INSTALLS: 'false'
      }
    }
  })
);
