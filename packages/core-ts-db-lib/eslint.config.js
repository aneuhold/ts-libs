// @ts-check

import baseConfig from '../../eslint.config.js';

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray} */
export default [
  ...baseConfig,
  {
    // other override settings. e.g. for `files: ['**/*.test.*']`
    rules: {
      // Turned off because in this particular library, most assumptions need
      // to be double-checked, as there could be network issues that mess up
      // data models, old data models still floating around, or incorrect
      // code in the frontend.
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-param': 'off'
    }
  }
];
