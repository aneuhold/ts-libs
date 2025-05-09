// @ts-check

import baseConfig from '../../eslint.config.js';

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray} */
export default [
  ...baseConfig,
  {
    // other override settings. e.g. for `files: ['**/*.test.*']`
    rules: {
      '@typescript-eslint/unbound-method': 'off'
    }
  }
];
