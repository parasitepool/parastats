'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet, SignCancelledError } from '@/app/hooks/useWallet';
import type { AccountData, CombinedAccountResponse } from '@/app/api/account/types';

interface LightningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function LightningModal({ isOpen, onClose, onUpdate }: LightningModalProps) {
  const { address, isAccountGateOpen, isManualSignOpen, signMessage } = useWallet();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newLnAddress, setNewLnAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchAccountData = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/account/${address}`, {
        cache: 'no-store',
      });

      if (response.ok) {
        const data: CombinedAccountResponse = await response.json();
        setAccountData(data.account);
        setNewLnAddress(data.account?.ln_address || '');
      } else {
        setAccountData(null);
      }
    } catch (err) {
      console.error('Error fetching account data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load account data');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isOpen && address) {
      void fetchAccountData();
      setIsEditing(false);
    }
  }, [isOpen, address, fetchAccountData]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isAccountGateOpen && !isManualSignOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscKey);
    }

    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose, isAccountGateOpen, isManualSignOpen]);

  const handleSave = async () => {
    if (!address || !newLnAddress) {
      setError('Missing required data');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedData = await signMessage({
        address,
        message: newLnAddress,
        submit: async (signature: string) => {
          const response = await fetch('/api/account/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              btc_address: address,
              ln_address: newLnAddress,
              signature,
            }),
          });

          if (!response.ok) {
            let errorMessage = 'Failed to update Lightning address';
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
            } catch {
            }
            throw new Error(errorMessage);
          }

          return (await response.json()) as AccountData;
        },
      });

      setAccountData(updatedData);
      setNewLnAddress(updatedData.ln_address || '');
      setIsEditing(false);

      await fetchAccountData();

      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      if (err instanceof SignCancelledError) return;
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

  const displayLnAddress = accountData?.ln_address || '';
  const hasAccountData = accountData !== null;
  const canEdit = Boolean(address);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-background border border-foreground p-6 max-w-2xl w-full mx-4 shadow-xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end items-start mb-4">
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
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Current Lightning Address</h3>
              {isEditing && canEdit ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newLnAddress}
                    onChange={(e) => setNewLnAddress(e.target.value)}
                    placeholder="Enter Lightning address (e.g., user@getalby.com)"
                    className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent-3"
                    autoFocus
                  />
                  {error && (
                    <div className="text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving || !newLnAddress}
                      className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {canEdit ? (
                    <div
                      onClick={() => setIsEditing(true)}
                      className="flex items-center justify-between bg-secondary p-3 border border-border cursor-pointer hover:bg-secondary/80 transition-colors"
                    >
                      <span className="text-foreground break-all">
                        {displayLnAddress || 'Not set'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-secondary p-3 border border-border">
                      <span className="text-foreground break-all">
                        {displayLnAddress || 'Not set'}
                      </span>
                    </div>
                  )}
                  {error && (
                    <div className="text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {hasAccountData && accountData?.past_ln_addresses && accountData.past_ln_addresses.length > 0 && (
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold text-foreground mb-2">Past Lightning Addresses</h3>
                <div className="overflow-hidden" style={{ height: '156px' }}>
                  <style dangerouslySetInnerHTML={{ __html: `
                    .past-addresses-scroll::-webkit-scrollbar {
                      width: 6px;
                    }
                    .past-addresses-scroll::-webkit-scrollbar-track {
                      background: transparent;
                    }
                    .past-addresses-scroll::-webkit-scrollbar-thumb {
                      background: rgba(255, 255, 255, 0.15);
                      border-radius: 3px;
                    }
                    .past-addresses-scroll::-webkit-scrollbar-thumb:hover {
                      background: rgba(255, 255, 255, 0.25);
                    }
                  `}} />
                  <div
                    className="h-full overflow-y-auto past-addresses-scroll"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(255, 255, 255, 0.15) transparent',
                    }}
                  >
                    <div className="space-y-2">
                      {accountData.past_ln_addresses
                        .slice()
                        .reverse()
                        .map((addr, index) => (
                          <div key={accountData.past_ln_addresses.length - 1 - index} className="bg-secondary/50 p-3 border border-border min-h-[48px]">
                            <span className="text-foreground/70 break-all">{addr}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
