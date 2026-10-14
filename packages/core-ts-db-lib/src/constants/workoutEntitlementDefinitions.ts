import { WorkoutEntitlement } from '../documents/workout/WorkoutUserConfig.js';

/**
 * Everything outside the database that identifies each
 * {@link WorkoutEntitlement}, grouped by purchase provider. None of these
 * values are secret.
 */
export const workoutEntitlementDefinitions: Record<
  WorkoutEntitlement,
  {
    /**
     * Identifiers in the MesoPro RevenueCat project https://app.revenuecat.com/projects/bb068855/overview.
     */
    revenueCat: {
      /**
       * The ID RevenueCat generates for the entitlement (e.g.
       * `entla1b2c3d4e5`). The REST API identifies active entitlements by
       * this ID. See the [v2 customer docs](https://www.revenuecat.com/docs/api-v2/customer).
       */
      entitlementId: string;
      /**
       * The identifier chosen for the entitlement in the RevenueCat
       * dashboard. The client SDKs key `customerInfo.entitlements.active` by
       * this identifier. See [checking subscription status](https://www.revenuecat.com/docs/customers/customer-info).
       */
      entitlementLookupKey: string;
      /**
       * The identifier of the package in the current offering that grants
       * the entitlement. See [offerings](https://www.revenuecat.com/docs/offerings/overview).
       */
      packageId: string;
    };
  }
> = {
  [WorkoutEntitlement.Supporter]: {
    revenueCat: {
      entitlementId: 'entlf0f3a80764',
      entitlementLookupKey: 'supporter',
      packageId: 'supporter_monthly'
    }
  }
};
