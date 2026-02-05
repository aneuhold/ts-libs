import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    exclude: ['lib/**/*', 'node_modules/**/*'],
    globalSetup: './test-util/vitest.setup.ts',
    // So we don't hammer the database too hard and start having tests timeout
    maxWorkers: 4
  }
});
