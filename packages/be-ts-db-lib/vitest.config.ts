import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    exclude: ['lib/**/*', 'node_modules/**/*'],
    globalSetup: './test-util/vitest.setup.ts'
  }
});
