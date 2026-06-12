import ChangelogService from './services/ChangelogService/index.js';
import DependencyService from './services/Dependency.service.js';
import FileSystemService, {
  type ReplaceInFilesOptions
} from './services/FileSystemService/FileSystem.service.js';
import GlobMatchingService from './services/FileSystemService/GlobMatching.service.js';
import PackageService from './services/PackageService/Package.service.js';

// Export all browser-safe exports from browser.ts
export * from './browser.js';

// Export Node.js-specific functions and classes from this library
export {
  ChangelogService,
  DependencyService,
  FileSystemService,
  GlobMatchingService,
  PackageService
};

// Export TypeScript types where needed
export type { ReplaceInFilesOptions };
