import tsLibConfig from '@aneuhold/eslint-config/src/configs/ts-lib-config.js';

export default [
  ...tsLibConfig,
  {
    // other override settings. e.g. for `files: ['**/*.test.*']`
  },
  {
    ignores: ['**/lib']
  }
];
