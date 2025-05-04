import PackageService from '../src/services/PackageService.js';

/**
 * Validates JSR. This is a separate script here, but it will be integrated
 * into main-scripts.
 */
async function validateJsr() {
  await PackageService.validateJsrPublish();
}

void validateJsr();
