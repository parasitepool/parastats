'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl bg-background border border-foreground p-6 shadow-xl">
        <div className="flex flex-col items-center text-center mb-6">
          <h1 className="text-3xl font-medium text-foreground mb-2">404 - Page Not Found</h1>
          <p className="text-foreground/70 mb-4">
            The page you are looking for does not exist or has been moved.
          </p>
          
          <div className="flex gap-4 mt-4">
            <Link 
              href="/"
              className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80 focus:outline-none"
            >
              Return home
            </Link>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 border border-foreground cursor-pointer text-foreground text-sm font-medium hover:bg-foreground/10 focus:outline-none"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
