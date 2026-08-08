import tsLibConfig from '@aneuhold/eslint-config/src/configs/ts-lib-config.js';

export default [
  ...tsLibConfig,
  {
    // other override settings. e.g. for `files: ['**/*.test.*']`
    rules: {
      // This is done a lot. Probably should just remove this from the base eslint-config. Not sure
      // why it is a bad thing anyway.
      '@typescript-eslint/no-dynamic-delete': 'off'
    }
  },
  {
    ignores: ['**/lib', '**/eslint.config.ts']
  }
];
