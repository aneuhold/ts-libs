import { defineProject, mergeConfig } from 'vitest/config';
import { sharedProjectConfig } from '../../vitest.shared.js';

export default mergeConfig(
  sharedProjectConfig,
  defineProject({
    test: {
      globalSetup: './test-util/vitest.setup.ts',
      // So we don't hammer the database too hard and start having tests timeout
      maxWorkers: 4
    }
  })
);
