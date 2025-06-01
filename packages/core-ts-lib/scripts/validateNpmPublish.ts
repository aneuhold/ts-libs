import PackageService from '../src/services/PackageService.js';

/**
 * Validates npm. This is a separate script here, but it will be integrated
 * into main-scripts.
 */
async function validateNpm() {
  await PackageService.validateNpmPublish();
}

void validateNpm();
