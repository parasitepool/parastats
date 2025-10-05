'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../hooks/useWallet';

export default function ConnectButton() {
  const { address, isConnected, connect, disconnect } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleButtonClick = async () => {
    if (isConnected) {
      setShowDropdown(!showDropdown);
    } else {
      const addr = await connect();
      if (addr) {
        router.push(`/user/${addr}`);
      }
    }
  };

  const handleGoToProfile = () => {
    if (address) {
      router.push(`/user/${address}`);
      setShowDropdown(false);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleButtonClick}
        className="cursor-pointer px-4 py-2 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs sm:text-sm font-medium"
      >
        {isConnected && address ? shortenAddress(address) : 'Connect'}
      </button>

      {isConnected && showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-background border border-gray-300 shadow-lg z-50">
          <button
            onClick={handleGoToProfile}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 hover:text-black text-xs sm:text-sm transition-colors"
          >
            Profile
          </button>
          <button
            onClick={handleDisconnect}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 hover:text-black text-xs sm:text-sm border-t border-gray-300 transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
