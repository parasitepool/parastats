'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { request } from '@sats-connect/core';
import { LightningIcon } from '@/app/components/icons';
import { useWallet } from '@/app/hooks/useWallet';

interface LightningBalanceProps {
  userAddress: string;
  className?: string;
}

interface AuthToken {
  token: string;
  address: string;
  timestamp: number;
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

const IDENTIFIER = "de01d4ad-c24a-46fb-a5e8-755f3b7b7ab5";
const API_BASE_URL = 'https://api.bitbit.bot';

export default function LightningBalance({ userAddress, className = '' }: LightningBalanceProps) {
  const { addressPublicKey, disconnect: walletDisconnect } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const hasInitiatedAuth = useRef<boolean>(false);

  const getStoredAuth = useCallback((): AuthToken | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem('lightning_auth');
      if (stored) {
        const auth = JSON.parse(stored) as AuthToken;
        const now = Date.now();
        const tokenAge = now - auth.timestamp;
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (tokenAge < twentyFourHours) {
          return auth;
        }
      }
    } catch (err) {
      console.error('Error reading stored auth:', err);
    }
    
    return null;
  }, []);

  const storeAuth = useCallback((token: string, address: string) => {
    if (typeof window === 'undefined') return;
    
    const auth: AuthToken = {
      token,
      address,
      timestamp: Date.now()
    };
    
    localStorage.setItem('lightning_auth', JSON.stringify(auth));
  }, []);

  const clearStoredAuth = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('lightning_auth');
    setIsConnected(false);
    setBalance(null);
    setWalletInfo(null);
    hasInitiatedAuth.current = false;
  }, []);

  const validateToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/wallet_user/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  const requestNonce = useCallback(async (): Promise<string> => {
    const response = await fetch(
      `${API_BASE_URL}/login/${userAddress}/auth_nonce/${IDENTIFIER}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to request nonce: ${response.statusText}`);
    }

    const data = await response.json();
    return data.nonce;
  }, [userAddress]);

  const signNonce = useCallback(async (message: string): Promise<string> => {
    try {
      const response = await request('signMessage', {
        address: userAddress,
        message: message
      });

      if (response.status === 'success') {
        if (typeof response.result === 'string') {
          return response.result;
        } else if (response.result && typeof response.result === 'object' && 'signature' in response.result) {
          return response.result.signature;
        } else {
          throw new Error('Unexpected response format');
        }
      } else {
        throw new Error('User cancelled signing or signing failed');
      }
    } catch {
      throw new Error('Failed to sign message');
    }
  }, [userAddress]);

  const loginWithSignature = useCallback(async (
    signature: string,
    nonce: string
  ): Promise<string> => {
    const response = await fetch(
      `${API_BASE_URL}/login/${userAddress}/auth_sign/${IDENTIFIER}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signature,
          nonce,
          address: userAddress,
          public_key: addressPublicKey,
          email: ''
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed: ${errorText}`);
    }

    const data = await response.json();
    return data.token;
  }, [userAddress, addressPublicKey]);

  const fetchUserData = useCallback(async (token: string) => {
    try {
      const userResponse = await fetch(`${API_BASE_URL}/wallet_user`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userData: WalletInfo = await userResponse.json();
      setWalletInfo(userData);

      const balanceResponse = await fetch(`${API_BASE_URL}/wallet_user/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!balanceResponse.ok) {
        throw new Error('Failed to fetch balance');
      }

      const balanceData: BalanceResponse = await balanceResponse.json();
      setBalance(balanceData.balance);
    } catch (err) {
      throw err;
    }
  }, []);

  const handleConnect = useCallback(async () => {
    if (isLoading || isConnected || hasInitiatedAuth.current) {
      return;
    }

    hasInitiatedAuth.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const nonce = await requestNonce();

      const signature = await signNonce(nonce);

      const token = await loginWithSignature(signature, nonce);

      storeAuth(token, userAddress);

      await fetchUserData(token);

      setIsConnected(true);
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setIsConnected(false);
      hasInitiatedAuth.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, isLoading, isConnected, requestNonce, signNonce, loginWithSignature, storeAuth, fetchUserData]);

  const checkStoredAuth = useCallback(async () => {
    if (isLoading || isConnected || hasInitiatedAuth.current) {
      return;
    }

    const storedAuth = getStoredAuth();
    
    if (storedAuth && storedAuth.address === userAddress) {
      try {
        const isValid = await validateToken(storedAuth.token);
        if (isValid) {
          setIsConnected(true);
          await fetchUserData(storedAuth.token);
          hasInitiatedAuth.current = true;
        } else {
          clearStoredAuth();
          await handleConnect();
        }
      } catch {
        clearStoredAuth();
        await handleConnect();
      }
    } else {
      await handleConnect();
    }
  }, [userAddress, handleConnect, isLoading, isConnected, getStoredAuth, validateToken, fetchUserData, clearStoredAuth]);

  useEffect(() => {
    checkStoredAuth();
  }, [checkStoredAuth]);

  const handleRefresh = useCallback(async () => {
    const storedAuth = getStoredAuth();
    
    if (!storedAuth) {
      setError('No authentication found. Please connect your wallet.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await fetchUserData(storedAuth.token);
    } catch (err) {
      console.error('Refresh error:', err);
      clearStoredAuth();
      setError('Session expired. Please reconnect your wallet.');
    } finally {
      setIsLoading(false);
    }
  }, [getStoredAuth, fetchUserData, clearStoredAuth]);

  const handleDisconnect = useCallback(() => {
    clearStoredAuth();
    walletDisconnect();
    setError(null);
    hasInitiatedAuth.current = false;
  }, [clearStoredAuth, walletDisconnect]);

  return (
    <div className={`bg-background p-4 shadow-md border border-border ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <div className="mr-2 text-accent-3">
            <LightningIcon />
          </div>
          <h3 className="text-lg font-semibold">Lightning Balance</h3>
        </div>
        
        {isConnected && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-accent-2 hover:text-primary transition-colors"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
      </div>

      {!isConnected ? (
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
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold">
              {balance !== null ? balance.toLocaleString() : '--'}
            </span>
            <span className="text-sm text-foreground/70 ml-2">sats</span>
          </div>

          {isExpanded && walletInfo && (
            <div className="pt-3 border-t border-border space-y-2 text-sm">
              {walletInfo.username && (
                <div className="flex justify-between">
                  <span className="text-foreground/70">Username:</span>
                  <span className="font-medium">{walletInfo.username}</span>
                </div>
              )}
              
              {walletInfo.lightning_ln_url && (
                <div className="flex flex-col">
                  <span className="text-foreground/70 mb-1">Lightning URL:</span>
                  <span className="font-mono text-xs break-all bg-secondary p-2 border border-border">
                    {walletInfo.lightning_ln_url}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex-1 bg-secondary text-secondary-foreground px-3 py-2 hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            
            <button
              onClick={handleDisconnect}
              className="flex-1 bg-secondary text-secondary-foreground px-3 py-2 hover:bg-secondary/80 transition-colors text-sm font-medium"
            >
              Disconnect
            </button>
          </div>

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
