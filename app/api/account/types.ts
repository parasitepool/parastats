import type { JsonValue as Json } from '@/app/types/json';

export interface AccountData {
  btc_address: string;
  ln_address: string | null;
  past_ln_addresses: string[];
  total_diff: bigint;
  metadata: Json | null;
  last_updated: string | null;
}

export interface AccountUpdate {
  btc_address: string,
  ln_address: string,
  signature: string,
}

// Lightning wallet types
export interface WalletInfo {
  email: string;
  id: string;
  lightning_ln_onchain: string;
  lightning_ln_url: string;
  username: string;
}

export interface BalanceResponse {
  balance: number;
}

// Combined response type for account endpoint
export interface CombinedAccountResponse {
  account: AccountData | null;
  lightning: {
    walletInfo: WalletInfo;
    balance: number;
  } | null;
  lightningTokenExpired?: boolean;
}
