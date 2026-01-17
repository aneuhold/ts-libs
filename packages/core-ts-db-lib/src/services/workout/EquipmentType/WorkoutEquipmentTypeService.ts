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
   * @param direction The direction to search ('up', 'down', or 'nearest').
   */
  static findNearestWeight(
    equipmentType: WorkoutEquipmentType,
    targetWeight: number,
    direction: 'up' | 'down' | 'nearest'
  ): number | null {
    if (!equipmentType.weightOptions || equipmentType.weightOptions.length === 0) {
      return null;
    }

    const sortedWeights = [...equipmentType.weightOptions].sort((a, b) => a - b);

    if (direction === 'up') {
      const result = sortedWeights.find((weight) => weight >= targetWeight);
      return result ?? null;
    }

    if (direction === 'down') {
      const result = sortedWeights.reverse().find((weight) => weight <= targetWeight);
      return result ?? null;
    }

    // direction === 'nearest'
    let closestWeight = sortedWeights[0];
    let minDifference = Math.abs(targetWeight - closestWeight);

    for (const weight of sortedWeights) {
      const difference = Math.abs(targetWeight - weight);
      if (difference < minDifference) {
        minDifference = difference;
        closestWeight = weight;
      }
    }

    return closestWeight;
  }
}
