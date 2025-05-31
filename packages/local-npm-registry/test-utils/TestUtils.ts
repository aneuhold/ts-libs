import { vi } from 'vitest';

export class TestUtils {
  static mockLogger() {
    // Only mock DR.logger to avoid console output during tests
    vi.mock('@aneuhold/core-ts-lib', async () => {
      const actual = await vi.importActual('@aneuhold/core-ts-lib');
      return {
        ...actual,
        DR: {
          logger: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            success: vi.fn()
          }
        }
      };
    });
  }
}
