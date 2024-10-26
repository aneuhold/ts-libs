import { BSON } from 'bson';
import { describe, expect, it, vi } from 'vitest';
import { DOFunctionRawInput, DOFunctionRawOutput } from './DOFunction.js';
import { ExampleFunction } from './DOFunction.spec.js';
import DOFunctionService from './DOFunctionService.js';

describe('DOFunctionService', () => {
  it('should handle API request and return the expected raw output', async () => {
    const rawInput: DOFunctionRawInput = {
      http: {
        body: Buffer.from(BSON.serialize({ name: 'John' })).toString('base64'),
        headers: {
          accept: '',
          'accept-encoding': '',
          'content-type': 'application/octet-stream',
          host: '',
          'user-agent': '',
          'x-forwarded-for': '',
          'x-forwarded-proto': '',
          'x-request-id': ''
        },
        isBase64Encoded: true,
        method: 'POST',
        path: '',
        queryString: ''
      }
    };

    const expectedOutput = {
      success: true,
      errors: [],
      data: { greeting: 'Hello, John!' }
    };

    const expectedRawOutput: DOFunctionRawOutput = {
      body: Buffer.from(BSON.serialize(expectedOutput)).toString('base64'),
      statusCode: 200,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    };

    global.fetch = vi.fn().mockResolvedValue({
      text: vi
        .fn()
        .mockResolvedValue(
          Buffer.from(BSON.serialize(expectedOutput)).toString('base64')
        )
    });

    const handler = ExampleFunction.getFunction().call.bind(
      ExampleFunction.getFunction()
    );
    const rawOutput = await DOFunctionService.handleApiRequest(
      rawInput,
      handler
    );

    expect(rawOutput).toEqual(expectedRawOutput);
  });
});
