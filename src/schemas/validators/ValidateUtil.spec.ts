import Validate from './ValidateUtil';

describe('Validate', () => {
  let errorsArray: string[];
  let parentObject: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    testField?: any;
  };

  beforeEach(() => {
    errorsArray = [];
    parentObject = {};
  });

  it('should validate optional string', () => {
    const validate = new Validate(parentObject, errorsArray);
    parentObject.testField = 123;
    validate.optionalString('testField');
    expect(errorsArray).toContain('testField must be a string or undefined');
    errorsArray = [];

    parentObject.testField = 'test';
    validate.optionalString('testField');
    expect(errorsArray.length).toBe(0);
  });

  it('should validate optional number', () => {
    const validate = new Validate(parentObject, errorsArray);
    parentObject.testField = true;
    validate.optionalNumber('testField');
    expect(errorsArray).toContain('testField must be a number or undefined');
    errorsArray = [];

    parentObject.testField = 123;
    validate.optionalNumber('testField');
    expect(errorsArray.length).toBe(0);
  });

  it('should validate optional boolean', () => {
    const validate = new Validate(parentObject, errorsArray);
    parentObject.testField = 123;
    validate.optionalBoolean('testField');
    expect(errorsArray).toContain('testField must be a boolean or undefined');
    errorsArray = [];

    parentObject.testField = true;
    validate.optionalBoolean('testField');
    expect(errorsArray.length).toBe(0);
  });

  it('should validate optional array', () => {
    const validate = new Validate(parentObject, errorsArray);
    parentObject.testField = 123;
    validate.optionalArray('testField');
    expect(errorsArray).toContain('testField must be an array or undefined');
    errorsArray = [];

    parentObject.testField = [];
    validate.optionalArray('testField');
    expect(errorsArray.length).toBe(0);
  });

  it('should validate required object', () => {
    const validate = new Validate(parentObject, errorsArray);
    parentObject.testField = [];
    validate.object('testField', {});
    expect(errorsArray).toContain('testField must be an object');
    errorsArray = [];

    parentObject.testField = {};
    validate.object('testField', {});
    expect(errorsArray.length).toBe(0);
  });
});
