import { ObjectId } from 'bson';
import DashboardDemoAccountsService from './DashboardDemoAccountsService.js';

/**
 * Entry point for seeding demo accounts across projects.
 *
 * This class exposes static helpers that delegate to project-specific
 * implementations (e.g., dashboard).
 */
export default class DemoAccountsService {
  /**
   * Seeds demo accounts for the Dashboard project only.
   *
   * @param demoUser1Id The first demo user ID
   * @param demoUser2Id The second demo user ID
   */
  static async seedDashboardDemoAccounts(
    demoUser1Id: ObjectId,
    demoUser2Id: ObjectId
  ): Promise<void> {
    await DashboardDemoAccountsService.seedDemoAccounts(demoUser1Id, demoUser2Id);
  }
}
