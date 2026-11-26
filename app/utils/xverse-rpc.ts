import {
  AddressPurpose,
  MessageSigningProtocols,
  RpcErrorCode,
  isProviderInstalled,
  request,
} from '@sats-connect/core';
import { formatAddress } from '@/app/utils/formatters';
import { isValidBitcoinAddress, normalizeBitcoinAddress } from '@/app/utils/validators';
import { isWalletProviderError, XVERSE_PROVIDER_ID } from '@/app/utils/xverse';

export interface XversePaymentAccount {
  address: string;
  publicKey: string;
}

export class SignCancelledError extends Error {
  constructor() {
    super('User cancelled signing');
    this.name = 'SignCancelledError';
  }
}

export class XverseAccountMismatchError extends Error {
  readonly expectedAddress: string;
  readonly actualAddress: string | null;

  constructor(expectedAddress: string, actualAddress: string | null) {
    const detail = actualAddress
      ? `XVERSE is currently set to ${formatAddress(actualAddress)}. Switch to ${formatAddress(expectedAddress)} in XVERSE to continue.`
      : `Switch to ${formatAddress(expectedAddress)} in XVERSE to continue.`;
    super(detail);
    this.name = 'XverseAccountMismatchError';
    this.expectedAddress = expectedAddress;
    this.actualAddress = actualAddress;
  }
}

function parseSignatureResult(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }
  if (result && typeof result === 'object' && 'signature' in result) {
    return (result as { signature: string }).signature;
  }
  throw new Error('Unexpected signature format');
}

export function extractPaymentAddress(addresses: unknown): XversePaymentAccount | null {
  if (!Array.isArray(addresses)) return null;
  for (const item of addresses) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (
      record.purpose === AddressPurpose.Payment &&
      typeof record.address === 'string' &&
      typeof record.publicKey === 'string'
    ) {
      const normalized = normalizeBitcoinAddress(record.address);
      if (isValidBitcoinAddress(normalized)) {
        return { address: normalized, publicKey: record.publicKey };
      }
    }
  }
  return null;
}

export async function queryXverseActiveAccount(): Promise<XversePaymentAccount | null> {
  if (!isProviderInstalled(XVERSE_PROVIDER_ID)) return null;
  try {
    const response = await request('wallet_getAccount', null);
    if (response.status !== 'success') return null;
    return extractPaymentAddress(response.result.addresses);
  } catch {
    return null;
  }
}

export async function requestXversePaymentAccount(
  forcePrompt = false,
): Promise<XversePaymentAccount | null> {
  if (forcePrompt) {
    try {
      await request('wallet_disconnect', null);
    } catch {
    }
  }

  try {
    const connectResponse = await request('wallet_connect', {
      addresses: [AddressPurpose.Payment],
      message: 'Connect your wallet to Parasite',
    });

    if (connectResponse.status === 'success') {
      return extractPaymentAddress(connectResponse.result.addresses);
    }

    if (connectResponse.error?.code === RpcErrorCode.USER_REJECTION) {
      return null;
    }
  } catch (error) {
    if (isWalletProviderError(error)) {
      throw error;
    }
  }

  const fallbackResponse = await request('getAccounts', {
    purposes: [AddressPurpose.Payment],
    message: 'Connect your wallet to Parasite',
  });

  if (fallbackResponse.status !== 'success') {
    return null;
  }

  return extractPaymentAddress(fallbackResponse.result);
}

export async function signWithXverse(
  address: string,
  message: string,
  protocol: MessageSigningProtocols,
): Promise<string> {
  const response = await request('signMessage', {
    address,
    message,
    protocol,
  });

  if (response.status !== 'success') {
    if (response.error?.code === RpcErrorCode.USER_REJECTION) {
      throw new SignCancelledError();
    }
    throw new Error(response.error?.message || 'Failed to sign message');
  }

  return parseSignatureResult(response.result);
}
