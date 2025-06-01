import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['lib/**/*', 'node_modules/**/*', 'tmp/**/*'],
    testTimeout: 10000, // 10 seconds per test for integration tests
    onConsoleLog: () => {
      console.log('Working directory:', process.cwd());
      console.log('__dirname equivalent:', import.meta.url);
      return false;
    }
  }
});
