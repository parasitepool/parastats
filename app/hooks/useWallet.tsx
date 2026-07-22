'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AddressPurpose, MessageSigningProtocols, RpcErrorCode, request } from '@sats-connect/core';
import { isValidBitcoinAddress, normalizeBitcoinAddress } from '@/app/utils/validators';
import ManualSignModal, { ManualSignRequest } from '@/app/components/modals/ManualSignModal';

export type WalletType = 'xverse' | 'manual';

interface SignMessageParams {
  message: string;
  protocol?: MessageSigningProtocols;
  address?: string;
}

// Without `submit`, resolves with the signature. With `submit`, the callback
// consumes the signature (e.g. POSTs it to the backend) and its result is
// returned; for manual wallets it runs while the signing modal is still open,
// so failures (like an invalid signature) are shown there and can be retried.
interface SignMessage {
  (params: SignMessageParams): Promise<string>;
  <T>(params: SignMessageParams & { submit: (signature: string) => Promise<T> }): Promise<T>;
}

interface PendingSign extends ManualSignRequest {
  submit?: (signature: string) => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

interface WalletContextType {
  address: string | null;
  addressPublicKey: string | null;
  walletType: WalletType | null;
  isConnected: boolean;
  lightningToken: string | null;
  isLightningAuthenticated: boolean;
  isInitialized: boolean;
  connect: () => Promise<string | null>;
  connectWithLightning: () => Promise<{ address: string; token: string } | null>;
  connectManual: (manualAddress: string) => Promise<string | null>;
  signMessage: SignMessage;
  disconnect: () => void;
  refreshLightningAuth: () => Promise<string | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_ADDRESS_KEY = 'parasite_wallet_address';
const WALLET_ADDRESS_PUBLIC_KEY = 'parasite_wallet_address_public_key';
const WALLET_TYPE_KEY = 'parasite_wallet_type';
const LIGHTNING_TOKEN_KEY = 'lightning_auth_token';
const LIGHTNING_TOKEN_TIMESTAMP_KEY = 'lightning_auth_timestamp';

const TOKEN_VALIDITY_HOURS = 24;

// Thrown when the user explicitly dismisses the manual signing modal, so
// callers can stay quiet on cancellation without swallowing real failures.
export class SignCancelledError extends Error {
  constructor() {
    super('User cancelled signing');
    this.name = 'SignCancelledError';
  }
}

// Parse the signature out of a sats-connect signMessage response, which may be
// either a raw string or an object with a `signature` field depending on version.
function parseSignatureResult(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }
  if (result && typeof result === 'object' && 'signature' in result) {
    return (result as { signature: string }).signature;
  }
  throw new Error('Unexpected signature format');
}

const walletStorage = {
  load: () => {
    const savedAddress = localStorage.getItem(WALLET_ADDRESS_KEY);
    const savedPublicKey = localStorage.getItem(WALLET_ADDRESS_PUBLIC_KEY);
    // Wallets saved before manual support have no type; treat them as Xverse.
    const savedType = (localStorage.getItem(WALLET_TYPE_KEY) as WalletType | null) ?? 'xverse';
    return { address: savedAddress, publicKey: savedPublicKey, type: savedType };
  },

  save: (address: string, publicKey: string, type: WalletType) => {
    localStorage.setItem(WALLET_ADDRESS_KEY, address);
    localStorage.setItem(WALLET_ADDRESS_PUBLIC_KEY, publicKey);
    localStorage.setItem(WALLET_TYPE_KEY, type);
  },

  clear: () => {
    localStorage.removeItem(WALLET_ADDRESS_KEY);
    localStorage.removeItem(WALLET_ADDRESS_PUBLIC_KEY);
    localStorage.removeItem(WALLET_TYPE_KEY);
  }
};

const lightningStorage = {
  load: (address: string): { token: string; timestamp: number } | null => {
    const token = localStorage.getItem(`${LIGHTNING_TOKEN_KEY}_${address}`);
    const timestamp = localStorage.getItem(`${LIGHTNING_TOKEN_TIMESTAMP_KEY}_${address}`);

    if (!token || !timestamp) return null;

    const now = Date.now();
    const tokenAge = now - parseInt(timestamp);
    const validityMs = TOKEN_VALIDITY_HOURS * 60 * 60 * 1000;

    if (tokenAge < validityMs) {
      return { token, timestamp: parseInt(timestamp) };
    }

    lightningStorage.clear(address);
    return null;
  },

  save: (token: string, address: string) => {
    localStorage.setItem(`${LIGHTNING_TOKEN_KEY}_${address}`, token);
    localStorage.setItem(`${LIGHTNING_TOKEN_TIMESTAMP_KEY}_${address}`, Date.now().toString());
  },

  clear: (address?: string) => {
    if (address) {
      localStorage.removeItem(`${LIGHTNING_TOKEN_KEY}_${address}`);
      localStorage.removeItem(`${LIGHTNING_TOKEN_TIMESTAMP_KEY}_${address}`);
    }
    // Clean up legacy un-scoped keys
    localStorage.removeItem(LIGHTNING_TOKEN_KEY);
    localStorage.removeItem(LIGHTNING_TOKEN_TIMESTAMP_KEY);
  }
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [addressPublicKey, setAddressPublicKey] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lightningToken, setLightningToken] = useState<string | null>(null);
  const [isLightningAuthenticated, setIsLightningAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [pendingSign, setPendingSign] = useState<PendingSign | null>(null);

  useEffect(() => {
    const { address: savedAddress, publicKey: savedPublicKey, type: savedType } = walletStorage.load();

    if (savedType === 'manual' && savedAddress) {
      // Manual wallets only persist the address (no public key, no Lightning).
      setAddress(savedAddress);
      setWalletType('manual');
      setIsConnected(true);
    } else if (savedAddress && savedPublicKey) {
      setAddress(savedAddress);
      setAddressPublicKey(savedPublicKey);
      setWalletType('xverse');
      setIsConnected(true);

      const savedLightning = lightningStorage.load(savedAddress);
      if (savedLightning) {
        setLightningToken(savedLightning.token);
        setIsLightningAuthenticated(true);
      }
    }

    setIsInitialized(true);
  }, []);

  const addAddressToMonitoring = useCallback(async (addr: string) => {
    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address: addr })
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 429) {
          console.error('Too many addresses added recently');
        } else {
          console.error('Error adding address to monitoring:', data.error);
        }
      }
    } catch (error) {
      console.error('Error adding address to monitoring:', error);
    }
  }, []);

  // Single signing primitive used by every BIP322/ECDSA interaction. Xverse
  // wallets sign through sats-connect; manual wallets surface the message in a
  // modal and resolve once the user pastes a signature from their own wallet.
  const signMessage = useCallback(async ({
    message,
    protocol = MessageSigningProtocols.BIP322,
    address: signingAddress,
    submit,
  }: SignMessageParams & { submit?: (signature: string) => Promise<unknown> }): Promise<unknown> => {
    const signer = signingAddress ?? address;

    if (walletType === 'manual') {
      if (protocol !== MessageSigningProtocols.BIP322) {
        throw new Error('Manual wallets only support BIP322 signing');
      }
      return new Promise<unknown>((resolve, reject) => {
        setPendingSign(prev => {
          // A new request supersedes any pending one; settle the old promise
          // so its caller doesn't hang forever.
          prev?.reject(new SignCancelledError());
          return { message, address: signer ?? null, submit, resolve, reject };
        });
      });
    }

    const response = await request('signMessage', {
      address: signer ?? '',
      message,
      protocol,
    });

    if (response.status !== 'success') {
      if (response.error?.code === RpcErrorCode.USER_REJECTION) {
        throw new SignCancelledError();
      }
      throw new Error(response.error?.message || 'Failed to sign message');
    }

    const signature = parseSignatureResult(response.result);

    if (submit) {
      return await submit(signature);
    }

    return signature;
  }, [walletType, address]) as SignMessage;

  const requestNonce = useCallback(async (userAddress: string): Promise<string> => {
    const response = await fetch('/api/lightning/auth/nonce', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address: userAddress })
    });

    if (!response.ok) {
      throw new Error(`Failed to request nonce: ${response.statusText}`);
    }

    const data = await response.json();
    return data.nonce;
  }, []);

  const signNonce = useCallback(async (userAddress: string, message: string): Promise<string> => {
    // Lightning auth is Xverse-only (manual wallets skip it), so this always
    // routes through the Xverse branch of signMessage.
    return signMessage({ address: userAddress, message, protocol: MessageSigningProtocols.ECDSA });
  }, [signMessage]);

  const loginWithSignature = useCallback(async (
    userAddress: string,
    publicKey: string,
    signature: string,
    nonce: string
  ): Promise<string> => {
    const response = await fetch('/api/lightning/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address: userAddress,
        public_key: publicKey,
        signature,
        nonce
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed: ${errorText}`);
    }

    const data = await response.json();
    return data.token;
  }, []);

  const performLightningAuth = useCallback(async (
    userAddress: string,
    publicKey: string
  ): Promise<string> => {
    const nonce = await requestNonce(userAddress);
    
    const signature = await signNonce(userAddress, nonce);
    
    const token = await loginWithSignature(userAddress, publicKey, signature, nonce);
    
    lightningStorage.save(token, userAddress);
    setLightningToken(token);
    setIsLightningAuthenticated(true);

    return token;
  }, [requestNonce, signNonce, loginWithSignature]);

  const connect = useCallback(async (): Promise<string | null> => {
    try {
      const response = await request('getAccounts', {
        purposes: [AddressPurpose.Payment],
        message: 'Connect your wallet to Parasite'
      });

      if (response.status === 'success') {
        const paymentAddress = response.result.find(
          (addr) => addr.purpose === AddressPurpose.Payment
        );

        if (paymentAddress) {
          walletStorage.save(paymentAddress.address, paymentAddress.publicKey, 'xverse');

          setAddress(paymentAddress.address);
          setAddressPublicKey(paymentAddress.publicKey);
          setWalletType('xverse');
          setIsConnected(true);

          await addAddressToMonitoring(paymentAddress.address);

          return paymentAddress.address;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      return null;
    }
  }, [addAddressToMonitoring]);

  const connectWithLightning = useCallback(async (): Promise<{ address: string; token: string } | null> => {
    try {
      const response = await request('getAccounts', {
        purposes: [AddressPurpose.Payment],
        message: 'Connect your wallet to Parasite'
      });

      if (response.status !== 'success') {
        return null;
      }

      const paymentAddress = response.result.find(
        (addr) => addr.purpose === AddressPurpose.Payment
      );

      if (!paymentAddress) {
        return null;
      }

      walletStorage.save(paymentAddress.address, paymentAddress.publicKey, 'xverse');
      setAddress(paymentAddress.address);
      setAddressPublicKey(paymentAddress.publicKey);
      setWalletType('xverse');
      setIsConnected(true);

      await addAddressToMonitoring(paymentAddress.address);

      const savedLightning = lightningStorage.load(paymentAddress.address);
      if (savedLightning) {
        setLightningToken(savedLightning.token);
        setIsLightningAuthenticated(true);
        return { address: paymentAddress.address, token: savedLightning.token };
      }

      const token = await performLightningAuth(paymentAddress.address, paymentAddress.publicKey);
      
      return { address: paymentAddress.address, token };
    } catch (error: unknown) {
      // Check if error indicates wallet provider is not found
      const errorMessage = (error instanceof Error ? error.message : String(error)) || '';
      const errorString = errorMessage.toLowerCase();
      
      if (
        errorString.includes('no wallet provider') ||
        errorString.includes('no provider') ||
        errorString.includes('provider not found') ||
        errorString.includes('wallet provider was found') ||
        errorString.includes('extension') ||
        errorString.includes('not installed')
      ) {
        // Re-throw provider not found errors so they can be handled by the caller
        throw error;
      }
      
      // For other errors, log and return null
      console.error('Failed to connect with Lightning:', error);
      return null;
    }
  }, [addAddressToMonitoring, performLightningAuth]);

  const connectManual = useCallback(async (manualAddress: string): Promise<string | null> => {
    const trimmedAddress = normalizeBitcoinAddress(manualAddress);

    if (!isValidBitcoinAddress(trimmedAddress)) {
      return null;
    }

    // Manual wallets have no public key and no Lightning auth; we only store the
    // self-supplied address and prove ownership per-action via pasted signatures.
    walletStorage.save(trimmedAddress, '', 'manual');
    setAddress(trimmedAddress);
    setAddressPublicKey(null);
    setWalletType('manual');
    setIsConnected(true);

    await addAddressToMonitoring(trimmedAddress);

    return trimmedAddress;
  }, [addAddressToMonitoring]);

  const refreshLightningAuth = useCallback(async (): Promise<string | null> => {
    if (!address || !addressPublicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const token = await performLightningAuth(address, addressPublicKey);
      return token;
    } catch (error) {
      console.error('Failed to refresh Lightning auth:', error);
      return null;
    }
  }, [address, addressPublicKey, performLightningAuth]);

  const disconnect = useCallback(() => {
    walletStorage.clear();
    lightningStorage.clear(address || undefined);

    setAddress(null);
    setAddressPublicKey(null);
    setWalletType(null);
    setIsConnected(false);
    setLightningToken(null);
    setIsLightningAuthenticated(false);
  }, [address]);

  return (
    <WalletContext.Provider value={{
      address,
      addressPublicKey,
      walletType,
      isConnected,
      lightningToken,
      isLightningAuthenticated,
      isInitialized,
      connect,
      connectWithLightning,
      connectManual,
      signMessage,
      disconnect,
      refreshLightningAuth
    }}>
      {children}
      <ManualSignModal
        request={pendingSign}
        onSubmit={async (signature) => {
          if (!pendingSign) return;
          const result = pendingSign.submit ? await pendingSign.submit(signature) : signature;
          pendingSign.resolve(result);
          setPendingSign(null);
        }}
        onCancel={() => {
          pendingSign?.reject(new SignCancelledError());
          setPendingSign(null);
        }}
      />
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
