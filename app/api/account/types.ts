export type AccountMetadata = {
  block_count?: number;
  highest_blockheight?: number;
  [key: string]: unknown;
};

export interface AccountData {
  btc_address: string;
  ln_address: string | null;
  past_ln_addresses: string[];
  total_diff: number;
  metadata: AccountMetadata | null;
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
