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

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [addressPublicKey, setAddressPublicKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Restore wallet connection from localStorage on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem(WALLET_ADDRESS_KEY);
    const savePublicKey = localStorage.getItem(WALLET_ADDRESS_PUBLIC_KEY);
    if (savedAddress) {
      setAddress(savedAddress);
      setAddressPublicKey(savePublicKey);
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
          setAddress(paymentAddress.address);
          setAddressPublicKey(paymentAddress.publicKey);
          setIsConnected(true);
          // Save to localStorage for persistence
          localStorage.setItem(WALLET_ADDRESS_KEY, paymentAddress.address);
          localStorage.setItem(WALLET_ADDRESS_PUBLIC_KEY, paymentAddress.publicKey);
          // Add address to monitoring when connecting
          await addAddressToMonitoring(paymentAddress.address);
          // Return address for further use if needed
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
    setAddress(null);
    setIsConnected(false);
    // Clear localStorage on disconnect
    localStorage.removeItem(WALLET_ADDRESS_KEY);
    localStorage.removeItem(WALLET_ADDRESS_PUBLIC_KEY);
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
