'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getUserData } from '@/app/utils/api';
import { ProcessedWorkerData } from '@/app/api/user/[address]/route';
import { formatHashrate, formatDifficulty, formatRelativeTime } from '@/app/utils/formatters';
import { TrendingUpIcon, CheckIcon, ClockIcon } from '@/app/components/icons';

export default function WorkerDashboard() {
  const params = useParams();
  const workerId = decodeURIComponent(params.id as string);
  const [workerData, setWorkerData] = useState<ProcessedWorkerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract user address from worker ID (format: address.workername)
  const userAddress = workerId.split('.')[0];

  useEffect(() => {
    let mounted = true;

    const fetchWorkerData = async () => {
      try {
        const userData = await getUserData(userAddress);
        const worker = userData.workerData.find(w => w.id === workerId);
        
        if (!worker) {
          throw new Error('Worker not found');
        }

        if (mounted) {
          setWorkerData(worker);
          setError(null);
        }
      } catch (error) {
        if (mounted) {
          console.error('Error fetching worker data:', error);
          setError('Failed to fetch worker data. Please try again later.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Initial fetch
    fetchWorkerData();
    
    const intervalId: NodeJS.Timeout = setInterval(fetchWorkerData, 10000); // 10s refresh
    
    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [workerId, userAddress]);

  // Update the Navigation component with the current worker information
  useEffect(() => {
    const navigationElement = document.querySelector('header');
    
    if (navigationElement) {
      const workerDisplayElement = navigationElement.querySelector('div.text-lg');
      
      if (workerDisplayElement && workerData) {
        workerDisplayElement.textContent = `Worker: ${workerData.name}`;
      }
    }
  }, [workerData]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-foreground border-t-transparent rounded-full"></div>
        <p className="mt-4">Loading worker data...</p>
      </div>
    );
  }

  if (error || !workerData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-center">{error || 'Worker not found'}</p>
        <Link href={`/user/${userAddress}`} className="mt-4 text-accent-3 hover:underline">
          Return to User Dashboard
        </Link>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-start py-8">
      <div className="w-full mb-2">
        <h1 className="text-2xl lg:text-3xl font-bold mb-4 wrap-anywhere text-ellipsis line-clamp-1">{workerId}</h1>
        
        {/* Stats Cards */}
        <div className="w-full">
          <div className="flex flex-wrap -mx-2">
            <div className="w-1/2 md:w-1/4 p-1 lg:p-2">
              <div className="bg-background p-4 shadow-md border border-border h-full">
                <div className="flex items-center mb-2">
                  <div className="mr-2 text-accent-3">
                    <TrendingUpIcon />
                  </div>
                  <h3 className="text-sm font-medium text-accent-2">Hashrate</h3>
                </div>
                <p className="text-2xl font-semibold">{formatHashrate(parseFloat(workerData.hashrate))}</p>
              </div>
            </div>

            <div className="w-1/2 md:w-1/4 p-1 lg:p-2">
              <div className="bg-background p-4 shadow-md border border-border h-full">
                <div className="flex items-center mb-2">
                  <div className="mr-2 text-accent-3">
                    <TrendingUpIcon />
                  </div>
                  <h3 className="text-sm font-medium text-accent-2">Best Difficulty</h3>
                </div>
                <p className="text-2xl font-semibold">{formatDifficulty(workerData.bestDifficulty)}</p>
              </div>
            </div>

            <div className="w-1/2 md:w-1/4 p-1 lg:p-2">
              <div className="bg-background p-4 shadow-md border border-border h-full">
                <div className="flex items-center mb-2">
                  <div className="mr-2 text-accent-3">
                    <CheckIcon />
                  </div>
                  <h3 className="text-sm font-medium text-accent-2">Last Share</h3>
                </div>
                <p className="text-2xl font-semibold">{formatRelativeTime(parseInt(workerData.lastSubmission))}</p>
              </div>
            </div>

            <div className="w-1/2 md:w-1/4 p-1 lg:p-2">
              <div className="bg-background p-4 shadow-md border border-border h-full">
                <div className="flex items-center mb-2">
                  <div className="mr-2 text-accent-3">
                    <ClockIcon />
                  </div>
                  <h3 className="text-sm font-medium text-accent-2">Status</h3>
                </div>
                <p className="text-2xl font-semibold">
                  {parseInt(workerData.lastSubmission) > (Date.now() / 1000 - 600) ? (
                    <span className="text-green-500">Active</span>
                  ) : (
                    <span className="text-red-500">Inactive</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Worker Details */}
      <div className="w-full mt-8">
        <div className="bg-background p-6 rounded-lg shadow-md border border-border">
          <h2 className="text-xl font-semibold mb-4">Worker Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-accent-2 mb-1">Worker Name</p>
              <p className="text-lg font-medium">{workerData.name}</p>
            </div>
            <div className="md:col-span-2">
              <Link 
                href={`/user/${userAddress}`}
                className="inline-block mt-4 px-4 py-2 bg-accent-3 text-white rounded hover:bg-accent-4 transition-colors"
              >
                View User Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
