'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BlockError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Block page error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center py-8">
      <div className="text-center max-w-md">
        <div className="text-accent-3 mb-6">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-20 w-20 mx-auto" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold mb-3 text-foreground">
          Something went wrong
        </h2>
        
        <p className="text-accent-2 mb-6">
          An error occurred while loading the block data. This could be due to a network issue or invalid data.
        </p>

        {error.digest && (
          <p className="text-xs text-accent-3 mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 border border-accent-1 text-accent-1 hover:bg-accent-1/10 transition-colors"
          >
            Try again
          </button>
          
          <Link
            href="/"
            className="px-6 py-2 border border-border hover:bg-foreground/5 transition-colors"
          >
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}



