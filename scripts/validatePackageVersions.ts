#!/usr/bin/env tsx

import DependencyService from '../packages/core-ts-lib/src/services/Dependency.service.js';
import PackageServiceUtils from '../packages/core-ts-lib/src/services/PackageService/PackageServiceUtils.js';

const validatePackageVersions = async (): Promise<void> => {
  try {
    const { packageName, version } = await PackageServiceUtils.getPackageInfo();
    await DependencyService.validatePackageDependents(packageName, version);
  } catch (error) {
    console.error('❌ Dependency validation failed:', error);
    process.exit(1);
  }
};

await validatePackageVersions();
