'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef, KeyboardEvent, Dispatch, SetStateAction, useEffect } from 'react';

import parasiteLogo from '@/public/parasite-white.png';
import ErrorModal from './modals/ErrorModal';
import ConnectButton from './ConnectButton';

interface NavigationProps {
  address?: string;
  setAddress?: Dispatch<SetStateAction<string>>;
  errorMessage?: string;
  showModal?: boolean;
  setShowModal?: Dispatch<SetStateAction<boolean>>;
  onAddressSubmit?: (address: string) => void;
}

export default function Navigation({ 
  address = '',
  setAddress = () => {},
  errorMessage = '',
  showModal = false,
  setShowModal = () => {},
  onAddressSubmit = () => {}
}: NavigationProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onAddressSubmit(address);
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      // Check for Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); // Prevent default browser behavior
        inputRef.current?.focus();
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleGlobalKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  return (
    <header className={`bg-background text-foreground py-4`}>
      <div className="container mx-auto flex items-end gap-4">
        {/* Left: Logo */}
        <Link href="/" className="hidden sm:flex flex-shrink-0 w-[200px] lg:w-[300px] justify-start">
          <Image src={parasiteLogo} alt="Parasite Logo" height={64} />
        </Link>

        {/* Center: Search input or user/worker name */}
        <div className="flex-grow flex justify-center">
            <div className="relative w-full max-w-md">
              <input
                ref={inputRef}
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your wallet address... (Ctrl/Cmd + K)"
                className="w-full py-2 px-2 xl:px-4 bg-background border border-gray-300 focus:outline-none focus:ring-2 focus:ring-foreground text-xs xl:text-sm"
              />
              <button 
                onClick={() => onAddressSubmit(address)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-background text-gray-400 hover:text-gray-600"
                aria-label="Search"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
        </div>

        {/* Right: Connect Button */}
        <div className="flex-shrink-0 flex items-center space-x-4 w-auto sm:w-[200px] lg:w-[300px] justify-end">
          <ConnectButton />
          {/* <Link href="/" className="hidden sm:block">
            <Image src={parasiteBug} alt="Parasite Bug" height={64} className='h-10 sm:h-12 w-auto' />
          </Link> */}
        </div>

        {/* Right: Pool status */}
        {/* <div className="flex-shrink-0 flex items-center space-x-4">
          <div className="flex flex-col items-end text-sm">
            <span className="text-xs text-foreground">{poolStatus.users} users</span>
            <span className="text-xs text-foreground">{poolStatus.workers} miners</span>
          </div>
        </div> */}
      </div>
      
      {/* Error Modal */}
      <ErrorModal 
        isOpen={showModal}
        message={errorMessage}
        onClose={() => {
          setShowModal(false);
          inputRef.current?.focus();
        }}
      />
    </header>
  );
} 
