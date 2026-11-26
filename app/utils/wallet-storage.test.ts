import assert from 'node:assert/strict';
import test from 'node:test';
import {
  disconnectActiveWallet,
  EMPTY_WALLET_STORE,
  getActiveWallet,
  loadWalletStore,
  parseWalletStore,
  removeWallet,
  saveWalletStore,
  selectWallet,
  upsertWallet,
  WALLETS_STORAGE_KEY,
  type StorageLike,
} from './wallet-storage';

const ADDR_A = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const ADDR_B = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
const ADDR_C = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

test('upsertWallet adds, normalizes, and upgrades manual wallet to xverse', () => {
  const s1 = upsertWallet(EMPTY_WALLET_STORE, {
    address: ADDR_A.toUpperCase(),
    type: 'manual',
    lastUsedAt: 100,
  });

  assert.equal(s1.activeAddress, ADDR_A);
  assert.equal(s1.wallets.length, 1);
  assert.equal(getActiveWallet(s1)?.type, 'manual');

  const s2 = upsertWallet(s1, {
    address: ADDR_A,
    type: 'xverse',
    publicKey: 'pub_a',
    lastUsedAt: 200,
  });

  assert.equal(s2.activeAddress, ADDR_A);
  assert.equal(s2.wallets.length, 1);
  assert.deepEqual(getActiveWallet(s2), {
    address: ADDR_A,
    type: 'xverse',
    publicKey: 'pub_a',
    lastUsedAt: 200,
  });
});

test('selectWallet switches active wallet and orders most recently used first', () => {
  let state = upsertWallet(EMPTY_WALLET_STORE, {
    address: ADDR_A,
    type: 'xverse',
    publicKey: 'pub_a',
    lastUsedAt: 100,
  });
  state = upsertWallet(state, {
    address: ADDR_B,
    type: 'manual',
    lastUsedAt: 200,
  });

  assert.equal(state.activeAddress, ADDR_B);
  assert.deepEqual(state.wallets.map((w) => w.address), [ADDR_B, ADDR_A]);

  const switched = selectWallet(state, ADDR_A.toUpperCase(), 300);
  assert.equal(switched.activeAddress, ADDR_A);
  assert.deepEqual(switched.wallets.map((w) => w.address), [ADDR_A, ADDR_B]);
});

test('disconnectActiveWallet wipes only the active wallet and preserves others', () => {
  let state = upsertWallet(EMPTY_WALLET_STORE, {
    address: ADDR_A,
    type: 'xverse',
    publicKey: 'pub_a',
    lastUsedAt: 100,
  });
  state = upsertWallet(state, {
    address: ADDR_B,
    type: 'manual',
    lastUsedAt: 200,
  });
  state = upsertWallet(state, {
    address: ADDR_C,
    type: 'xverse',
    publicKey: 'pub_c',
    lastUsedAt: 300,
  });

  const { next, removed } = disconnectActiveWallet(state);

  assert.equal(removed?.address, ADDR_C);
  assert.equal(next.activeAddress, null);
  assert.deepEqual(next.wallets.map((w) => w.address), [ADDR_B, ADDR_A]);
});

test('removeWallet removes non-active and active wallets appropriately', () => {
  let state = upsertWallet(EMPTY_WALLET_STORE, {
    address: ADDR_A,
    type: 'xverse',
    publicKey: 'pub_a',
    lastUsedAt: 100,
  });
  state = upsertWallet(state, {
    address: ADDR_B,
    type: 'manual',
    lastUsedAt: 200,
  });

  const nonActive = removeWallet(state, ADDR_A);
  assert.equal(nonActive.removed?.address, ADDR_A);
  assert.equal(nonActive.next.activeAddress, ADDR_B);
  assert.deepEqual(nonActive.next.wallets.map((w) => w.address), [ADDR_B]);

  const active = removeWallet(state, ADDR_B);
  assert.equal(active.removed?.address, ADDR_B);
  assert.equal(active.next.activeAddress, null);
  assert.deepEqual(active.next.wallets.map((w) => w.address), [ADDR_A]);
});

test('loadWalletStore scrubs legacy keys and parses valid v1 data', () => {
  const storage = createMemoryStorage({
    parasite_wallet_address: ADDR_A,
    parasite_wallet_address_public_key: 'pub_old',
    parasite_wallet_type: 'xverse',
    lightning_auth_token: 'legacy_tok',
    lightning_auth_timestamp: '12345',
    [`lightning_auth_token_${ADDR_A}`]: 'legacy_scoped_tok',
    [`lightning_auth_timestamp_${ADDR_A}`]: '12345',
    unrelated_key: 'keep_me',
  });

  const loaded = loadWalletStore(storage);
  assert.deepEqual(loaded, EMPTY_WALLET_STORE);
  assert.equal(storage.getItem('parasite_wallet_address'), null);
  assert.equal(storage.getItem('parasite_wallet_type'), null);
  assert.equal(storage.getItem(`lightning_auth_token_${ADDR_A}`), null);
  assert.equal(storage.getItem('unrelated_key'), 'keep_me');

  const saved = upsertWallet(EMPTY_WALLET_STORE, {
    address: ADDR_B,
    type: 'manual',
    lastUsedAt: 500,
  });
  saveWalletStore(storage, saved);
  assert.deepEqual(loadWalletStore(storage), saved);

  const cleared = disconnectActiveWallet(saved).next;
  saveWalletStore(storage, cleared);
  assert.equal(storage.getItem(WALLETS_STORAGE_KEY), null);
});

test('parseWalletStore ignores malformed entries, dangling activeAddress, and keeps newest duplicate', () => {
  const parsed = parseWalletStore(
    JSON.stringify({
      activeAddress: ADDR_C,
      wallets: [
        { address: 'invalid', type: 'manual', lastUsedAt: 1 },
        { address: ADDR_A, type: 'xverse', publicKey: '', lastUsedAt: 2 },
        { address: ADDR_B, type: 'manual', lastUsedAt: 3 },
        { address: ADDR_B, type: 'xverse', publicKey: 'pub_b', lastUsedAt: 5 },
      ],
    }),
  );

  assert.equal(parsed.activeAddress, null);
  assert.deepEqual(parsed.wallets, [
    { address: ADDR_B, type: 'xverse', publicKey: 'pub_b', lastUsedAt: 5 },
  ]);
});
