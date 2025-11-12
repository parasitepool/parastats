'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@/app/hooks/useWallet';
import type { AccountData } from '@/app/api/account/types';

interface LightningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

interface WalletInfo {
  email: string;
  id: string;
  lightning_ln_onchain: string;
  lightning_ln_url: string;
  username: string;
}

interface BalanceResponse {
  balance: number;
}

const API_BASE_URL = "https://api.bitbit.bot";

export default function LightningModal({ isOpen, onClose, onUpdate }: LightningModalProps) {
  const { address, addressPublicKey, lightningToken, isLightningAuthenticated } = useWallet();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newLnAddress, setNewLnAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch bitbit.bot data
  const fetchBitbitData = useCallback(async (token: string) => {
    try {
      const [userResponse, balanceResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/wallet_user`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/wallet_user/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!userResponse.ok || !balanceResponse.ok) {
        return null;
      }

      const userData: WalletInfo = await userResponse.json();
      const balanceData: BalanceResponse = await balanceResponse.json();

      return {
        walletInfo: userData,
        balance: balanceData.balance,
      };
    } catch (err) {
      console.error('Error fetching bitbit data:', err);
      return null;
    }
  }, []);

  // Fetch account data when modal opens
  const fetchAccountData = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch from Next.js endpoint
      const accountResponse = await fetch(`/api/account/${address}`);
      let accountData: AccountData | null = null;
      
      if (accountResponse.ok) {
        accountData = await accountResponse.json();
        setAccountData(accountData);
        setNewLnAddress(accountData?.ln_address || '');
      } else {
        // Next.js endpoint returned nothing (404 or error)
        setAccountData(null);
      }

      // Fetch from bitbit.bot if authenticated
      if (isLightningAuthenticated && lightningToken) {
        const bitbitData = await fetchBitbitData(lightningToken);
        if (bitbitData) {
          setWalletInfo(bitbitData.walletInfo);
          setBalance(bitbitData.balance);
        }
      }
    } catch (err) {
      console.error('Error fetching account data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  }, [address, isLightningAuthenticated, lightningToken, fetchBitbitData]);

  useEffect(() => {
    if (isOpen && address) {
      fetchAccountData();
      // Start in edit mode if we have Next.js data
      setIsEditing(false);
    }
  }, [isOpen, address, fetchAccountData]);

  // Clean up state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setError(null);
      setWalletInfo(null);
      setBalance(null);
    }
  }, [isOpen]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscKey);
    }

    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  const handleSave = async () => {
    if (!address || !addressPublicKey || !newLnAddress) {
      setError('Missing required data');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Request signature for the Lightning address using BIP322
      // We'll use the wallet's signMessage functionality
      const { request, MessageSigningProtocols } = await import('@sats-connect/core');

      const signResponse = await request('signMessage', {
        address: address,
        message: newLnAddress,
        protocol: MessageSigningProtocols.BIP322
      });

      if (signResponse.status !== 'success') {
        throw new Error('Failed to sign message');
      }

      let signature: string;
      if (typeof signResponse.result === 'string') {
        signature = signResponse.result;
      } else if (signResponse.result && typeof signResponse.result === 'object' && 'signature' in signResponse.result) {
        signature = signResponse.result.signature;
      } else {
        throw new Error('Unexpected signature format');
      }

      // Send update request
      const response = await fetch('/api/account/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          btc_address: address,
          ln_address: newLnAddress,
          signature: signature,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update Lightning address';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }

      const updatedData: AccountData = await response.json();
      setAccountData(updatedData);
      setIsEditing(false);
      // Trigger refresh in parent component
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Error updating Lightning address:', err);
      setError(err instanceof Error ? err.message : 'Failed to update Lightning address');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to account data only
    setNewLnAddress(accountData?.ln_address || '');
    setError(null);
  };

  // Only show lightning address from Next.js endpoint, not from bitbit
  const displayLnAddress = accountData?.ln_address || '';
  const hasNextJsData = accountData !== null;
  const hasBitbitData = walletInfo !== null && balance !== null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background border border-foreground p-6 max-w-2xl w-full mx-4 shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-accent-3">Lightning Information</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-accent-3 border-t-transparent rounded-full"></div>
          </div>
        ) : error && !hasNextJsData && !hasBitbitData ? (
          <div className="text-sm text-red-500 bg-red-500/10 p-4 border border-red-500/20">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Lightning Address */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Lightning Address</h3>
              {isEditing && hasNextJsData ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newLnAddress}
                    onChange={(e) => setNewLnAddress(e.target.value)}
                    placeholder="Enter Lightning address (e.g., user@getalby.com)"
                    className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent-3"
                  />
                  {error && (
                    <div className="text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !newLnAddress}
                      className="bg-accent-3 text-white px-4 py-2 hover:bg-accent-3/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="bg-secondary text-secondary-foreground px-4 py-2 hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-secondary p-3 border border-border">
                    <span className="text-foreground break-all">
                      {displayLnAddress || 'Not set'}
                    </span>
                  </div>
                  {hasNextJsData && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="w-full bg-accent-3 text-white px-4 py-2 hover:bg-accent-3/90 transition-colors font-medium"
                    >
                      Edit Address
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Past Lightning Addresses - only show if we have Next.js data */}
            {hasNextJsData && accountData?.past_ln_addresses && accountData.past_ln_addresses.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Past Lightning Addresses</h3>
                <div className="space-y-2">
                  {accountData.past_ln_addresses.map((addr, index) => (
                    <div key={index} className="bg-secondary/50 p-3 border border-border">
                      <span className="text-foreground/70 break-all">{addr}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
