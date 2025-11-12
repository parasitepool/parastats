// Shared types for Lightning-related components

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

