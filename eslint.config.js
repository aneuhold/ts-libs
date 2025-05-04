// @ts-check

import tsLibConfig from '@aneuhold/eslint-config/src/ts-lib-config.js';
import nx from '@nx/eslint-plugin';

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray} */
export default [
  ...nx.configs['flat/base'],
  ...tsLibConfig,
  {    
    files: ['**/*.ts', '**/*.js'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*']
            }
          ]
        }
      ]
    }
  },
  {
    // other override settings. e.g. for `files: ['**/*.test.*']`
    rules: {}
  },
  {
    ignores: ['**/dist']
  }
];
