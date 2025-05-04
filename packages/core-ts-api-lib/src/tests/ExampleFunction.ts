import DOFunction, {
  DOFunctionInput,
  DOFunctionOutput
} from '../services/DOFunctionService/DOFunction.js';

export const EXAMPLE_FUNCTION_URL = 'https://example.com/function';

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

export interface ExampleInput extends DOFunctionInput {
  name: string;
}

export interface ExampleOutput extends DOFunctionOutput {
  greeting: string;
}
