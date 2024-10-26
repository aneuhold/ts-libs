import { BSON } from 'bson';
import { describe, expect, it, vi } from 'vitest';
import DOFunction, {
  DOFunctionCallOutput,
  DOFunctionInput,
  DOFunctionOutput
} from './DOFunction.js';

describe('DOFunction', () => {
  it('should call the function and return the expected output', async () => {
    const exampleFunction = ExampleFunction.getFunction();

    const input: ExampleInput = { name: 'John' };
    const expectedOutput: DOFunctionCallOutput<ExampleOutput> = {
      success: true,
      errors: [],
      data: { greeting: 'Hello, John!' }
    };

    global.fetch = vi.fn().mockResolvedValue({
      text: vi
        .fn()
        .mockResolvedValue(
          Buffer.from(BSON.serialize(expectedOutput)).toString('base64')
        )
    });

    const output = await exampleFunction.call(input);

    expect(output).toEqual(expectedOutput);
    expect(global.fetch).toHaveBeenCalledWith(EXAMPLE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        Connection: 'keep-alive',
        'Content-Type': 'application/octet-stream'
      },
      body: Buffer.from(BSON.serialize(input)).toString('base64')
    });
  });
});

const EXAMPLE_FUNCTION_URL = 'https://example.com/function';

export class ExampleFunction extends DOFunction<ExampleInput, ExampleOutput> {
  private static instance: ExampleFunction | undefined;

  private constructor() {
    super();
    this.url = EXAMPLE_FUNCTION_URL;
  }

  static getFunction(): ExampleFunction {
    if (!ExampleFunction.instance) {
      ExampleFunction.instance = new ExampleFunction();
    }
    return ExampleFunction.instance;
  }
}

interface ExampleInput extends DOFunctionInput {
  name: string;
}

interface ExampleOutput extends DOFunctionOutput {
  greeting: string;
}
