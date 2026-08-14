import { defineProject, mergeConfig } from 'vitest/config';
import { sharedProjectConfig } from '../../vitest.shared.js';

export default mergeConfig(
  sharedProjectConfig,
  defineProject({
    test: {
      exclude: ['tmp/**/*'],
      globalSetup: ['./test-utils/globalSetup.ts'],
      env: {
        // Resolve yarn issues when running in CI
        YARN_ENABLE_HARDENED_MODE: '0',
        // Disable Yarn Berry lockfile immutability for tests
        YARN_ENABLE_IMMUTABLE_INSTALLS: 'false'
      }
    }
  })
);
