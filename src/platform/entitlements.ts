/**
 * Full-version purchase boundary (D-10).
 *
 * There is intentionally no native billing dependency in this stage. Web/dev
 * builds fail closed. A future native integration must inject an adapter that
 * checks actual store ownership; a purchase dialog result is not proof.
 */
export const FULL_VERSION_PRODUCT_ID = 'full_version' as const;

export type PurchaseResult =
  | 'purchased'
  | 'cancelled'
  | 'pending'
  | 'unverified'
  | 'unavailable';

export type RestoreResult = 'restored' | 'not-owned' | 'unavailable';

export interface Entitlements {
  /** True only when the selected store adapter confirms full-version ownership. */
  isFull(): Promise<boolean>;
  /** Starts a user-initiated store purchase; never unlocks on its own. */
  purchase(): Promise<PurchaseResult>;
  /** User-initiated store sync followed by a fresh entitlement lookup. */
  restore(): Promise<RestoreResult>;
}

export type StorePurchaseResult = 'completed' | 'cancelled' | 'pending';

/**
 * Interface for a future Capacitor 8 native bridge (NOT implemented here).
 * Implementations must:
 * - reject pending, cancelled, revoked and unverified transactions;
 * - check the exact product and app/package, not an arbitrary local flag;
 * - acknowledge Android PURCHASED transactions (not consume this product);
 * - preserve legitimate offline entitlements and distinguish "offline" from
 *   "store confirmed not owned" (throw on an indeterminate check).
 * See docs/BILLING.md for the threat model and native verification limits.
 */
export interface StoreEntitlementAdapter {
  hasFullVersion(productId: typeof FULL_VERSION_PRODUCT_ID): Promise<boolean>;
  buyFullVersion(productId: typeof FULL_VERSION_PRODUCT_ID): Promise<StorePurchaseResult>;
  syncPurchases(): Promise<void>;
}

/** Web/dev fallback: cannot buy or restore, and never grants paid content. */
export function createWebEntitlements(): Entitlements {
  return {
    async isFull() { return false; },
    async purchase() { return 'unavailable'; },
    async restore() { return 'unavailable'; },
  };
}

/** Dependency-injection seam for the native adapter in a later PR. */
export function createEntitlements(store?: StoreEntitlementAdapter): Entitlements {
  if (!store) return createWebEntitlements();

  return {
    async isFull() {
      return store.hasFullVersion(FULL_VERSION_PRODUCT_ID);
    },
    async purchase() {
      const outcome = await store.buyFullVersion(FULL_VERSION_PRODUCT_ID);
      if (outcome === 'cancelled' || outcome === 'pending') return outcome;
      if (outcome !== 'completed') throw new Error('Unknown store purchase result');
      // The purchase UI completing is insufficient: confirm actual entitlement.
      return await store.hasFullVersion(FULL_VERSION_PRODUCT_ID) ? 'purchased' : 'unverified';
    },
    async restore() {
      await store.syncPurchases();
      return await store.hasFullVersion(FULL_VERSION_PRODUCT_ID) ? 'restored' : 'not-owned';
    },
  };
}

// Deliberately stays in free mode until a verified native bridge is wired in.
export const entitlements: Entitlements = createWebEntitlements();
