import { isValidBitcoinAddress, normalizeBitcoinAddress } from './validators';

export type WalletType = 'xverse' | 'manual';

export type SavedWallet =
  | {
      address: string;
      type: 'xverse';
      publicKey: string;
      lastUsedAt: number;
    }
  | {
      address: string;
      type: 'manual';
      lastUsedAt: number;
    };

export interface WalletStoreState {
  activeAddress: string | null;
  wallets: SavedWallet[];
}

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const WALLETS_STORAGE_KEY = 'parasite_wallets_v1';

const LEGACY_KEYS = [
  'parasite_wallet_address',
  'parasite_wallet_address_public_key',
  'parasite_wallet_type',
  'lightning_auth_token',
  'lightning_auth_timestamp',
];

const LEGACY_PREFIXES = ['lightning_auth_token_', 'lightning_auth_timestamp_'];

export const EMPTY_WALLET_STORE: WalletStoreState = {
  activeAddress: null,
  wallets: [],
};

function sanitizeWallet(entry: unknown): SavedWallet | null {
  if (!entry || typeof entry !== 'object') return null;

  const record = entry as Record<string, unknown>;
  if (typeof record.address !== 'string') return null;

  const address = normalizeBitcoinAddress(record.address);
  if (!isValidBitcoinAddress(address)) return null;

  const lastUsedAt =
    typeof record.lastUsedAt === 'number' && Number.isFinite(record.lastUsedAt)
      ? record.lastUsedAt
      : 0;

  if (record.type === 'xverse') {
    if (typeof record.publicKey !== 'string' || record.publicKey.length === 0) {
      return null;
    }
    return {
      address,
      type: 'xverse',
      publicKey: record.publicKey,
      lastUsedAt,
    };
  }

  if (record.type === 'manual') {
    return {
      address,
      type: 'manual',
      lastUsedAt,
    };
  }

  return null;
}

function sortWallets(wallets: SavedWallet[]): SavedWallet[] {
  return [...wallets].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export function parseWalletStore(raw: string | null): WalletStoreState {
  if (!raw) return EMPTY_WALLET_STORE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY_WALLET_STORE;

    const record = parsed as Record<string, unknown>;
    const rawWallets = Array.isArray(record.wallets) ? record.wallets : [];

    const byAddress = new Map<string, SavedWallet>();
    for (const item of rawWallets) {
      const wallet = sanitizeWallet(item);
      if (!wallet) continue;
      const existing = byAddress.get(wallet.address);
      if (!existing || wallet.lastUsedAt >= existing.lastUsedAt) {
        byAddress.set(wallet.address, wallet);
      }
    }

    const wallets = sortWallets(Array.from(byAddress.values()));
    const rawActive =
      typeof record.activeAddress === 'string'
        ? normalizeBitcoinAddress(record.activeAddress)
        : null;
    const activeAddress =
      rawActive && byAddress.has(rawActive) ? rawActive : null;

    return { activeAddress, wallets };
  } catch {
    return EMPTY_WALLET_STORE;
  }
}

export function getActiveWallet(state: WalletStoreState): SavedWallet | null {
  if (!state.activeAddress) return null;
  return state.wallets.find((wallet) => wallet.address === state.activeAddress) ?? null;
}

export function upsertWallet(
  state: WalletStoreState,
  incoming: SavedWallet,
): WalletStoreState {
  const address = normalizeBitcoinAddress(incoming.address);
  const normalized: SavedWallet =
    incoming.type === 'xverse'
      ? {
          address,
          type: 'xverse',
          publicKey: incoming.publicKey,
          lastUsedAt: incoming.lastUsedAt,
        }
      : {
          address,
          type: 'manual',
          lastUsedAt: incoming.lastUsedAt,
        };

  const remaining = state.wallets.filter((wallet) => wallet.address !== address);
  return {
    activeAddress: address,
    wallets: sortWallets([normalized, ...remaining]),
  };
}

export function selectWallet(
  state: WalletStoreState,
  address: string,
  now: number = Date.now(),
): WalletStoreState {
  const normalized = normalizeBitcoinAddress(address);
  const target = state.wallets.find((wallet) => wallet.address === normalized);
  if (!target) return state;

  const updated: SavedWallet = { ...target, lastUsedAt: now };
  const remaining = state.wallets.filter((wallet) => wallet.address !== normalized);

  return {
    activeAddress: normalized,
    wallets: sortWallets([updated, ...remaining]),
  };
}

export function removeWallet(
  state: WalletStoreState,
  address: string,
): { next: WalletStoreState; removed: SavedWallet | null } {
  const normalized = normalizeBitcoinAddress(address);
  const removed = state.wallets.find((wallet) => wallet.address === normalized) ?? null;
  if (!removed) {
    return { next: state, removed: null };
  }

  const wallets = state.wallets.filter((wallet) => wallet.address !== normalized);
  const activeAddress = state.activeAddress === normalized ? null : state.activeAddress;

  return {
    next: { activeAddress, wallets },
    removed,
  };
}

export function disconnectActiveWallet(
  state: WalletStoreState,
): { next: WalletStoreState; removed: SavedWallet | null } {
  if (!state.activeAddress) {
    return { next: state, removed: null };
  }
  return removeWallet(state, state.activeAddress);
}

export function clearLegacyWalletStorage(storage: StorageLike): void {
  for (const key of LEGACY_KEYS) {
    storage.removeItem(key);
  }

  const prefixedKeys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      prefixedKeys.push(key);
    }
  }

  for (const key of prefixedKeys) {
    storage.removeItem(key);
  }
}

export function loadWalletStore(storage: StorageLike): WalletStoreState {
  clearLegacyWalletStorage(storage);
  return parseWalletStore(storage.getItem(WALLETS_STORAGE_KEY));
}

export function saveWalletStore(storage: StorageLike, state: WalletStoreState): void {
  if (state.wallets.length === 0 && state.activeAddress === null) {
    storage.removeItem(WALLETS_STORAGE_KEY);
    return;
  }
  storage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(state));
}
