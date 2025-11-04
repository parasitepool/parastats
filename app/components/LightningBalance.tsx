'use client';

import { useState, useEffect, useCallback } from 'react';
import { LightningIcon } from '@/app/components/icons';
import { useWallet } from '@/app/hooks/useWallet';

interface LightningBalanceProps {
  className?: string;
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

const API_BASE_URL = 'https://api.bitbit.bot';

export default function LightningBalance({ className = '' }: LightningBalanceProps) {
  const { lightningToken, isLightningAuthenticated, isInitialized, connectWithLightning, refreshLightningAuth } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async (token: string) => {
    try {
      const [userResponse, balanceResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/wallet_user`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/wallet_user/balance`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      if (!balanceResponse.ok) {
        throw new Error('Failed to fetch balance');
      }

      const userData: WalletInfo = await userResponse.json();
      const balanceData: BalanceResponse = await balanceResponse.json();

      setWalletInfo(userData);
      setBalance(balanceData.balance);
    } catch (err) {
      throw err;
    }
  }, []);

  useEffect(() => {
    if (isInitialized && isLightningAuthenticated && lightningToken) {
      setIsLoading(true);
      fetchUserData(lightningToken)
        .catch((err) => {
          console.error('Error fetching Lightning data:', err);
          setError('Failed to load Lightning data');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isInitialized, isLightningAuthenticated, lightningToken, fetchUserData]);

  const handleConnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await connectWithLightning();
      
      if (!result) {
        throw new Error('Failed to connect wallet or authenticate with Lightning');
      }

    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setIsLoading(false);
    }
  }, [connectWithLightning]);

  const handleRefresh = useCallback(async () => {
    if (!lightningToken) {
      setError('No authentication found. Please connect your wallet.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await fetchUserData(lightningToken);
    } catch (err) {
      console.error('Refresh error:', err);
      
      try {
        const newToken = await refreshLightningAuth();
        if (newToken) {
          await fetchUserData(newToken);
        } else {
          throw new Error('Failed to refresh authentication');
        }
      } catch {
        setError('Session expired. Please reconnect your wallet.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [lightningToken, fetchUserData, refreshLightningAuth]);

  if (!isInitialized) {
    return (
      <div className={`bg-background p-4 shadow-md border border-border ${className}`}>
        <div className="flex items-center mb-3">
          <div className="mr-2 text-accent-3">
            <LightningIcon />
          </div>
          <h3 className="text-lg font-semibold">Lightning</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin h-6 w-6 border-4 border-accent-3 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-background p-4 shadow-md border border-border ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className="mr-2 text-accent-3">
            <LightningIcon />
          </div>
          <h3 className="text-lg font-semibold">Lightning</h3>
        </div>
      </div>

      {!isLightningAuthenticated ? (
        <div className="space-y-3">
          {isLoading ? (
            <>
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin h-8 w-8 border-4 border-accent-3 border-t-transparent rounded-full"></div>
              </div>
              <p className="text-sm text-center text-foreground/70">
                Connecting to Lightning wallet...
              </p>
            </>
          ) : (
            <>
              <div className="text-center py-6">
                <p className="text-foreground/70 mb-4">
                  Connect your wallet to view your Lightning balance
                </p>
                <button
                  onClick={handleConnect}
                  className="bg-accent-3 text-white px-6 py-2 hover:bg-accent-3/90 transition-colors font-medium"
                >
                  Connect Wallet
                </button>
              </div>
              {error && (
                <div className="text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin h-8 w-8 border-4 border-accent-3 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">
                  {balance !== null ? balance.toLocaleString() : '--'}
                </span>
                <span className="text-sm text-foreground/70 ml-2">sats</span>
              </div>

              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="w-full bg-secondary text-secondary-foreground px-3 py-2 hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </>
          )}

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
