'use client';

import { useState, useEffect } from 'react';
import { request } from '@sats-connect/core';
import { LightningIcon } from './icons';

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

// Replace with your actual API token from environment variable
const API_TOKEN = process.env.NEXT_PUBLIC_BITBIT_API_TOKEN || 'TOKEN_REDACTED';
const API_BASE_URL = 'https://api.bitbit.bot';

export default function LightningBalance({ userAddress, className = '' }: LightningBalanceProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Check if we have a valid stored token on mount
  useEffect(() => {
    checkStoredAuth();
  }, [userAddress]);

  /**
   * Check if we have a valid stored authentication token
   */
  const checkStoredAuth = async () => {
    const storedAuth = getStoredAuth();
    
    if (storedAuth && storedAuth.address === userAddress) {
      // Check if token is still valid by trying to fetch balance
      try {
        const isValid = await validateToken(storedAuth.token);
        if (isValid) {
          setIsConnected(true);
          await fetchUserData(storedAuth.token);
        } else {
          // Token expired or invalid, clear it
          clearStoredAuth();
        }
      } catch (err) {
        clearStoredAuth();
      }
    }
  };

  /**
   * Get stored authentication from localStorage
   */
  const getStoredAuth = (): AuthToken | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem('lightning_auth');
      if (stored) {
        const auth = JSON.parse(stored) as AuthToken;
        // Check if token is less than 24 hours old
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
  };

  /**
   * Store authentication in localStorage
   */
  const storeAuth = (token: string, address: string) => {
    if (typeof window === 'undefined') return;
    
    const auth: AuthToken = {
      token,
      address,
      timestamp: Date.now()
    };
    
    localStorage.setItem('lightning_auth', JSON.stringify(auth));
  };

  /**
   * Clear stored authentication
   */
  const clearStoredAuth = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('lightning_auth');
    setIsConnected(false);
    setBalance(null);
    setWalletInfo(null);
  };

  /**
   * Validate token by attempting to fetch balance
   */
  const validateToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/wallet_user/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.ok;
    } catch (err) {
      return false;
    }
  };

  /**
   * Step 1: Request a nonce from the API
   */
  const requestNonce = async (): Promise<string> => {
    const response = await fetch(
      `${API_BASE_URL}/login/string:${userAddress}/auth_sign/${API_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to request nonce: ${response.statusText}`);
    }

    const data = await response.json();
    return data.nonce;
  };

  /**
   * Step 2: Sign the nonce using @sats-connect/core
   * Using the same pattern as your useWallet.tsx
   */
  const signNonce = async (message: string): Promise<string> => {
    try {
      const response = await request('signMessage', {
        address: userAddress,
        message: message
      });

      if (response.status === 'success') {
        // Extract signature from response
        // The structure might be response.result.signature or response.result depending on the API
        return response.result.signature || response.result;
      } else {
        throw new Error('User cancelled signing or signing failed');
      }
    } catch (err) {
      throw new Error('Failed to sign message');
    }
  };

  /**
   * Step 3: Login with the signature
   */
  const loginWithSignature = async (
    signature: string,
    nonce: string
  ): Promise<string> => {
    const response = await fetch(
      `${API_BASE_URL}/login/string:${userAddress}/auth_sign/${API_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signature,
          nonce,
          address: userAddress,
          public_key: '', // May not be needed or can be extracted from wallet
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
  };

  /**
   * Step 5: Fetch wallet info and balance
   */
  const fetchUserData = async (token: string) => {
    try {
      // Fetch user info
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

      // Fetch balance
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
  };

  /**
   * Main connection flow - Steps 1-5
   */
  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Request nonce
      const nonce = await requestNonce();

      // Step 2: Sign the nonce using @sats-connect/core
      const signature = await signNonce(nonce);

      // Step 3: Login with signature
      const token = await loginWithSignature(signature, nonce);

      // Step 4: Store the token
      storeAuth(token, userAddress);

      // Step 5: Fetch user data
      await fetchUserData(token);

      setIsConnected(true);
    } catch (err) {
      console.error('Connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Refresh balance
   */
  const handleRefresh = async () => {
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
      // Token might be invalid, clear it
      clearStoredAuth();
      setError('Session expired. Please reconnect your wallet.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Disconnect wallet
   */
  const handleDisconnect = () => {
    clearStoredAuth();
    setError(null);
  };

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
          <p className="text-sm text-foreground/70">
            Connect your Xverse wallet to view your Lightning balance
          </p>
          
          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full bg-primary text-primary-foreground px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? 'Connecting...' : 'Connect Wallet'}
          </button>

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 p-2 border border-red-500/20">
              {error}
            </div>
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
