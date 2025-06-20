import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    exclude: ['lib/**/*', 'node_modules/**/*'],
    setupFiles: ['./vitest.setup.ts']
  }
});
