import { defineConfig } from 'vitest/config'

// This config is required in order to prevent issues with Vitest VS Code
// extension. It seems more explicit anyway, so it seems fine to keep here
// regardless.
export default defineConfig({
  test: {
    // Each package has its own vitest config that should be used independently
    projects: ['packages/*/vitest.config.ts']
  },
})