import type { AccountData } from '@/app/api/account/types';

export function toAccountData(json: unknown): AccountData {
  const x = json as Record<string, unknown>;

  return {
    btc_address: String(x.btc_address ?? ""),
    ln_address: x.ln_address == null ? null : String(x.ln_address),
    past_ln_addresses: Array.isArray(x.past_ln_addresses)
      ? x.past_ln_addresses.map(String)
      : [],
    last_updated: x.last_updated == null ? null : String(x.last_updated),
  };
}
