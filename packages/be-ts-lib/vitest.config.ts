import { defineProject, mergeConfig } from 'vitest/config';
import { sharedProjectConfig } from '../../vitest.shared.js';

export default mergeConfig(
  sharedProjectConfig,
  defineProject({
    test: {
      setupFiles: ['./vitest.setup.ts']
    }
  })
);
