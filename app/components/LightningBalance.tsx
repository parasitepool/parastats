"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LightningIcon } from "@/app/components/icons";
import { useWallet } from "@/app/hooks/useWallet";
import LightningModal from "@/app/components/modals/LightningModal";
import type { AccountData } from "@/app/api/account/types";
import type { WalletInfo, BalanceResponse } from "@/app/components/types/lightning";

interface LightningBalanceProps {
  className?: string;
  compact?: boolean;
  userId?: string;
}

const API_BASE_URL = "https://api.bitbit.bot";

export default function LightningBalance({
  className = "",
  compact = false,
  userId,
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
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const fetchUserData = useCallback(async (token: string) => {
    const [userResponse, balanceResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/wallet_user`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_BASE_URL}/wallet_user/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (!userResponse.ok) {
      throw new Error("Failed to fetch user info");
    }

    if (!balanceResponse.ok) {
      throw new Error("Failed to fetch balance");
    }

    const userData: WalletInfo = await userResponse.json();
    const balanceData: BalanceResponse = await balanceResponse.json();

    setWalletInfo(userData);
    setBalance(balanceData.balance);
  }, []);

  const fetchAccountData = useCallback(async () => {
    if (!userId) return;

    try {
      // Add cache-busting to ensure fresh data
      const response = await fetch(`/api/account/${userId}`, {
        cache: 'no-store',
      });
      if (response.ok) {
        const data: AccountData = await response.json();
        setAccountData(data);
      } else {
        setAccountData(null);
      }
    } catch (err) {
      console.error("Error fetching account data:", err);
      setAccountData(null);
    }
  }, [userId]);

  useEffect(() => {
    if (isInitialized && isLightningAuthenticated && lightningToken) {
      fetchUserData(lightningToken)
        .catch((err) => {
          console.error("Error fetching Lightning data:", err);
          setError("Failed to load Lightning data");
        });
    }
  }, [isInitialized, isLightningAuthenticated, lightningToken, fetchUserData]);

  // Fetch account data when userId changes
  useEffect(() => {
    fetchAccountData();
  }, [fetchAccountData]);

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
      await fetchAccountData();
    } catch (err) {
      console.error('Error resetting Lightning address:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset Lightning address');
    } finally {
      setIsResetting(false);
    }
  };

  if (!isInitialized) {
    return (
      <div
        className={`bg-background p-4 shadow-md border border-border ${className}`}
      >
        <div className="flex items-center">
          <div className="mr-2 text-accent-3">
            <LightningIcon />
          </div>
          <h3 className="text-lg font-semibold">Lightning</h3>
        </div>
        <div
          className={`flex items-center justify-center ${compact ? "pt-1" : "py-4"
            }`}
        >
          <div className="animate-spin h-6 w-6 border-4 border-accent-3 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  // Check if the connected wallet owns this profile
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
              <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex items-center justify-between gap-2 min-h-[4rem]">
                <p className="text-lg sm:text-xl font-semibold whitespace-nowrap overflow-x-auto flex-1">{displayLnAddress}</p>
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
                <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex items-center min-h-[4rem]">
                  <p className="text-lg sm:text-xl font-semibold">
                    {balance.toLocaleString()} <span className="text-sm text-foreground/70">sats</span>
                  </p>
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
                <div className="bg-secondary p-3 sm:p-4 border border-border flex items-center justify-between gap-2 min-h-[4rem]">
                  <p className="text-lg sm:text-xl font-semibold whitespace-nowrap overflow-x-auto flex-1">{displayLnAddress}</p>
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
            {walletInfo?.username && isOwner && !displayLnAddress && (
              // If no address set, show activate account button
              <button
                onClick={handleResetToDefault}
                disabled={isResetting}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-foreground text-background hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Activating...</span>
                  </>
                ) : (
                  <span>Activate Account</span>
                )}
              </button>
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
        onUpdate={fetchAccountData}
      />

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
