'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../hooks/useWallet';
import { CONNECT_BUTTON_CLASS } from './connect-button-styles';
import { formatAddress } from '@/app/utils/formatters';

interface ConnectButtonProps {
  className?: string;
}

export default function ConnectButton({ className }: ConnectButtonProps) {
  const {
    address,
    isConnected,
    isConnectingXverse,
    disconnect,
    openConnectModal,
  } = useWallet();
  const buttonClassName = className ?? CONNECT_BUTTON_CLASS;
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const handleButtonClick = () => {
    if (isConnected) {
      setShowDropdown((prev) => !prev);
    } else {
      openConnectModal({ initialView: 'choice' });
    }
  };

  const handleGoToAccount = () => {
    if (address) {
      router.push(`/user/${address}`);
      setShowDropdown(false);
    }
  };

  const handleOpenSwitch = () => {
    setShowDropdown(false);
    openConnectModal({ initialView: 'switcher' });
  };

  const handleDisconnect = () => {
    setShowDropdown(false);
    void disconnect();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleButtonClick}
        disabled={isConnectingXverse}
        className={buttonClassName}
      >
        {isConnectingXverse ? (
          'Connecting...'
        ) : isConnected && address ? (
          <>
            <span className="sm:hidden">{formatAddress(address)}</span>
            <span className="hidden sm:inline">{shortenAddress(address)}</span>
          </>
        ) : (
          'Connect'
        )}
      </button>

      {isConnected && showDropdown && (
        <div className="absolute right-0 mt-2 w-48 bg-background border border-gray-300 shadow-lg z-50">
          <button
            onClick={handleGoToAccount}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 hover:text-black text-xs sm:text-sm transition-colors"
          >
            Account
          </button>
          <button
            onClick={handleOpenSwitch}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 hover:text-black text-xs sm:text-sm border-t border-gray-300 transition-colors"
          >
            Switch
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
