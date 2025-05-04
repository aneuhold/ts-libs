// @ts-check

import baseConfig from '../../eslint.config.js';

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigArray} */
export default [
    ...baseConfig,
    {  
      files: ['**/*.json'],
      rules: {    
        '@nx/dependency-checks': [
          'error',
          {
            ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}']
          }       
        ]    
      },
      languageOptions: {
        parser: await import('jsonc-eslint-parser')
      }
    },
  {
    // other override settings. e.g. for `files: ['**/*.test.*']`
    rules: {
      '@typescript-eslint/unbound-method': 'off'
    }
  }
];
