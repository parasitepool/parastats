import { address, networks } from 'bitcoinjs-lib';

export function isValidBitcoinAddress(value: string): boolean {
  if (!value) return false;

  try {
    const { version } = address.fromBase58Check(value);
    return version === networks.bitcoin.pubKeyHash || version === networks.bitcoin.scriptHash;
  } catch {}

  try {
    const { version, prefix, data } = address.fromBech32(value);
    if (prefix !== networks.bitcoin.bech32) return false;
    if (version === 0) return data.length === 20 || data.length === 32;
    if (version === 1) return data.length === 32;
    return false;
  } catch {}

  return false;
}
