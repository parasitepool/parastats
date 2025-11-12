"use client";

import { useState, useEffect, useCallback } from "react";
import { LightningIcon } from "@/app/components/icons";
import { useWallet } from "@/app/hooks/useWallet";
import LightningModal from "@/app/components/modals/LightningModal";
import type { AccountData } from "@/app/api/account/types";

interface LightningBalanceProps {
  className?: string;
  compact?: boolean;
  userId?: string;
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

export default function LightningBalance({
  className = "",
  compact = false,
  userId,
}: LightningBalanceProps) {
  const {
    lightningToken,
    isLightningAuthenticated,
    isInitialized,
    connectWithLightning,
    refreshLightningAuth,
    address,
  } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchUserData = useCallback(async (token: string) => {
    try {
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
    } catch (err) {
      throw err;
    }
  }, []);

  // Fetch account data from Next.js API
  const fetchAccountData = useCallback(async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/account/${userId}`);
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
      setIsLoading(true);
      fetchUserData(lightningToken)
        .catch((err) => {
          console.error("Error fetching Lightning data:", err);
          setError("Failed to load Lightning data");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isInitialized, isLightningAuthenticated, lightningToken, fetchUserData]);

  // Fetch account data when userId changes
  useEffect(() => {
    fetchAccountData();
  }, [fetchAccountData]);

  const handleConnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await connectWithLightning();

      if (!result) {
        throw new Error(
          "Failed to connect wallet or authenticate with Lightning"
        );
      }
    } catch (err) {
      console.error("Connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setIsLoading(false);
    }
  }, [connectWithLightning]);

  const handleRefresh = useCallback(async () => {
    if (!lightningToken) {
      setError("No authentication found. Please connect your wallet.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await fetchUserData(lightningToken);
    } catch (err) {
      console.error("Refresh error:", err);

      try {
        const newToken = await refreshLightningAuth();
        if (newToken) {
          await fetchUserData(newToken);
        } else {
          throw new Error("Failed to refresh authentication");
        }
      } catch {
        setError("Session expired. Please reconnect your wallet.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [lightningToken, fetchUserData, refreshLightningAuth]);

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
          className={`flex items-center justify-center ${
            compact ? "pt-1" : "py-4"
          }`}
        >
          <div className="animate-spin h-6 w-6 border-4 border-accent-3 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  // Check if the connected wallet owns this profile
  const isOwner = !userId || address === userId;
  
  // Only show lightning address from Next.js endpoint, not from bitbit
  const displayLnAddress = accountData?.ln_address || null;
  const hasData = isLightningAuthenticated && (balance !== null || walletInfo !== null || accountData !== null);

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
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center">
            <div className="mr-2 text-accent-3">
              <LightningIcon />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">Lightning</h2>
          </div>
          {isOwner && isLightningAuthenticated && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 bg-foreground text-background hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
        </div>

        {!hasData ? (
          <div className="text-center py-8">
            <p className="text-2xl font-semibold text-gray-400">-</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Balance */}
            {balance !== null && (
              <div>
                <h3 className="text-sm font-medium text-accent-2 mb-2">Balance</h3>
                <div className="bg-secondary p-3 sm:p-4 border border-border">
                  <p className="text-2xl sm:text-3xl font-bold">
                    {balance.toLocaleString()} <span className="text-sm text-foreground/70">sats</span>
                  </p>
                </div>
              </div>
            )}

            {/* Username */}
            {walletInfo?.username && (
              <div>
                <h3 className="text-sm font-medium text-accent-2 mb-2">Username</h3>
                <div className="bg-secondary p-3 sm:p-4 border border-border">
                  <p className="text-lg sm:text-xl font-semibold break-all">{walletInfo.username}</p>
                </div>
              </div>
            )}

            {/* Lightning Address */}
            {displayLnAddress && (
              <div className="sm:col-span-2 lg:col-span-1">
                <h3 className="text-sm font-medium text-accent-2 mb-2">Lightning Address</h3>
                <div className="bg-secondary p-3 sm:p-4 border border-border">
                  <p className="text-lg sm:text-xl font-semibold break-all">{displayLnAddress}</p>
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
        onUpdate={fetchAccountData}
      />
    </>
  );
}
