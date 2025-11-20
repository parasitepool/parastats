'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import HashrateChart from '../../components/HashrateChart';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { getUserData, getHistoricalUserStats, getHashrate, toggleUserVisibility } from '@/app/utils/api';
import { ProcessedUserData } from '@/app/api/user/[address]/route';
import { HistoricalUserStats } from '@/app/api/user/[address]/historical/route';
import { Hashrate } from '@mempool/mempool.js/lib/interfaces/bitcoin/difficulty';
import SortableTable from '../../components/SortableTable';
import { formatDifficulty, formatHashrate, formatRelativeTime } from '@/app/utils/formatters';
import { parseHashrate } from '@/app/utils/formatters';
import LightningBalance from '@/app/components/LightningBalance';
import StratumInfo from '@/app/components/StratumInfo';
import AnimatedCounter from '@/app/components/AnimatedCounter';
import { useWallet } from '@/app/hooks/useWallet';
import { useRouter } from 'next/navigation';
import type { AccountData, CombinedAccountResponse } from '@/app/api/account/types';

export default function UserDashboard() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const [isValidAddress, setIsValidAddress] = useState<boolean | null>(null);
  const [userData, setUserData] = useState<ProcessedUserData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalUserStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hashrate, setHashrate] = useState<Hashrate>();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [isLoadingAccountData, setIsLoadingAccountData] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const {
    isLightningAuthenticated,
    isInitialized,
    connectWithLightning,
  } = useWallet();

  // Validate Bitcoin address on mount
  useEffect(() => {
    const isValid = isValidBitcoinAddress(userId.trim());
    setIsValidAddress(isValid);
  }, [userId]);

  // Fetch user data and hashrate on mount and every 10 seconds (only if valid address)
  useEffect(() => {
    // Don't fetch if address is invalid
    if (isValidAddress === false) return;
    // Don't fetch until we've validated the address
    if (isValidAddress === null) return;

    let mounted = true;

    const fetchUserData = async () => {
      try {
        // Fetch user data and hashrate in parallel
        const [data, hashrateData] = await Promise.all([
          getUserData(userId),
          getHashrate()
        ]);
        if (mounted) {
          setUserData(data);
          setHashrate(hashrateData);
        }
      } catch (error) {
        if (mounted) {
          if (error instanceof Error && error.message.includes('404')) {
            // For 404 errors, user doesn't exist yet - set userData to null
            setUserData(null);
          } else {
            // Only show error on initial load, not on background updates
            if (!hasInitiallyLoaded) {
              console.error('Error fetching user data:', error);
              setError('Failed to fetch user data. Please try again later.');
              setUserData(null);
            } else {
              // Silently log background update errors
              console.error('Background update error:', error);
            }
          }
        }
      } finally {
        if (mounted) {
          setHasInitiallyLoaded(true);
        }
      }
    };

    // Initial fetch
    fetchUserData();
    
    const intervalId: NodeJS.Timeout = setInterval(fetchUserData, 10000); // 10000ms = 10s
    
    // Cleanup function
    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isValidAddress]);

  // Fetch historical data on mount and every minute (only if valid address)
  useEffect(() => {
    // Don't fetch if address is invalid or not yet validated
    if (!isValidAddress) return;

    let mounted = true;

    const fetchHistoricalData = async () => {
      try {
        const data = await getHistoricalUserStats(userId, '3d', '5m');
        if (mounted) {
          setHistoricalData(data);
        }
      } catch (error) {
        console.error('Error fetching historical data:', error);
      }
    };

    fetchHistoricalData();
    const intervalId = setInterval(fetchHistoricalData, 60000); // Update every minute

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [userId, isValidAddress]);

  // Fetch account data when userId changes and every 10 seconds (only if valid address)
  useEffect(() => {
    // Don't fetch if address is invalid
    if (isValidAddress === false) {
      setIsLoadingAccountData(false);
      return;
    }
    // Don't fetch until we've validated the address
    if (isValidAddress === null) return;

    let mounted = true;
    let hasInitiallyLoadedAccount = false;

    const fetchAccountData = async () => {
      // Only show loading on initial load
      if (!hasInitiallyLoadedAccount && mounted) {
        setIsLoadingAccountData(true);
      }
      
      try {
        const response = await fetch(`/api/account/${userId}`, {
          cache: 'no-store',
        });
        if (response.ok) {
          const data: CombinedAccountResponse = await response.json();
          if (mounted) {
            setAccountData(data.account);
          }
        } else {
          if (mounted) {
            setAccountData(null);
          }
        }
      } catch (err) {
        if (mounted) {
          // Only show error on initial load, not on background updates
          if (!hasInitiallyLoadedAccount) {
            console.error("Error fetching account data:", err);
          } else {
            // Silently log background update errors
            console.error("Background account update error:", err);
          }
          setAccountData(null);
        }
      } finally {
        if (mounted) {
          hasInitiallyLoadedAccount = true;
          setIsLoadingAccountData(false);
        }
      }
    };

    // Initial fetch
    fetchAccountData();
    
    // Refresh account data every 10 seconds
    const intervalId: NodeJS.Timeout = setInterval(fetchAccountData, 10000);
    
    // Cleanup function
    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [userId, isValidAddress]);

  // Handle visibility toggle
  const handleToggleVisibility = async () => {
    if (!userData) return;

    setIsTogglingVisibility(true);
    try {
      const result = await toggleUserVisibility(userId);
      setUserData({ ...userData, isPublic: result.isPublic });
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
      alert('Failed to toggle visibility. Please try again.');
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  // Handle account activation
  const handleActivateAccount = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      // If not authenticated, just connect the wallet
      if (!isLightningAuthenticated) {
        const result = await connectWithLightning();
        if (result) {
          router.push(`/user/${result.address}`);
        } else {
          setError('Failed to connect wallet');
        }
        return;
      }

      // Already authenticated - do the full activation flow to set Lightning address
      const result = await connectWithLightning();
      if (!result || !result.address || !result.token) {
        setError('Failed to get wallet info');
        return;
      }

      // Fetch wallet info to get the username using combined endpoint
      const walletResponse = await fetch(`/api/account/${result.address}`, {
        headers: { 'X-Lightning-Token': result.token },
        cache: 'no-store',
      });

      if (!walletResponse.ok) {
        throw new Error('Failed to fetch wallet info');
      }

      const combinedData: CombinedAccountResponse = await walletResponse.json();
      if (!combinedData.lightning?.walletInfo) {
        throw new Error('Failed to get wallet info');
      }

      const usernameAddress = `${combinedData.lightning.walletInfo.username}@sati.pro`;

      // Request signature for the Lightning address using BIP322
      const { request: satConnectRequest, MessageSigningProtocols } = await import('@sats-connect/core');

      const signResponse = await satConnectRequest('signMessage', {
        address: result.address,
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

      // Send update request to set the Lightning address
      const updateResponse = await fetch('/api/account/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          btc_address: result.address,
          ln_address: usernameAddress,
          signature: signature,
        }),
      });

      if (!updateResponse.ok) {
        let errorMessage = 'Failed to activate account';
        try {
          const errorData = await updateResponse.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not JSON, use default error message
        }
        throw new Error(errorMessage);
      }

      // Refresh the page to show updated data
      window.location.reload();
    } catch (err) {
      console.error('Activation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to activate account');
    } finally {
      setIsConnecting(false);
    }
  };

  // Stat cards configuration - show placeholders when data is missing
  const statCards = [
    {
      title: 'Hashrate',
      value: userData?.hashrate ? formatHashrate(userData.hashrate) : <span className="text-gray-400">-</span>,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      title: 'Best Difficulty',
      value: userData?.bestDifficulty && hashrate?.currentDifficulty ? 
        <span className='flex gap-1'>{userData.bestDifficulty} 
          <span 
            className="relative inline-block"
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
          >
            <span className="text-sm text-muted-foreground cursor-help">
              ({Number(((parseHashrate(userData.bestDifficulty) / hashrate.currentDifficulty) * 100).toFixed(4))}%)
            </span>
            {tooltipVisible && (
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2 w-48 p-2 bg-background border border-border rounded shadow-lg text-xs z-10">
                Percentage of the current network difficulty
              </span>
            )}
          </span>
        </span> : 
        <span className="text-gray-400">-</span>,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      title: 'Total Work',
      value: accountData?.total_diff ? (
        <span className="block whitespace-nowrap">
          <AnimatedCounter value={Number(accountData.total_diff)} />
        </span>
      ) : (
        <span className="text-gray-400">-</span>
      ),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      title: 'Last Submission',
      value: userData?.lastSubmission || <span className="text-gray-400">-</span>,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      title: 'Uptime',
      value: userData?.uptime || <span className="text-gray-400">-</span>,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      )
    }
  ];

  // Show error for invalid Bitcoin address
  if (isValidAddress === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-center text-lg font-semibold mb-2">Invalid Bitcoin Address</p>
        <p className="text-center text-accent-2 mb-4">The address you entered is not a valid Bitcoin address.</p>
        <Link href="/" className="mt-4 text-accent-3 hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  // Show error message if there was an error fetching data
  if (error && !hasInitiallyLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-center">{error}</p>
        <Link href="/" className="mt-4 text-accent-3 hover:underline">
          Return to Home
        </Link>
      </div>
    );
  }

  // Show dashboard (works even without userData - will show shimmer or empty states)
  return (
    <>
      <main className="flex min-h-screen flex-col items-start py-8">
        <div className="w-full mb-2">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold wrap-anywhere text-ellipsis line-clamp-1">{userId}</h1>

            <div className="flex items-center gap-2">
              {/* Visibility Toggle Button - only show if userData exists */}
              {userData && (
                <button
                  onClick={handleToggleVisibility}
                  disabled={isTogglingVisibility}
                  className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-accent-1/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  {userData.isPublic ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium">Public</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                      <span className="text-sm font-medium">Private</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

        {/* Stats Cards */}
        <div className="w-full">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
            {statCards.map((card, index) => (
              <div key={index}>
                <div className="bg-background p-4 shadow-md border border-border h-full">
                  <div className="flex items-center mb-2">
                    <div className="mr-2 text-accent-3">
                      {card.icon}
                    </div>
                    <h3 className="text-sm font-medium text-accent-2">{card.title}</h3>
                  </div>
                  {!hasInitiallyLoaded || isLoadingAccountData ? (
                    <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  ) : (
                    <div 
                      className="font-semibold whitespace-nowrap w-full overflow-hidden text-left"
                      style={{ fontSize: 'clamp(0.625rem, 1.8vw, 1.5rem)' }}
                    >
                      {card.value}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account Activation / Lightning & Stratum Information */}
        <div className="w-full mt-4">
          {!isInitialized || !hasInitiallyLoaded || isLoadingAccountData ? (
            // Loading state - Show shimmer components while data is loading
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StratumInfo userId={userId} isLoading={true} />
              <LightningBalance userId={userId} loading={true} />
            </div>
          ) : !isLightningAuthenticated || !accountData || !accountData.ln_address ? (
            // Not authenticated, no account data, or no lightning address - Show Connect/Activate Account button
            <div className="bg-background p-6 sm:p-8 shadow-md border border-border">
              <div className="flex flex-col items-center justify-center py-8">
                <button
                  onClick={handleActivateAccount}
                  disabled={isConnecting}
                  className="px-8 py-4 bg-foreground text-background text-lg font-medium hover:bg-foreground/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isConnecting ? 'Connecting...' : (!isLightningAuthenticated ? 'Connect' : 'Activate Account')}
                </button>
                {error && (
                  <div className="mt-4 text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
                    {error}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Authenticated with account data and lightning address - Show Lightning and Stratum components
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StratumInfo userId={userId} isLoading={false} />
              <LightningBalance userId={userId} loading={false} />
            </div>
          )}
        </div>
      </div>

      {/* Hashrate Chart - only show if we have data */}
      {userData && (
        <div className="w-full mb-6">
          <HashrateChart
            data={historicalData ? {
              timestamps: historicalData.map(d => {
                const date = new Date(d.timestamp);
                return date.toLocaleString("en-US", {
                  year: undefined,
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });
              }),
              series: [
                {
                  data: historicalData.map(d => d.hashrate),
                  title: "Hashrate"
                }
              ]
            } : undefined}
            loading={!historicalData}
          />
        </div>
      )}
      
      {/* Mining Projections - Uncomment when UserMiningStats is implemented */}
      {/* <UserMiningStats 
        userHashrate={userData.displayHashrate}
        minerWattages={minerWattages}
        electricityRate={0.10} // Example electricity rate in dollars per kWh
      /> */}
      
      {/* Workers Table/Cards - show shimmer when loading or actual data when loaded */}
      {(!hasInitiallyLoaded || (userData && userData.workerData && userData.workerData.length > 0)) && (
        <div className="w-full bg-background pb-6 shadow-md">
          <h2 className="text-xl font-semibold mb-4">
            {!hasInitiallyLoaded ? 'Miners' : `Miners(${userData?.workerData?.length || 0})`}
          </h2>

        {/* Desktop Table - Hidden on mobile */}
        <div className="hidden md:block">
          {!hasInitiallyLoaded ? (
            <div className="space-y-3">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          ) : userData?.workerData ? (
            <SortableTable
              data={userData.workerData}
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  render: (value) => (
                    // <Link href={`/worker/${worker.id}`} className="text-foreground font-bold hover:underline">
                    <Link href='#' className="text-foreground font-bold hover:underline">
                      {value as string}
                    </Link>
                  )
                },
                {
                  key: 'hashrate',
                  header: 'Hashrate',
                  render: (value) => formatHashrate(parseHashrate(value as string))
                },
                {
                  key: 'bestDifficulty',
                  header: 'Best Difficulty',
                  render: (value) => formatDifficulty(value as string)
                },
                {
                  key: 'lastSubmission',
                  header: 'Last Submission',
                  render: (value) => formatRelativeTime(parseInt(value as string))
                }
              ]}
              defaultSortColumn="hashrate"
              defaultSortDirection="desc"
            />
          ) : null}
        </div>

        {/* Mobile Cards - Visible only on mobile */}
        <div className="md:hidden space-y-4">
          {!hasInitiallyLoaded ? (
            <>
              <div className="bg-background border border-border p-4 shadow-sm space-y-3">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
              <div className="bg-background border border-border p-4 shadow-sm space-y-3">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            </>
          ) : userData?.workerData ? (
            userData.workerData.map((worker) => (
              <div key={worker.id} className="bg-background border border-border p-4 shadow-sm">
                {/* <Link href={`/worker/${worker.id}`} className="text-foreground font-bold text-lg block mb-2 hover:underline"> */}
                <Link href='#' className="text-foreground font-bold text-lg block mb-2 hover:underline">
                  {worker.name}
                </Link>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Hashrate</p>
                    <p className="font-medium">{formatHashrate(parseHashrate(worker.hashrate))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Best Difficulty</p>
                    <p className="font-medium">{formatDifficulty(worker.bestDifficulty)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Last Submission</p>
                    <p className="font-medium">{formatRelativeTime(parseInt(worker.lastSubmission))}</p>
                  </div>
                </div>
              </div>
            ))
          ) : null}
        </div>
        </div>
      )}
      </main>
    </>
  );
}
