"use client";

import { useState, useEffect, useCallback, useRef, type MouseEvent } from "react";
import CardHeader from "@/app/components/CardHeader";
import { getCollapsibleContainerClassName, shouldToggleCollapse } from "@/app/components/collapsible";
import { LightningIcon } from "@/app/components/icons";
import { useWallet, SignCancelledError } from "@/app/hooks/useWallet";
import { normalizeBitcoinAddress } from "@/app/utils/validators";
import LightningModal from "@/app/components/modals/LightningModal";
import WithdrawModal from "@/app/components/modals/WithdrawModal";
import type { AccountData, WalletInfo, CombinedAccountResponse } from "@/app/api/account/types";

interface LightningBalanceProps {
  className?: string;
  compact?: boolean;
  userId?: string;
  loading?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  onAccountUpdated?: (account: AccountData) => void;
}

export default function LightningBalance({
  className = "",
  compact = false,
  userId,
  loading = false,
  collapsed = false,
  onToggle,
  onAccountUpdated,
}: LightningBalanceProps) {
  const {
    lightningAuthStatus,
    isLightningAuthenticated,
    isInitialized,
    isConnected,
    address,
    walletType,
    refreshLightningAuth,
    markLightningExpired,
    signMessage,
  } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isReconnectingLightning, setIsReconnectingLightning] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const fetchIdRef = useRef(0);

  const normalizedUserId = userId ? normalizeBitcoinAddress(userId) : null;
  const isOwner = Boolean(isConnected && address && (!normalizedUserId || address === normalizedUserId));
  const isManual = walletType === "manual";
  const isXverse = walletType === "xverse";
  const shouldIncludeLightning = isOwner && isXverse && isLightningAuthenticated;

  const containerClassName = getCollapsibleContainerClassName(
    `bg-background p-4 sm:p-6 shadow-md border border-border ${className}`.trim(),
    collapsed,
    Boolean(onToggle),
  );
  const compactContainerClassName = getCollapsibleContainerClassName(
    `bg-background p-4 shadow-md border border-border ${className}`.trim(),
    collapsed,
    Boolean(onToggle),
  );

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onToggle || !shouldToggleCollapse(event)) {
      return;
    }

    onToggle();
  };

  const fetchCombinedData = useCallback(async () => {
    if (!normalizedUserId) return;

    const fetchId = ++fetchIdRef.current;
    setIsFetching(true);
    setError(null);
    try {
      const url = shouldIncludeLightning
        ? `/api/account/${normalizedUserId}?includeLightning=1`
        : `/api/account/${normalizedUserId}`;

      const response = await fetch(url, { cache: "no-store" });
      if (fetchId !== fetchIdRef.current) return;

      if (response.ok) {
        const data: CombinedAccountResponse = await response.json();
        if (fetchId !== fetchIdRef.current) return;

        setAccountData(data.account);
        if (data.lightningTokenExpired) {
          markLightningExpired();
          setWalletInfo(null);
          setBalance(null);
        } else if (data.lightning) {
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
      if (fetchId !== fetchIdRef.current) return;
      console.error("Error fetching combined data:", err);
      setError("Failed to load data");
      setAccountData(null);
      setWalletInfo(null);
      setBalance(null);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsFetching(false);
      }
    }
  }, [normalizedUserId, shouldIncludeLightning, markLightningExpired]);

  useEffect(() => {
    if (isInitialized && lightningAuthStatus !== "checking") {
      void fetchCombinedData();
    }
  }, [isInitialized, lightningAuthStatus, fetchCombinedData]);

  const handleReconnectLightning = async () => {
    setIsReconnectingLightning(true);
    setError(null);
    try {
      await refreshLightningAuth();
    } catch (err) {
      if (err instanceof SignCancelledError) return;
      console.error("Lightning reconnect error:", err);
      setError(err instanceof Error ? err.message : "Failed to reconnect Lightning");
    } finally {
      setIsReconnectingLightning(false);
    }
  };

  const submitLnAddressUpdate = useCallback(
    async (lnAddress: string): Promise<AccountData> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      return await signMessage({
        address,
        message: lnAddress,
        submit: async (signature: string) => {
          const response = await fetch("/api/account/update", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              btc_address: address,
              ln_address: lnAddress,
              signature,
            }),
          });

          if (!response.ok) {
            let errorMessage = "Failed to update Lightning address";
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
    },
    [address, signMessage],
  );

  const handleActivateDefaultLnAddress = async () => {
    if (!walletInfo?.username) return;

    const usernameAddress = `${walletInfo.username}@sati.pro`;
    setIsActivating(true);
    setError(null);

    try {
      const updatedData = await submitLnAddressUpdate(usernameAddress);
      setAccountData(updatedData);
      onAccountUpdated?.(updatedData);
      await fetchCombinedData();
    } catch (err) {
      if (err instanceof SignCancelledError) return;
      console.error("Error activating default Lightning address:", err);
      setError(err instanceof Error ? err.message : "Failed to set Lightning address");
    } finally {
      setIsActivating(false);
    }
  };

  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetToDefault = async () => {
    if (!address || !walletInfo?.username) {
      setError("Missing required data");
      setShowResetConfirm(false);
      return;
    }

    const usernameAddress = `${walletInfo.username}@sati.pro`;
    setIsResetting(true);
    setError(null);

    try {
      const updatedData = await submitLnAddressUpdate(usernameAddress);
      setAccountData(updatedData);
      onAccountUpdated?.(updatedData);
      setShowResetConfirm(false);
      await fetchCombinedData();
    } catch (err) {
      if (err instanceof SignCancelledError) return;
      console.error("Error resetting Lightning address:", err);
      setError(err instanceof Error ? err.message : "Failed to reset Lightning address");
    } finally {
      setIsResetting(false);
    }
  };

  const isLoading = !isInitialized || loading || isFetching || lightningAuthStatus === "checking";

  if (isLoading && compact) {
    return (
      <div className={compactContainerClassName} onClick={handleClick}>
        <CardHeader
          title="Lightning"
          icon={<LightningIcon />}
          className={collapsed ? "" : "mb-2"}
          titleClassName="text-sm font-medium text-accent-2"
        />
        {!collapsed && <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={containerClassName} onClick={handleClick}>
        <CardHeader
          title="Lightning"
          icon={<LightningIcon />}
          className={collapsed ? "" : "mb-4 sm:mb-6"}
        />

        {!collapsed && (
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-accent-2 mb-2">LN Address</h3>
              <div className="bg-secondary p-3 sm:p-4 border border-border h-[5rem] flex items-center">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
              </div>
            </div>

            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-accent-2 mb-2">Balance</h3>
              <div className="bg-secondary p-3 sm:p-4 border border-border h-[5rem] flex items-center">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const displayLnAddress = accountData?.ln_address || null;
  const usernameWithDomain = walletInfo?.username ? `${walletInfo.username}@sati.pro` : null;
  const addressesMatch = Boolean(usernameWithDomain && displayLnAddress && usernameWithDomain === displayLnAddress);
  const showBalanceRow = isOwner && isXverse && (
    !isLightningAuthenticated ||
    balance === null ||
    addressesMatch ||
    balance > 0
  );

  if (compact) {
    return (
      <>
        <div className={compactContainerClassName} onClick={handleClick}>
          <CardHeader
            title="Lightning"
            icon={<LightningIcon />}
            className={collapsed ? "" : "mb-2"}
            titleClassName="text-sm font-medium text-accent-2"
          />
          {!collapsed && (
            !isLightningAuthenticated ? (
              <p className="text-2xl font-semibold">
                <span className="text-gray-400">-</span>
              </p>
            ) : (
              <p className="text-2xl font-semibold">
                {balance !== null ? balance.toLocaleString() : "--"}
              </p>
            )
          )}
        </div>
        <LightningModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className={containerClassName} onClick={handleClick}>
        <CardHeader
          title="Lightning"
          icon={<LightningIcon />}
          className={collapsed ? "" : "mb-4 sm:mb-6"}
        />

        {!collapsed && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-accent-2 mb-2">LN Address</h3>
                <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex items-center justify-between gap-2 h-[5rem]">
                  {displayLnAddress ? (
                    <>
                      <p className="text-lg sm:text-xl font-semibold whitespace-nowrap overflow-x-auto flex-1 scrollbar-hide">
                        {displayLnAddress}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!addressesMatch && walletInfo?.username && isOwner && (
                          <button
                            onClick={handleResetClick}
                            className="flex items-center gap-1 px-2 py-1 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs font-medium"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Reset</span>
                          </button>
                        )}
                        {isOwner && (
                          <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-1 px-2 py-1 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs font-medium"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </>
                  ) : isOwner ? (
                    <>
                      <p className="text-sm text-foreground/60 truncate">
                        {usernameWithDomain ? `Default: ${usernameWithDomain}` : "Not set"}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isXverse && usernameWithDomain && (
                          <button
                            onClick={handleActivateDefaultLnAddress}
                            disabled={isActivating}
                            className="px-2.5 py-1 bg-foreground text-background hover:bg-foreground/80 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isActivating ? "Activating..." : "Use Default"}
                          </button>
                        )}
                        <button
                          onClick={() => setIsModalOpen(true)}
                          disabled={isActivating}
                          className="px-2.5 py-1 border border-border hover:bg-secondary-hover transition-colors text-xs font-medium disabled:opacity-50"
                        >
                          {isXverse && usernameWithDomain ? "Custom" : "Set Address"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-lg font-semibold text-gray-400">-</p>
                  )}
                </div>
              </div>

              {showBalanceRow && (
                <div className="flex flex-col">
                  <h3 className="text-sm font-medium text-accent-2 mb-2">Balance</h3>
                  <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex items-center justify-between gap-2 h-[5rem]">
                    {isLightningAuthenticated && balance !== null ? (
                      <>
                        <p className="text-lg sm:text-xl font-semibold">
                          {balance.toLocaleString()} <span className="text-sm text-foreground/70">sats</span>
                        </p>
                        <div className="relative group">
                          <button
                            onClick={() => balance >= 8000 && setIsWithdrawModalOpen(true)}
                            disabled={balance < 8000}
                            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium flex-shrink-0 ${
                              balance >= 8000
                                ? "bg-foreground text-background hover:bg-gray-700 transition-colors cursor-pointer"
                                : "bg-gray-400 text-gray-600 cursor-not-allowed opacity-50"
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Withdraw</span>
                          </button>
                          {balance < 8000 && (
                            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-48 p-2 bg-background border border-border shadow-lg text-xs z-10">
                              Minimum balance of 8,000 sats required to withdraw
                            </div>
                          )}
                        </div>
                      </>
                    ) : isLightningAuthenticated ? (
                      <>
                        <p className="text-xs sm:text-sm text-foreground/60">
                          Balance unavailable
                        </p>
                        <button
                          onClick={() => void fetchCombinedData()}
                          disabled={isFetching}
                          className="px-3 py-1.5 bg-foreground text-background hover:bg-foreground/80 transition-colors text-xs font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Retry
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs sm:text-sm text-foreground/60">
                          {lightningAuthStatus === "expired"
                            ? "Lightning session expired"
                            : "Reconnect to view balance"}
                        </p>
                        <button
                          onClick={handleReconnectLightning}
                          disabled={isReconnectingLightning}
                          className="px-3 py-1.5 bg-foreground text-background hover:bg-foreground/80 transition-colors text-xs font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isReconnectingLightning ? "Reconnecting..." : "Reconnect Lightning"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {isManual && (
              <p className="mt-4 text-xs text-foreground/50">
                Balance and withdrawals require connecting with XVERSE.
              </p>
            )}

            {error && (
              <div className="mt-4 text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      <LightningModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={() => {
          void fetchCombinedData();
        }}
      />

      {isWithdrawModalOpen && address && (
        <WithdrawModal
          isOpen={isWithdrawModalOpen}
          onClose={() => setIsWithdrawModalOpen(false)}
          onComplete={() => {
            void fetchCombinedData();
          }}
          onSessionExpired={markLightningExpired}
          balance={balance ?? 0}
          btcAddress={accountData?.btc_address ?? address}
        />
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background border border-foreground p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-accent-3">Reset LN Address</h2>
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
                <h3 className="text-sm font-medium text-accent-2 mb-2">Current LN Address</h3>
                <div className="bg-secondary p-3 border border-border">
                  <p className="text-foreground break-all">{displayLnAddress || "Not set"}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-accent-2 mb-2">New LN Address</h3>
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
                  {isResetting ? "Resetting..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
