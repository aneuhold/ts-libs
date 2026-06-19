import { defineProject } from 'vitest/config';

/**
 * Test configuration shared by every package project. Merge it into a package's
 * config with `mergeConfig` and add or override fields as needed. Arrays such as
 * `exclude` are concatenated by the merge rather than replaced.
 */
export const sharedProjectConfig = defineProject({
  test: {
    exclude: ['lib/**/*', 'node_modules/**/*'],
    // Many tests hit a real database or external system, so round-trips can run
    // several seconds and spike further when those systems are slow. Raise the
    // per-test timeout above Vitest's 5s default to absorb that variance.
    testTimeout: 20000
  }
});
