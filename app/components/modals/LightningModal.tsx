'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@/app/hooks/useWallet';
import type { AccountData } from '@/app/api/account/types';

interface LightningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LightningModal({ isOpen, onClose }: LightningModalProps) {
  const { address, addressPublicKey } = useWallet();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newLnAddress, setNewLnAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch account data when modal opens
  const fetchAccountData = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/account/${address}`);

      if (!response.ok) {
        throw new Error('Failed to fetch account data');
      }

      const data: AccountData = await response.json();
      setAccountData(data);
      setNewLnAddress(data.ln_address || '');
    } catch (err) {
      console.error('Error fetching account data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isOpen && address) {
      fetchAccountData();
    }
  }, [isOpen, address, fetchAccountData]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        setIsEditing(false);
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
      const { request } = await import('@sats-connect/core');

      const signResponse = await request('signMessage', {
        address: address,
        message: newLnAddress
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update Lightning address');
      }

      const updatedData: AccountData = await response.json();
      setAccountData(updatedData);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating Lightning address:', err);
      setError(err instanceof Error ? err.message : 'Failed to update Lightning address');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNewLnAddress(accountData?.ln_address || '');
    setError(null);
  };

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
        ) : error && !accountData ? (
          <div className="text-sm text-red-500 bg-red-500/10 p-4 border border-red-500/20">
            {error}
          </div>
        ) : accountData ? (
          <div className="space-y-6">
            {/* Current Lightning Address */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Current Lightning Address</h3>
              {isEditing ? (
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
                <div className="flex items-center justify-between bg-secondary p-3 border border-border">
                  <span className="text-foreground break-all">
                    {accountData.ln_address || 'Not set'}
                  </span>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="ml-4 text-accent-3 hover:text-accent-3/80 transition-colors flex-shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Bitcoin Address */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Bitcoin Address</h3>
              <div className="bg-secondary p-3 border border-border">
                <span className="text-foreground/70 break-all font-mono text-sm">
                  {accountData.btc_address}
                </span>
              </div>
            </div>

            {/* Past Lightning Addresses */}
            {accountData.past_ln_addresses && accountData.past_ln_addresses.length > 0 && (
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

            {/* Last Updated */}
            {accountData.last_updated && (
              <div className="text-sm text-foreground/50">
                Last updated: {new Date(accountData.last_updated).toLocaleString()}
              </div>
            )}
          </div>
        ) : null}

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
