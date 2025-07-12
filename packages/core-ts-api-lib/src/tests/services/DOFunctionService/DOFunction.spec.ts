import { BSON } from 'bson';
import { describe, expect, it } from 'vitest';
import { APIResponse } from '../../../types/APIResponse.js';
import {
  EXAMPLE_FUNCTION_URL,
  ExampleFunction,
  ExampleInput,
  ExampleOutput
} from '../../ExampleFunction.js';
import { TestUtil } from '../../TestUtil.js';

describe('DOFunction', () => {
  it('should call the function and return the expected output', async () => {
    const exampleFunction = ExampleFunction.getFunction();

    const input: ExampleInput = { name: 'John' };
    const expectedOutput: APIResponse<ExampleOutput> = {
      success: true,
      errors: [],
      data: { greeting: 'Hello, John!' }
    };

    TestUtil.mockFetch(expectedOutput);

    const output = await exampleFunction.call(input);

    expect(output).toEqual(expectedOutput);
    expect(global.fetch).toHaveBeenCalledWith(EXAMPLE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        Connection: 'keep-alive',
        'Content-Type': 'application/octet-stream',
        Accept: 'application/octet-stream'
      },
      body: Buffer.from(BSON.serialize(input))
    });
  });
});
