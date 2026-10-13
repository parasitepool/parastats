'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Dispatch, SetStateAction, useEffect, useRef, useState, KeyboardEvent } from 'react';

import parasiteLogo from '@/public/parasite-white.png';
import bugLogo from '@/public/bug.png';
import ErrorModal from './modals/ErrorModal';
import ConnectButton from './ConnectButton';
import AuctionButton from './AuctionButton';

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl + K opens the search
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); // Prevent default browser behavior
        // Don't open the search while the error modal is up
        if (!showModal) setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showModal]);

  // Trigger the expand animation and focus the input after opening
  useEffect(() => {
    if (searchOpen) {
      const frame = requestAnimationFrame(() => setSearchExpanded(true));
      inputRef.current?.focus();
      return () => cancelAnimationFrame(frame);
    } else {
      setSearchExpanded(false);
    }
  }, [searchOpen]);

  // Close the search when clicking/tapping anywhere outside of it
  useEffect(() => {
    if (!searchOpen) return;

    const handleClickOutside = (e: Event) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };

    // Capture phase so it still fires if inner elements stop propagation
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [searchOpen]);

  const handleSubmit = () => {
    onAddressSubmit(address);
    setSearchOpen(false);
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  return (
    <header className="bg-background text-foreground py-5">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-6">
        {/* Left: Logo (bug on mobile, wordmark on md and up) */}
        <Link href="/" className="flex flex-shrink-0 max-[420px]:w-full max-[420px]:justify-center">
          <Image
            src={bugLogo}
            alt="Parasite Logo"
            className="h-10 w-auto invert md:hidden"
            loading="eager"
          />
          <Image
            src={parasiteLogo}
            alt="Parasite Logo"
            className="hidden md:block h-12 lg:h-16 w-auto"
            loading="eager"
          />
        </Link>

        {/* Middle: Search expands into the available space when open */}
        {searchOpen && (
          <div className="flex-1 flex justify-end min-w-0">
            <div className="w-full max-w-md flex justify-end">
              <div
                ref={searchRef}
                className={`relative h-10 transition-all duration-150 ease-out ${
                  searchExpanded ? 'w-full opacity-100' : 'w-10 opacity-0'
                }`}
              >
                <input
                  ref={inputRef}
                  autoFocus
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Enter your wallet address..."
                  className="w-full h-10 pl-3 pr-9 bg-background border border-gray-300 focus:outline-none focus:ring-2 focus:ring-foreground text-xs sm:text-sm"
                  suppressHydrationWarning
                />
                <button
                  onClick={handleSubmit}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right: Search + Auction + Connect Button */}
        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4 ml-auto">
          {!searchOpen && (
            <>
              <button
                onClick={() => setSearchOpen(true)}
                className="flex-shrink-0 h-10 flex items-center justify-center px-3 sm:px-4 bg-secondary border border-border text-xs sm:text-sm font-medium hover:bg-secondary/80"
                aria-label="Search wallet address"
              >
                Search
              </button>
              <Link
                href="/rounds"
                className="flex-shrink-0 h-10 flex items-center justify-center px-3 sm:px-4 bg-secondary border border-border text-xs sm:text-sm font-medium hover:bg-secondary/80"
              >
                Blocks
              </Link>
              <AuctionButton />
            </>
          )}
          <ConnectButton />
        </div>
      </div>
      
      {/* Error Modal */}
      <ErrorModal 
        isOpen={showModal}
        message={errorMessage}
        onClose={() => setShowModal(false)}
      />
    </header>
  );
}
