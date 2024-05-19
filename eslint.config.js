const config = (async () => (await import('./eslint.config.mjs')).default)();

module.exports = config;
