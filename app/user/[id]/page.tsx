'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import UserAddressHelp from '../../components/UserAddressHelp';
import HashrateChart from '../../components/HashrateChart';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { getUserData, getHistoricalUserStats, getHashrate } from '@/app/utils/api';
import { ProcessedUserData } from '@/app/api/user/[address]/route';
import { HistoricalUserStats } from '@/app/api/user/[address]/historical/route';
import { Hashrate } from '@mempool/mempool.js/lib/interfaces/bitcoin/difficulty';
import SortableTable from '../../components/SortableTable';
import { formatDifficulty, formatHashrate, formatRelativeTime } from '@/app/utils/formatters';
import { parseHashrate } from '@/app/utils/formatters';

export default function UserDashboard() {
  const params = useParams();
  const userId = params.id as string;
  const [isValidAddress, setIsValidAddress] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<ProcessedUserData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalUserStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hashrate, setHashrate] = useState<Hashrate>();
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Function to check if the address is valid and fetch user data
  useEffect(() => {
    let mounted = true;

    const fetchUserData = async () => {
      try {
        // Only set loading on initial fetch (when userData is null)
        if (!userData) {
          setIsLoading(true);
        }
        
        // First check if the address is valid
        const isValid = isValidBitcoinAddress(userId.trim());
        
        if (mounted) {
          setIsValidAddress(isValid);
          
          if (isValid) {
            // Fetch user data and hashrate in parallel
            const [data, hashrateData] = await Promise.all([
              getUserData(userId),
              getHashrate()
            ]);
            if (mounted) {
              setUserData(data);
              setHashrate(hashrateData);
            }
          }
        }
      } catch (error) {
        if (mounted) {
          if (error instanceof Error && error.message.includes('404')) {
            // For 404 errors, treat as invalid address
            setIsValidAddress(false);
            setUserData(null);
          } else {
            console.error('Error fetching user data:', error);
            setError('Failed to fetch user data. Please try again later.');
            setUserData(null);
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
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
  }, [userId]);

  // Function to fetch historical data
  useEffect(() => {
    let mounted = true;

    const fetchHistoricalData = async () => {
      if (!isValidAddress) return;
      
      try {
        const data = await getHistoricalUserStats(userId);
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

  // Stat cards configuration
  const statCards = [
    {
      title: 'Uptime',
      value: userData?.uptime,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      title: 'Last Submission',
      value: userData?.lastSubmission,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
        '-',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      title: 'Hashrate',
      value: formatHashrate(userData?.hashrate),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
        </svg>
      )
    }
  ];

  // Show loading state only on initial load
  if (isLoading && !userData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-foreground border-t-transparent rounded-full"></div>
        <p className="mt-4">Loading user data...</p>
      </div>
    );
  }

  // Show error message if there was an error fetching data
  if (error) {
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

  // Show help component for invalid addresses
  if (!isValidAddress || !userData) {
    return <UserAddressHelp address={userId} />;
  }

  // Show dashboard for valid addresses
  return (
    <main className="flex min-h-screen flex-col items-start py-8">
      <div className="w-full mb-2">
        <h1 className="text-2xl lg:text-3xl font-bold mb-4 wrap-anywhere text-ellipsis line-clamp-1">{userId}</h1>
        
        {/* Stats Cards */}
        <div className="w-full">
          <div className="flex flex-wrap -mx-2">
            {statCards.map((card, index) => (
              <div key={index} className="w-1/2 md:w-1/4 p-1 lg:p-2">
                <div className="bg-background p-4 shadow-md border border-border h-full">
                  <div className="flex items-center mb-2">
                    <div className="mr-2 text-accent-3">
                      {card.icon}
                    </div>
                    <h3 className="text-sm font-medium text-accent-2">{card.title}</h3>
                  </div>
                  <p className="text-2xl font-semibold">{card.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hashrate Chart */}
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
            hashrates: historicalData.map(d => d.hashrate)
          } : undefined}
          loading={!historicalData}
        />
      </div>
      
      {/* Mining Projections - Uncomment when UserMiningStats is implemented */}
      {/* <UserMiningStats 
        userHashrate={userData.displayHashrate}
        minerWattages={minerWattages}
        electricityRate={0.10} // Example electricity rate in dollars per kWh
      /> */}
      
      {/* Workers Table/Cards */}
      <div className="w-full bg-background pb-6 shadow-md">
        <h2 className="text-xl font-semibold mb-4">Miners({userData.workerData.length})</h2>
        
        {/* Desktop Table - Hidden on mobile */}
        <div className="hidden md:block">
          <SortableTable
            data={userData.workerData}
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (value, worker) => (
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
        </div>
        
        {/* Mobile Cards - Visible only on mobile */}
        <div className="md:hidden space-y-4">
          {userData.workerData.map((worker) => (
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
          ))}
        </div>
      </div>
    </main>
  );
} 