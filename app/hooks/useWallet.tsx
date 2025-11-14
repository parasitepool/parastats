'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AddressPurpose, request } from '@sats-connect/core';

interface WalletContextType {
  address: string | null;
  addressPublicKey: string | null;
  isConnected: boolean;
  lightningToken: string | null;
  isLightningAuthenticated: boolean;
  isInitialized: boolean;
  connect: () => Promise<string | null>;
  connectWithLightning: () => Promise<{ address: string; token: string } | null>;
  disconnect: () => void;
  refreshLightningAuth: () => Promise<string | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_ADDRESS_KEY = 'parasite_wallet_address';
const WALLET_ADDRESS_PUBLIC_KEY = 'parasite_wallet_address_public_key';
const LIGHTNING_TOKEN_KEY = 'lightning_auth_token';
const LIGHTNING_TOKEN_TIMESTAMP_KEY = 'lightning_auth_timestamp';

const TOKEN_VALIDITY_HOURS = 24;

const walletStorage = {
  load: () => {
    const savedAddress = localStorage.getItem(WALLET_ADDRESS_KEY);
    const savedPublicKey = localStorage.getItem(WALLET_ADDRESS_PUBLIC_KEY);
    return { address: savedAddress, publicKey: savedPublicKey };
  },
  
  save: (address: string, publicKey: string) => {
    localStorage.setItem(WALLET_ADDRESS_KEY, address);
    localStorage.setItem(WALLET_ADDRESS_PUBLIC_KEY, publicKey);
  },
  
  clear: () => {
    localStorage.removeItem(WALLET_ADDRESS_KEY);
    localStorage.removeItem(WALLET_ADDRESS_PUBLIC_KEY);
  }
};

const lightningStorage = {
  load: (): { token: string; timestamp: number } | null => {
    const token = localStorage.getItem(LIGHTNING_TOKEN_KEY);
    const timestamp = localStorage.getItem(LIGHTNING_TOKEN_TIMESTAMP_KEY);
    
    if (!token || !timestamp) return null;
    
    const now = Date.now();
    const tokenAge = now - parseInt(timestamp);
    const validityMs = TOKEN_VALIDITY_HOURS * 60 * 60 * 1000;
    
    if (tokenAge < validityMs) {
      return { token, timestamp: parseInt(timestamp) };
    }
    
    lightningStorage.clear();
    return null;
  },
  
  save: (token: string) => {
    localStorage.setItem(LIGHTNING_TOKEN_KEY, token);
    localStorage.setItem(LIGHTNING_TOKEN_TIMESTAMP_KEY, Date.now().toString());
  },
  
  clear: () => {
    localStorage.removeItem(LIGHTNING_TOKEN_KEY);
    localStorage.removeItem(LIGHTNING_TOKEN_TIMESTAMP_KEY);
  }
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [addressPublicKey, setAddressPublicKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lightningToken, setLightningToken] = useState<string | null>(null);
  const [isLightningAuthenticated, setIsLightningAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const { address: savedAddress, publicKey: savedPublicKey } = walletStorage.load();
    
    if (savedAddress && savedPublicKey) {
      setAddress(savedAddress);
      setAddressPublicKey(savedPublicKey);
      setIsConnected(true);
    }

    const savedLightning = lightningStorage.load();
    if (savedLightning) {
      setLightningToken(savedLightning.token);
      setIsLightningAuthenticated(true);
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
    try {
      const response = await request('signMessage', {
        address: userAddress,
        message: message
      });

      if (response.status === 'success') {
        if (typeof response.result === 'string') {
          return response.result;
        } else if (response.result && typeof response.result === 'object' && 'signature' in response.result) {
          return response.result.signature;
        } else {
          throw new Error('Unexpected response format');
        }
      } else {
        throw new Error('User cancelled signing or signing failed');
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to sign message');
    }
  }, []);

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
    
    lightningStorage.save(token);
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
          walletStorage.save(paymentAddress.address, paymentAddress.publicKey);
          
          setAddress(paymentAddress.address);
          setAddressPublicKey(paymentAddress.publicKey);
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

      walletStorage.save(paymentAddress.address, paymentAddress.publicKey);
      setAddress(paymentAddress.address);
      setAddressPublicKey(paymentAddress.publicKey);
      setIsConnected(true);
      
      await addAddressToMonitoring(paymentAddress.address);

      const savedLightning = lightningStorage.load();
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
    lightningStorage.clear();
    
    setAddress(null);
    setAddressPublicKey(null);
    setIsConnected(false);
    setLightningToken(null);
    setIsLightningAuthenticated(false);
  }, []);

  return (
    <WalletContext.Provider value={{ 
      address, 
      addressPublicKey, 
      isConnected, 
      lightningToken,
      isLightningAuthenticated,
      isInitialized,
      connect, 
      connectWithLightning,
      disconnect,
      refreshLightningAuth
    }}>
      {children}
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
