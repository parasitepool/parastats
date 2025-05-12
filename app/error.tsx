'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Log error to console still too, could later push this to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl bg-background border border-foreground p-6 shadow-xl">
        <div className="flex flex-col items-center text-center mb-6">
          <h1 className="text-3xl font-medium text-foreground mb-2">Something went wrong</h1>
          <p className="text-foreground/70 mb-4">
            We encountered an unexpected error while processing your request.
          </p>
          
          <div className="flex gap-4 mt-2">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none"
            >
              Try again
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 border border-foreground text-foreground text-sm font-medium hover:bg-foreground/10 focus:outline-none"
            >
              Return home
            </button>
          </div>
        </div>

        <div className="w-full mt-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-2 bg-foreground/10 text-foreground text-sm font-medium hover:bg-foreground/20 focus:outline-none"
          >
            <span>Technical Details</span>
            <span>{showDetails ? '−' : '+'}</span>
          </button>
          
          {showDetails && (
            <div className="mt-2 p-4 bg-black/20 border border-foreground/30 overflow-auto max-h-80">
              <p className="font-mono text-sm text-foreground/80 whitespace-pre-wrap">
                {error.message}
                {error.stack && (
                  <>
                    <br />
                    <br />
                    {error.stack}
                  </>
                )}
                {error.digest && (
                  <>
                    <br />
                    <br />
                    Error ID: {error.digest}
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
