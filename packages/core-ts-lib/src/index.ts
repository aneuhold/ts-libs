import ChangelogService from './services/ChangelogService/index.js';
import DependencyService from './services/DependencyService.js';
import FileSystemService, {
  type ReplaceInFilesOptions
} from './services/FileSystemService/FileSystemService.js';
import GlobMatchingService from './services/FileSystemService/GlobMatchingService.js';
import PackageService from './services/PackageService/PackageService.js';

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
