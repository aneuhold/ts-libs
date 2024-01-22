export default class ArrayService {
  static arraysHaveSamePrimitiveValues(
    array1: Array<unknown>,
    array2: Array<unknown>
  ): boolean {
    if (array1.length !== array2.length) {
      return false;
    }

    const array1Copy = [...array1];
    const array2Copy = [...array2];

    array1Copy.sort();
    array2Copy.sort();

    return array1Copy.every((value, index) => value === array2Copy[index]);
  }
}
