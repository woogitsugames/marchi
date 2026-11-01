import {
  FULL_VERSION_PRODUCT_ID,
  createEntitlements,
  createWebEntitlements,
  entitlements,
  type StoreEntitlementAdapter,
  type StorePurchaseResult,
} from '../src/platform/entitlements';
import { assert, eq, test } from './harness';

function fakeStore() {
  let owned = false;
  let purchaseResult: StorePurchaseResult = 'completed';
  let purchases = 0;
  let checks = 0;
  let syncs = 0;
  const products: string[] = [];
  const adapter: StoreEntitlementAdapter = {
    async hasFullVersion(productId) {
      products.push(productId);
      checks++;
      return owned;
    },
    async buyFullVersion(productId) {
      products.push(productId);
      purchases++;
      return purchaseResult;
    },
    async syncPurchases() { syncs++; },
  };
  return {
    adapter,
    setOwned(value: boolean) { owned = value; },
    setPurchaseResult(value: StorePurchaseResult) { purchaseResult = value; },
    get counts() { return { purchases, checks, syncs }; },
    products,
  };
}

test('web/dev and the exported default fail closed without persisting an unlock', async () => {
  for (const api of [createWebEntitlements(), createEntitlements(), entitlements]) {
    eq(await api.isFull(), false, 'full version is locked');
    eq(await api.purchase(), 'unavailable', 'no web purchase simulation');
    eq(await api.restore(), 'unavailable', 'no web restore simulation');
    eq(await api.isFull(), false, 'buy or restore cannot unlock in web mode');
  }
});

test('native adapter checks the exact non-consumable product', async () => {
  const store = fakeStore();
  const api = createEntitlements(store.adapter);
  eq(await api.isFull(), false, 'not initially owned');
  store.setOwned(true);
  eq(await api.isFull(), true, 'trusted store ownership reported');
  eq(await api.purchase(), 'purchased', 'verified purchase reported');
  eq(store.counts.purchases, 1, 'purchase invoked once');
  assert(store.products.every((id) => id === FULL_VERSION_PRODUCT_ID), 'only full_version SKU is requested');
});

test('a completed payment dialog does not unlock without store entitlement', async () => {
  const store = fakeStore();
  const api = createEntitlements(store.adapter);
  eq(await api.purchase(), 'unverified', 'do not unlock unverified purchase');
  eq(await api.isFull(), false, 'must still be locked');
});

test('pending and cancelled transactions never trigger an entitlement grant', async () => {
  const store = fakeStore();
  const api = createEntitlements(store.adapter);
  store.setPurchaseResult('pending');
  eq(await api.purchase(), 'pending', 'pending purchase');
  store.setPurchaseResult('cancelled');
  eq(await api.purchase(), 'cancelled', 'cancelled purchase');
  eq(store.counts.checks, 0, 'no ownership check after an incomplete transaction');
});

test('restore syncs first and then checks owned / not-owned', async () => {
  const store = fakeStore();
  const api = createEntitlements(store.adapter);
  eq(await api.restore(), 'not-owned', 'unowned product is not restored');
  store.setOwned(true);
  eq(await api.restore(), 'restored', 'owned product is restored');
  eq(store.counts.syncs, 2, 'store sync called for each restore');
  eq(store.counts.checks, 2, 'ownership queried after each sync');
});

test('store query errors propagate rather than silently declaring no ownership', async () => {
  const failure = new Error('store unavailable');
  const api = createEntitlements({
    async hasFullVersion() { throw failure; },
    async buyFullVersion() { return 'completed'; },
    async syncPurchases() { throw failure; },
  });
  let failed = 0;
  for (const run of [() => api.isFull(), () => api.purchase(), () => api.restore()]) {
    try { await run(); } catch (e) { if (e === failure) failed++; }
  }
  eq(failed, 3, 'all store failures remain distinguishable from lack of ownership');
});
