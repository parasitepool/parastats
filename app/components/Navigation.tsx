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
  const backdropRef = useRef<HTMLDivElement>(null);
  const menuOpenRef = useRef(false);
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

  // Close the menu on Escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Close the drawer when growing past the mobile breakpoint (e.g. rotating
  // a tablet), so scroll never stays locked on a hidden drawer.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  // Drag gestures for the drawer: drag left from the right screen edge to
  // open it, drag right on the open drawer or backdrop to close it. On
  // Android the edge drag can race the system back gesture.
  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    const EDGE_PX = 24;
    const DRAWER_WIDTH_PX = 256; // w-64
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let dragging = false;
    let snapTimer: number | undefined;

    const handleTouchStart = (e: TouchEvent) => {
      // The drawer only exists below the lg breakpoint.
      if (window.matchMedia('(min-width: 1024px)').matches) return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      dragging = false;
      if (menuOpenRef.current) {
        const target = e.target as Node;
        tracking = !!(menuRef.current?.contains(target) || backdropRef.current?.contains(target));
      } else {
        tracking = startX >= window.innerWidth - EDGE_PX;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const drawer = menuRef.current;
      const backdrop = backdropRef.current;
      if (!drawer || !backdrop) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (!dragging) {
        // Wait for meaningful movement, then require horizontal intent in
        // the right direction (left to open, right to close).
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        if (Math.abs(dy) > Math.abs(dx) || (menuOpenRef.current ? dx <= 0 : dx >= 0)) {
          tracking = false;
          return;
        }
        dragging = true;
        // 1:1 finger tracking: no transitions mid-drag, and the closed
        // drawer (invisible class) must be force-shown.
        drawer.style.transition = 'none';
        backdrop.style.transition = 'none';
        drawer.style.visibility = 'visible';
      }
      // Stop the page from scrolling while the drawer follows the finger.
      e.preventDefault();
      const offset = menuOpenRef.current
        ? Math.min(Math.max(dx, 0), DRAWER_WIDTH_PX)
        : Math.min(Math.max(DRAWER_WIDTH_PX + dx, 0), DRAWER_WIDTH_PX);
      drawer.style.translate = `${offset}px 0`;
      backdrop.style.opacity = String(1 - offset / DRAWER_WIDTH_PX);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      const drawer = menuRef.current;
      const backdrop = backdropRef.current;
      if (!drawer || !backdrop) return;
      const dx = e.changedTouches[0].clientX - startX;
      // Commit when dragged past half the drawer width.
      const open = menuOpenRef.current
        ? dx < DRAWER_WIDTH_PX / 2
        : dx < -DRAWER_WIDTH_PX / 2;
      // Re-enable the class transitions and snap to the final position.
      drawer.style.transition = '';
      backdrop.style.transition = '';
      drawer.style.translate = open ? '0px 0' : `${DRAWER_WIDTH_PX}px 0`;
      backdrop.style.opacity = open ? '1' : '0';
      // Sync React state once the snap animation finished, then drop the
      // inline overrides so the classes take over (same visual state).
      snapTimer = window.setTimeout(() => {
        if (open) setSearchOpen(false);
        setMenuOpen(open);
        drawer.style.translate = '';
        drawer.style.visibility = '';
        backdrop.style.opacity = '';
      }, 200);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    // Not passive: preventDefault stops the page scrolling mid-drag.
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
      window.clearTimeout(snapTimer);
    };
  }, []);

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
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-6 -mx-2">
        {/* Left: Logo (hidden on small screens while the search is open) */}
        <Link href="/" onClick={() => setMenuOpen(false)} className={`flex-shrink-0 ${searchOpen ? 'hidden lg:flex' : 'flex'}`}>
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
              {/* z-50 keeps the X above the drawer (z-40) and backdrop
                  (z-30); the logo stays behind them. */}
              <button
                onClick={toggleMenu}
                className="lg:hidden relative z-50 flex-shrink-0 h-10 flex items-center justify-center px-3 bg-secondary border border-border hover:bg-secondary/80"
                aria-label="Menu"
                aria-expanded={menuOpen}
              >
                {/* Hamburger morphs into an X via crossfade + rotation */}
                <span className="relative block h-5 w-5">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`absolute inset-0 h-5 w-5 transition-all duration-200 ${menuOpen ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`absolute inset-0 h-5 w-5 transition-all duration-200 ${menuOpen ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </button>
            </>
          )}
          <div className="hidden lg:contents">
            <ConnectButton />
          </div>
        </div>
      </div>

      {/* Backdrop for the mobile drawer; tap to close */}
      <div
        ref={backdropRef}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
        className={`lg:hidden fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 ${
          menuOpen && !searchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Mobile nav drawer, sliding in from the right. Kept mounted while
          hidden so the ConnectButton instance (and any modal it opens)
          survives the menu closing. The top padding matches the header
          height (py-5 + h-10 logo, h-12 at sm) so the items start below
          the header and the X sits in the panel's empty header area. No
          translate in the open state: a translated ancestor becomes the
          containing block for fixed descendants, which would trap modals
          (e.g. wallet connect) inside the drawer. */}
      <div
        ref={menuRef}
        aria-hidden={!(menuOpen && !searchOpen)}
        className={`lg:hidden fixed inset-y-0 right-0 z-40 w-64 overflow-y-auto bg-background border-l border-border shadow-lg pt-20 sm:pt-[88px] transition-[translate,visibility] duration-200 ease-out ${
          menuOpen && !searchOpen
            ? 'visible'
            : 'translate-x-full invisible pointer-events-none'
        }`}
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
