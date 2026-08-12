import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProjectUtils } from '../../test-utils/TestProjectUtils.js';
import { VerdaccioService } from './Verdaccio.service.js';

vi.mock('@aneuhold/core-ts-lib', async () => {
  const actual = await vi.importActual('@aneuhold/core-ts-lib');
  return {
    ...actual,
    DR: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        setVerboseLogging: vi.fn(),
        isVerboseLoggingEnabled: vi.fn(() => false)
      }
    }
  };
});

describe('Integration Tests', () => {
  // Global setup/teardown for the tmp directory
  beforeAll(async () => {
    await TestProjectUtils.setupGlobalTempDir();
  });

  afterAll(async () => {
    await TestProjectUtils.cleanupGlobalTempDir();
  });

  // Per-test setup/teardown for unique test instances
  beforeEach(async () => {
    await TestProjectUtils.setupTestInstance();
    await VerdaccioService.stop();
  });

  afterEach(async () => {
    try {
      await VerdaccioService.stop();
    } catch {
      // Ignore errors during cleanup
    }
    await TestProjectUtils.cleanupTestInstance();
  });

  describe('start', () => {
    it('should leave the server running when called again', async () => {
      await VerdaccioService.start();

      await expect(VerdaccioService.start()).resolves.not.toThrow();

      // The second call returning early rather than starting a second server is
      // what leaves this one able to stop it
      await expect(VerdaccioService.stop()).resolves.not.toThrow();
    });
  });
});
