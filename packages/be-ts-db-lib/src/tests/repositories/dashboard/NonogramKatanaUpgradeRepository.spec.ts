import { expect, it } from 'vitest';
import DashboardNonogramKatanaUpgradeRepository from '../../../repositories/dashboard/DashboardNonogramKatanaUpgradeRepository.js';

const upgradeRepo = DashboardNonogramKatanaUpgradeRepository.getRepo();

/**
 * Deletes all Nonogram Katana Upgrades!
 *
 * To just do a cleanup, put `only` after `it`. So `it.only('can delete all upgrades'`
 */
it.skip('can delete all upgrades', async () => {
  const result = await upgradeRepo.deleteAll();
  expect(result.acknowledged).toBeTruthy();
});
