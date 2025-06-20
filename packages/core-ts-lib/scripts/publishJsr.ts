import PackageService from '../src/services/PackageService/PackageService.js';

/**
 * Publishes to JSR. This is a separate script here, but it will be integrated
 * into main-scripts.
 */
async function publishJsr() {
  await PackageService.publishToJsr();
}

void publishJsr();
