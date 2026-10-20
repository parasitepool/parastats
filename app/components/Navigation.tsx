'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Dispatch, SetStateAction, useEffect, useRef, useState, KeyboardEvent } from 'react';

import parasiteLogo from '@/public/parasite-white.png';
import ErrorModal from './modals/ErrorModal';
import ConnectButton from './ConnectButton';
import AuctionButton from './AuctionButton';
import { useWallet } from '@/app/hooks/useWallet';
import { formatAddress } from '@/app/utils/formatters';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { address: walletAddress, isConnected, disconnect } = useWallet();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const desktopLinkClass = (href: string) =>
    `flex-shrink-0 h-10 flex items-center justify-center px-3 sm:px-4 border border-border text-xs sm:text-sm font-medium bg-secondary hover:bg-secondary/80 ${
      isActive(href) ? 'nav-active' : ''
    }`;
  const mobileLinkClass = (href: string) =>
    `block px-4 py-3 text-sm font-medium border-t border-border hover:bg-foreground/5 ${
      isActive(href) ? 'nav-active' : ''
    }`;

  // Cmd/Ctrl + K opens the search
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); // Prevent default browser behavior
        // Don't open the search while the error modal is up
        if (!showModal) {
          setSearchOpen(true);
          setMenuOpen(false);
        }
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

  // Close the menu on outside click/tap or Escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: Event) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const openSearch = () => {
    setSearchOpen(true);
    setMenuOpen(false);
  };

  const toggleMenu = () => {
    setMenuOpen(open => !open);
    setSearchOpen(false);
  };

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
    <header className="relative bg-background text-foreground py-5">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-6">
        {/* Left: Logo (hidden on small screens while the search is open) */}
        <Link href="/" className={`flex-shrink-0 ${searchOpen ? 'hidden lg:flex' : 'flex'}`}>
          <Image
            src={parasiteLogo}
            alt="Parasite Logo"
            className="h-10 sm:h-12 lg:h-16 w-auto"
            loading="eager"
          />
        </Link>

        {/* Middle: Search expands into the available space when open */}
        {searchOpen && (
          <div className="flex-1 flex justify-end min-w-0">
            <div className="w-full max-w-md flex justify-end">
              <div
                ref={searchRef}
                className={`relative h-10 transition-all duration-150 ease-out shadow-[0_0_6px_rgba(255,245,180,0.8),0_0_18px_rgba(247,147,26,0.45)] ${
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

        {/* Right: all items inline on md+; hamburger menu below md */}
        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4 ml-auto">
          {!searchOpen && (
            <>
              <div className="hidden lg:contents">
                <button
                  onClick={openSearch}
                  className="flex-shrink-0 h-10 flex items-center justify-center px-3 sm:px-4 bg-secondary border border-border text-xs sm:text-sm font-medium hover:bg-secondary/80"
                  aria-label="Search wallet address"
                >
                  Search
                </button>
                <Link
                  href="/rounds"
                  className={desktopLinkClass('/rounds')}
                >
                  Blocks
                </Link>
                <Link
                  href="/refinery"
                  className={desktopLinkClass('/refinery')}
                >
                  Refinery
                </Link>
                <AuctionButton />
              </div>
              <button
                ref={menuButtonRef}
                onClick={toggleMenu}
                className="lg:hidden flex-shrink-0 h-10 flex items-center justify-center px-3 bg-secondary border border-border hover:bg-secondary/80"
                aria-label="Menu"
                aria-expanded={menuOpen}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </>
          )}
          <div className="hidden lg:contents">
            <ConnectButton />
          </div>
        </div>
      </div>

      {/* Mobile nav menu. Kept mounted while hidden so the ConnectButton
          instance (and any modal it opens) survives the menu closing. */}
      <div
        ref={menuRef}
        className={`lg:hidden absolute top-full left-0 w-full bg-background border-x border-b border-border shadow-lg z-50 ${menuOpen && !searchOpen ? '' : 'hidden'}`}
      >
        <button
          onClick={openSearch}
          className="block w-full text-left px-4 py-3 text-sm font-medium hover:bg-foreground/5 border-t border-border"
        >
          Search
        </button>
        <Link
          href="/rounds"
          onClick={() => setMenuOpen(false)}
          className={mobileLinkClass('/rounds')}
        >
          Blocks
        </Link>
        <Link
          href="/refinery"
          onClick={() => setMenuOpen(false)}
          className={mobileLinkClass('/refinery')}
        >
          Refinery
        </Link>
        <AuctionButton
          className="btn-auction block w-full text-left px-4 py-3 text-sm font-medium hover:bg-foreground/5 border-t border-border"
          onClick={() => setMenuOpen(false)}
        />
        {isConnected && walletAddress ? (
          <>
            <button
              onClick={() => {
                router.push(`/user/${walletAddress}`);
                setMenuOpen(false);
              }}
              className="block w-full text-left px-4 py-3 text-sm font-medium hover:bg-foreground/5 border-t border-border"
            >
              Account <span className="text-foreground/60">({formatAddress(walletAddress)})</span>
            </button>
            <button
              onClick={() => {
                disconnect();
                setMenuOpen(false);
              }}
              className="block w-full text-left px-4 py-3 text-sm font-medium hover:bg-foreground/5 border-t border-border"
            >
              Disconnect <span className="text-foreground/60">({formatAddress(walletAddress)})</span>
            </button>
          </>
        ) : (
          <div className="border-t border-border p-2">
            <ConnectButton className="cursor-pointer h-10 w-full flex items-center justify-center px-4 bg-foreground text-background hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed" />
          </div>
        )}
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
