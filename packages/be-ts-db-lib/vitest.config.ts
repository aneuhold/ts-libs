import { defineConfig } from 'vitest/config';

// Set the .env file to pull from before the tests run
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export default defineConfig({
  test: {
    exclude: ['lib/**/*', 'node_modules/**/*']
  }
});
