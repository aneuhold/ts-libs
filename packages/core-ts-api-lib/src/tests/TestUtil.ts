import { BSON } from 'bson';
import { vi } from 'vitest';

export class TestUtil {
  /**
   * Mocks fetch globally to return the expected output. This should match how
   * the output is expected to be returned from the Digital Ocean function.
   *
   * @param expectedOutput The expected output from the fetch call.
   */
  static mockFetch(expectedOutput: object) {
    global.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi
        .fn()
        .mockResolvedValue(Buffer.from(BSON.serialize(expectedOutput))),
      headers: new Map([['Content-Type', 'application/octet-stream']])
    });
  }
}
