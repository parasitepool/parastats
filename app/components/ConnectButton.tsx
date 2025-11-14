'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../hooks/useWallet';
import HelpModal from './modals/HelpModal';

export default function ConnectButton() {
  const { address, isConnected, disconnect, connectWithLightning } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
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
      setIsConnecting(true);
      try {
        // Try to connect with Xverse directly
        const result = await connectWithLightning();
        if (result) {
          router.push(`/user/${result.address}`);
        }
        // If result is null, user likely cancelled - don't show help modal
      } catch (err: unknown) {
        // Check if error indicates Xverse is not installed
        const errorMessage = (err instanceof Error ? err.message : String(err)) || '';
        const errorString = errorMessage.toLowerCase();
        
        // Check for error code/name if err is an object
        const errorObj = err && typeof err === 'object' ? err as { code?: string; name?: string } : null;
        const errorCode = errorObj?.code;
        const errorName = errorObj?.name;
        
        // Common error patterns when Xverse extension is not installed
        const isExtensionNotFound = (
          errorString.includes('no wallet provider') ||
          errorString.includes('wallet provider was found') ||
          errorString.includes('extension') ||
          errorString.includes('not found') ||
          errorString.includes('not installed') ||
          errorString.includes('no provider') ||
          errorString.includes('provider not found') ||
          errorString.includes('window.btc') ||
          errorString.includes('sats-connect') ||
          errorCode === 'EXTENSION_NOT_FOUND' ||
          errorName === 'ExtensionNotFoundError' ||
          errorName === 'ProviderNotFoundError'
        );
        
        if (isExtensionNotFound) {
          // Xverse is not installed, show help modal
          setShowHelpModal(true);
        } else {
          // Other error (user cancelled, network error, etc.), just log it
          console.error('Failed to connect:', err);
        }
      } finally {
        setIsConnecting(false);
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
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleButtonClick}
          disabled={isConnecting}
          className="cursor-pointer px-4 py-2 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? (
            'Connecting...'
          ) : isConnected && address ? (
            shortenAddress(address)
          ) : (
            'Connect'
          )}
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

      <HelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
      />
    </>
  );
}
