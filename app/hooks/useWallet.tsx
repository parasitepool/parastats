'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AddressPurpose, request } from '@sats-connect/core';

interface WalletContextType {
  address: string | null;
  addressPublicKey: string | null;
  isConnected: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const WALLET_ADDRESS_KEY = 'parasite_wallet_address';
const WALLET_ADDRESS_PUBLIC_KEY = 'parasite_wallet_address_public_key';

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

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [addressPublicKey, setAddressPublicKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const { address: savedAddress, publicKey: savedPublicKey } = walletStorage.load();
    
    if (savedAddress) {
      setAddress(savedAddress);
      setAddressPublicKey(savedPublicKey);
      setIsConnected(true);
    }
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

  const disconnect = useCallback(() => {
    walletStorage.clear();
    
    setAddress(null);
    setIsConnected(false);
  }, []);

  return (
    <WalletContext.Provider value={{ address, addressPublicKey, isConnected, connect, disconnect }}>
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
