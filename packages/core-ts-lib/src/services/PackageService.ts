import { exec, spawn } from 'child_process';
import { access, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { JsonWithVersionProperty } from '../types/JsonWithVersionProperty.js';
import { PackageJson } from '../types/PackageJson.js';
import ErrorUtils from '../utils/ErrorUtils.js';
import { DR } from './DependencyRegistry.js';
import FileSystemService from './FileSystemService/FileSystemService.js';

const execAsync = promisify(exec);

/**
 * A service which can be used to assist in publishing or validating packages
 * for the current project.
 */
export default class PackageService {
  /**
   * Validates the current project for publishing to JSR. This will check if the
   * project has any pending changes first, then update the version of the
   * jsr.json to match the package.json file, then run the
   * `jsr publish --dry-run` command, and finally cleanup the changes made.
   */
  static async validateJsrPublish(): Promise<void> {
    if (await FileSystemService.hasPendingChanges()) {
      DR.logger.error('Please commit or stash your changes before publishing.');
      process.exit(1);
    }
    await PackageService.updateJsrFromPackageJson();
    const successfulDryRun = await PackageService.publishJsrDryRun();
    await PackageService.revertGitChanges();
    if (!successfulDryRun) {
      process.exit(1);
    } else {
      DR.logger.success('Successfully validated JSR publishing.');
    }
  }

  static async publishToJsr(): Promise<void> {
    if (await FileSystemService.hasPendingChanges()) {
      DR.logger.error('Please commit or stash your changes before publishing.');
      process.exit(1);
    }
    await PackageService.updateJsrFromPackageJson();
    const result = await PackageService.publishJsr();
    await PackageService.revertGitChanges();
    if (!result) {
      process.exit(1);
    } else {
      DR.logger.success('Successfully published to JSR.');
    }
  }

  static async updateJsrFromPackageJson(): Promise<void> {
    const rootDir = process.cwd();
    const packageJsonPath = path.join(rootDir, 'package.json');
    const jsrJsonPath = path.join(rootDir, 'jsr.json');

    try {
      await access(packageJsonPath);
    } catch {
      DR.logger.error('No package.json file found in the current directory.');
      return;
    }

    try {
      await access(jsrJsonPath);
    } catch {
      DR.logger.error('No jsr.json file found in the current directory.');
      return;
    }

    try {
      const packageJsonData = JSON.parse(
        await readFile(packageJsonPath, 'utf-8')
      ) as PackageJson;
      const jsrJsonData = JSON.parse(
        await readFile(jsrJsonPath, 'utf-8')
      ) as JsonWithVersionProperty;
      jsrJsonData.version = packageJsonData.version;
      await writeFile(jsrJsonPath, JSON.stringify(jsrJsonData, null, 2));
      DR.logger.info(
        'Updated jsr.json from package.json to version ' + jsrJsonData.version
      );
    } catch (error) {
      const errorString = ErrorUtils.getErrorString(error);
      DR.logger.error(
        `Failed to update jsr.json from package.json: ${errorString}`
      );
    }
  }

  /**
   * Executes a dry run of JSR publishing. Returns true if the dry run was
   * successful, false otherwise.
   */
  private static async publishJsrDryRun(): Promise<boolean> {
    DR.logger.info('Running `jsr publish --dry-run`');
    try {
      const { stdout, stderr } = await execAsync(
        'jsr publish --allow-dirty --dry-run'
      );
      if (stderr) {
        DR.logger.info(stderr);
      }
      DR.logger.info(stdout);
    } catch (error) {
      DR.logger.error(
        `Failed to run 'jsr publish --dry-run': ${ErrorUtils.getErrorString(error)}`
      );
      return false;
    }
    return true;
  }

  /**
   * Publishes the current project to JSR.
   *
   * @returns true if the publish was successful, false otherwise.
   */
  private static async publishJsr(): Promise<boolean> {
    DR.logger.info('Running `jsr publish`');
    return new Promise((resolve) => {
      const child = spawn('jsr publish', ['--allow-dirty'], {
        stdio: 'inherit',
        shell: true
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  private static async revertGitChanges(): Promise<void> {
    DR.logger.info('Reverting changes made to jsr.json');
    try {
      await execAsync('git checkout jsr.json');
    } catch (error) {
      DR.logger.error(
        `Failed to revert changes made to jsr.json: ${ErrorUtils.getErrorString(error)}`
      );
    }
  }
}
