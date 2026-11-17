'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../hooks/useWallet';
import HelpModal from './modals/HelpModal';
import WalletConnectModal, { WalletConnectView } from './modals/WalletConnectModal';
import { CONNECT_BUTTON_CLASS } from './connect-button-styles';
import { isWalletProviderError } from '../utils/xverse';

interface ConnectButtonProps {
  /** Overrides the button classes (used for the full-width mobile menu row). */
  className?: string;
}

export default function ConnectButton({ className }: ConnectButtonProps) {
  const buttonClassName = className ?? CONNECT_BUTTON_CLASS;
  const { address, isConnected, disconnect, connectWithLightning } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [connectModalView, setConnectModalView] = useState<WalletConnectView | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const openManualConnect = () => {
    setShowHelpModal(false);
    setConnectModalView('manual');
  };

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

  const shortenAddress = (addr: string, head = 6) => {
    return `${addr.slice(0, head)}...${addr.slice(-4)}`;
  };

  const handleXverseConnect = async () => {
    setIsConnecting(true);
    try {
      const result = await connectWithLightning();
      if (result) {
        router.push(`/user/${result.address}`);
      }
      // If result is null, user likely cancelled - don't show help modal
    } catch (err: unknown) {
      if (isWalletProviderError(err)) {
        // Xverse is not installed, show help modal
        setShowHelpModal(true);
      } else {
        // Other error (user cancelled, network error, etc.), just log it
        console.error('Failed to connect:', err);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleButtonClick = () => {
    if (isConnected) {
      setShowDropdown(!showDropdown);
    } else {
      setConnectModalView('choice');
    }
  };

  const handleGoToAccount = () => {
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
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleButtonClick}
          disabled={isConnecting}
          className={buttonClassName}
        >
          {isConnecting ? (
            'Connecting...'
          ) : isConnected && address ? (
            <>
              <span className="sm:hidden">{shortenAddress(address, 4)}</span>
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
              onClick={handleDisconnect}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 hover:text-black text-xs sm:text-sm border-t border-gray-300 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        onManualConnect={openManualConnect}
      />

      <WalletConnectModal
        isOpen={connectModalView !== null}
        initialView={connectModalView ?? 'choice'}
        onClose={() => setConnectModalView(null)}
        onXverse={handleXverseConnect}
      />
    </>
  );
}
