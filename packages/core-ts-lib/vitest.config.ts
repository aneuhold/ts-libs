import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    exclude: ['lib/**/*', 'node_modules/**/*'],
    testTimeout: 10000 // 10 seconds per test
  }
});
