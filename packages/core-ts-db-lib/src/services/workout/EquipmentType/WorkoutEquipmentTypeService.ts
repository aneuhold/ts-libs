import type { WorkoutEquipmentType } from '../../../documents/workout/WorkoutEquipmentType.js';

/**
 * A service for handling operations related to {@link WorkoutEquipmentType}s.
 */
export default class WorkoutEquipmentTypeService {
  /**
   * Generates an array of weight options for adjustable equipment (e.g., barbells).
   *
   * Starts at minWeight (e.g., the bar weight), increments by increment (e.g., 2.5, 5, 10 lbs),
   * and continues until maxWeight is reached or exceeded.
   *
   * This may be refactored / maybe a new method will be created in the future to handle a given
   * set of weight plates to generate all possible combinations.
   *
   * @param minWeight The minimum weight (e.g., bar weight).
   * @param increment The weight increment.
   * @param maxWeight The maximum weight.
   */
  static generateWeightOptions(minWeight: number, increment: number, maxWeight: number): number[] {
    const weights: number[] = [];
    let currentWeight = minWeight;

    while (currentWeight <= maxWeight) {
      weights.push(currentWeight);
      currentWeight += increment;
    }

    return weights;
  }

  /**
   * Finds the nearest available weight from equipmentType.weightOptions.
   *
   * @param equipmentType The workout equipment type.
   * @param targetWeight The target weight.
   * @param direction The direction to search:
   * - 'up': Find the smallest weight >= targetWeight (returns null if none found)
   * - 'down': Find the largest weight <= targetWeight (returns null if none found)
   * - 'nearest': Find the weight with minimum absolute difference from targetWeight
   * - 'prefer-down': Return 'down' if available, otherwise 'up' (may return null if neither found)
   * - 'prefer-up': Return 'up' if available, otherwise 'down' (may return null if neither found)
   * @returns The found weight, or null when not found.
   */
  static findNearestWeight(
    equipmentType: WorkoutEquipmentType,
    targetWeight: number,
    direction: 'up' | 'down' | 'nearest' | 'prefer-down' | 'prefer-up'
  ): number | null {
    if (!equipmentType.weightOptions || equipmentType.weightOptions.length === 0) {
      return null;
    }

    const sortedWeights = [...equipmentType.weightOptions].sort((a, b) => a - b);

    // Find the next lowest and next highest weights
    const upResult = sortedWeights.find((weight) => weight >= targetWeight) ?? null;
    const downResult =
      sortedWeights
        .slice()
        .reverse()
        .find((weight) => weight <= targetWeight) ?? null;

    // Apply direction logic
    if (direction === 'up') {
      return upResult;
    }

    if (direction === 'down') {
      return downResult;
    }

    if (direction === 'prefer-down') {
      return downResult ?? upResult;
    }

    if (direction === 'prefer-up') {
      return upResult ?? downResult;
    }

    // direction === 'nearest'
    if (upResult === null) return downResult;
    if (downResult === null) return upResult;

    const upDiff = Math.abs(targetWeight - upResult);
    const downDiff = Math.abs(targetWeight - downResult);

    return downDiff <= upDiff ? downResult : upResult;
  }
}
