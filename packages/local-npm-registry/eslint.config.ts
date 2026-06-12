import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    // other override settings. e.g. for `files: ['**/*.test.*']`
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off'
    }
  }
];
