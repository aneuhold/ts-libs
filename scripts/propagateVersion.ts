#!/usr/bin/env tsx

import DependencyService from '../packages/core-ts-lib/src/services/Dependency.service.js';
import PackageServiceUtils from '../packages/core-ts-lib/src/services/PackageService/PackageServiceUtils.js';

const propagateVersion = async (): Promise<void> => {
  try {
    const { packageName, version } = await PackageServiceUtils.getPackageInfo();
    await DependencyService.propagatePackageVersion(packageName, version);
  } catch (error) {
    console.error('❌ Failed to propagate version:', error);
    process.exit(1);
  }
};

await propagateVersion();
