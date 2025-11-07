export interface AccountData {
  btc_address: string;
  ln_address: string | null;
  past_ln_addresses: string[];
  last_updated: string | null;
}

export interface AccountUpdate {
  btc_address: string,
  ln_address: string,
  signature: string,
}
