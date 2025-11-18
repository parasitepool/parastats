"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LightningIcon } from "@/app/components/icons";
import { useWallet } from "@/app/hooks/useWallet";
import LightningModal from "@/app/components/modals/LightningModal";
import WithdrawModal from "@/app/components/modals/WithdrawModal";
import type { AccountData, WalletInfo, CombinedAccountResponse } from "@/app/api/account/types";

interface LightningBalanceProps {
  className?: string;
  compact?: boolean;
  userId?: string;
  loading?: boolean;
}

export default function LightningBalance({
  className = "",
  compact = false,
  userId,
  loading = false,
}: LightningBalanceProps) {
  const router = useRouter();
  const {
    lightningToken,
    isLightningAuthenticated,
    isInitialized,
    address,
    addressPublicKey,
    connectWithLightning,
  } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  const fetchCombinedData = useCallback(async () => {
    if (!userId) return;

    setIsFetching(true);
    try {
      const headers: Record<string, string> = {};
      if (lightningToken) {
        headers['X-Lightning-Token'] = lightningToken;
      }

      const response = await fetch(`/api/account/${userId}`, {
        cache: 'no-store',
        headers,
      });

      if (response.ok) {
        const data: CombinedAccountResponse = await response.json();
        setAccountData(data.account);
        if (data.lightning) {
          setWalletInfo(data.lightning.walletInfo);
          setBalance(data.lightning.balance);
        } else {
          setWalletInfo(null);
          setBalance(null);
        }
      } else {
        setAccountData(null);
        setWalletInfo(null);
        setBalance(null);
      }
    } catch (err) {
      console.error("Error fetching combined data:", err);
      setError("Failed to load data");
      setAccountData(null);
      setWalletInfo(null);
      setBalance(null);
    } finally {
      setIsFetching(false);
    }
  }, [userId, lightningToken]);

  useEffect(() => {
    if (isInitialized) {
      fetchCombinedData();
    }
  }, [isInitialized, fetchCombinedData]);

  // Open reset confirmation modal
  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  // Reset to default lightning address
  const handleResetToDefault = async () => {
    if (!address || !addressPublicKey || !walletInfo?.username) {
      setError('Missing required data');
      setShowResetConfirm(false);
      return;
    }

    const usernameAddress = `${walletInfo.username}@sati.pro`;
    setIsResetting(true);
    setError(null);

    try {
      // Request signature for the Lightning address using BIP322
      const { request, MessageSigningProtocols } = await import('@sats-connect/core');

      const signResponse = await request('signMessage', {
        address: address,
        message: usernameAddress,
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
          ln_address: usernameAddress,
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
      setShowResetConfirm(false);

      // Re-fetch to ensure we have the latest data
      await fetchCombinedData();
    } catch (err) {
      console.error('Error resetting Lightning address:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset Lightning address');
    } finally {
      setIsResetting(false);
    }
  };

  // Show loading shimmer if not initialized, explicitly loading, or fetching data
  const isLoading = !isInitialized || loading || isFetching;

  if (isLoading && compact) {
    return (
      <div
        className={`bg-background p-4 shadow-md border border-border ${className}`}
      >
        <div className="flex items-center mb-2">
          <div className="mr-2 text-accent-3">
            <LightningIcon />
          </div>
          <h3 className="text-sm font-medium text-accent-2">Lightning</h3>
        </div>
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`bg-background p-4 sm:p-6 shadow-md border border-border ${className}`}>
        <div className="flex items-center mb-4 sm:mb-6">
          <div className="flex items-center">
            <div className="mr-2 text-accent-3">
              <LightningIcon />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">Lightning</h2>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {/* Lightning Address shimmer */}
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-accent-2 mb-2">Lightning Address</h3>
            <div className="bg-secondary p-3 sm:p-4 border border-border h-[5rem] flex items-center">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
            </div>
          </div>
          
          {/* Balance shimmer */}
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-accent-2 mb-2">Balance</h3>
            <div className="bg-secondary p-3 sm:p-4 border border-border h-[5rem] flex items-center">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if the connected wallet owns this account
  const isOwner = !userId || address === userId;

  const displayLnAddress = accountData?.ln_address || null;
  const hasData = isLightningAuthenticated && (balance !== null || walletInfo !== null || accountData !== null);

  // Check if username matches lightning address
  const usernameWithDomain = walletInfo?.username ? `${walletInfo.username}@sati.pro` : null;
  const addressesMatch = usernameWithDomain && displayLnAddress && usernameWithDomain === displayLnAddress;

  // If compact mode, show the old compact view
  if (compact) {
    return (
      <>
        <div
          className={`bg-background p-4 shadow-md border border-border ${className}`}
        >
          <div className="flex items-center mb-2">
            <div className="mr-2 text-accent-3">
              <LightningIcon />
            </div>
            <h3 className="text-sm font-medium text-accent-2">Lightning</h3>
          </div>
          {!isLightningAuthenticated ? (
            <p className="text-2xl font-semibold">
              <span className="text-gray-400">-</span>
            </p>
          ) : (
            <p className="text-2xl font-semibold">
              {balance !== null ? balance.toLocaleString() : "--"}
            </p>
          )}
        </div>
        <LightningModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  // Expanded full-width view
  return (
    <>
      <div className={`bg-background p-4 sm:p-6 shadow-md border border-border ${className}`}>
        <div className="flex items-center mb-4 sm:mb-6">
          <div className="flex items-center">
            <div className="mr-2 text-accent-3">
              <LightningIcon />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">Lightning</h2>
          </div>
        </div>

        {!isLightningAuthenticated ? (
          <div className="flex justify-center py-8">
            <button
              onClick={async () => {
                setIsConnecting(true);
                setError(null);
                try {
                  const result = await connectWithLightning();
                  if (result) {
                    router.push(`/user/${result.address}`);
                  } else {
                    setError('Failed to connect wallet');
                  }
                } catch (err) {
                  console.error('Connection error:', err);
                  setError(err instanceof Error ? err.message : 'Failed to connect wallet');
                } finally {
                  setIsConnecting(false);
                }
              }}
              disabled={isConnecting}
              className="px-6 py-3 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        ) : !hasData ? (
          <div className="text-center py-8">
            <p className="text-2xl font-semibold text-gray-400">-</p>
          </div>
        ) : addressesMatch ? (
          // If addresses match, show Lightning Address and Balance as separate boxes
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            {/* Lightning Address */}
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-accent-2 mb-2">Lightning Address</h3>
              <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex items-center justify-between gap-2 h-[5rem]">
                <p className="text-lg sm:text-xl font-semibold whitespace-nowrap overflow-x-auto flex-1 scrollbar-hide">{displayLnAddress}</p>
                {isOwner && isLightningAuthenticated && (
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs font-medium flex-shrink-0"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>

            {/* Balance - only show if available */}
            {balance !== null && (
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-accent-2 mb-2">Balance</h3>
                <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex items-center justify-between gap-2 h-[5rem]">
                  <p className="text-lg sm:text-xl font-semibold">
                    {balance.toLocaleString()} <span className="text-sm text-foreground/70">sats</span>
                  </p>
                  {isOwner && isLightningAuthenticated && (
                    <div className="relative group">
                      <button
                        onClick={() => balance >= 8500 && setIsWithdrawModalOpen(true)}
                        disabled={balance < 8500}
                        className={`flex items-center gap-1 px-2 py-1 text-xs font-medium flex-shrink-0 ${
                          balance >= 8500
                            ? 'bg-foreground text-background hover:bg-gray-700 transition-colors cursor-pointer'
                            : 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Withdraw</span>
                      </button>
                      {balance < 8500 && (
                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-48 p-2 bg-background border border-border shadow-lg text-xs z-10">
                          Minimum balance of 8,500 sats required to withdraw
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          // If addresses don't match or address not set, show lightning address with appropriate button
          <div className="space-y-4">
            {displayLnAddress && (
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-accent-2 mb-2">Lightning Address</h3>
                <div className="bg-secondary p-3 sm:p-4 border border-border flex items-center justify-between gap-2 h-[5rem]">
                  <p className="text-lg sm:text-xl font-semibold whitespace-nowrap overflow-x-auto flex-1 scrollbar-hide">{displayLnAddress}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {walletInfo?.username && isOwner && (
                      <button
                        onClick={handleResetClick}
                        className="flex items-center gap-1 px-2 py-2 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs font-medium"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Reset</span>
                      </button>
                    )}
                    {isOwner && isLightningAuthenticated && (
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-1 px-2 py-2 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs font-medium"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
            {error}
          </div>
        )}
      </div>

      <LightningModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={fetchCombinedData}
      />

      {/* Withdraw Modal */}
      {isWithdrawModalOpen && balance !== null && lightningToken && accountData?.btc_address && (
        <WithdrawModal
          isOpen={isWithdrawModalOpen}
          onClose={() => setIsWithdrawModalOpen(false)}
          onComplete={fetchCombinedData}
          balance={balance}
          btcAddress={accountData.btc_address}
          lightningToken={lightningToken}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background border border-foreground p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-accent-3">Reset Lightning Address</h2>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-accent-2 mb-2">Current Address</h3>
                <div className="bg-secondary p-3 border border-border">
                  <p className="text-foreground break-all">{displayLnAddress || 'Not set'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-accent-2 mb-2">New Address</h3>
                <div className="bg-secondary p-3 border border-border">
                  <p className="text-foreground break-all">{walletInfo?.username}@sati.pro</p>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                  {error}
                </div>
              )}

              <div className="flex gap-2 justify-center mt-6">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetToDefault}
                  disabled={isResetting}
                  className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResetting ? 'Resetting...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
