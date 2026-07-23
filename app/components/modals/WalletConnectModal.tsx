'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isProviderInstalled } from '@sats-connect/core';
import { useWallet } from '@/app/hooks/useWallet';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { SettingsIcon, XverseLogo } from '@/app/components/icons';

const XVERSE_PROVIDER_ID = 'XverseProviders.BitcoinProvider';

export type WalletConnectView = 'choice' | 'manual';

interface WalletConnectModalProps {
  isOpen: boolean;
  initialView?: WalletConnectView;
  onClose: () => void;
  onXverse: () => void;
}

export default function WalletConnectModal({
  isOpen,
  initialView = 'choice',
  onClose,
  onXverse,
}: WalletConnectModalProps) {
  const { connectManual } = useWallet();
  const router = useRouter();
  const [view, setView] = useState<WalletConnectView>(initialView);
  const [manualAddress, setManualAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasXverse, setHasXverse] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setHasXverse(isProviderInstalled(XVERSE_PROVIDER_ID));
    } else {
      setManualAddress('');
      setIsConnecting(false);
      setError(null);
    }
  }, [isOpen, initialView]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscKey);
    }

    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmedAddress = manualAddress.trim();

  const handleXverse = () => {
    onClose();
    onXverse();
  };

  const handleManualConnect = async () => {
    if (!isValidBitcoinAddress(trimmedAddress)) {
      setError('Enter a valid Bitcoin address');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const result = await connectManual(trimmedAddress);
      if (result) {
        onClose();
        router.push(`/user/${result}`);
      } else {
        setError('Enter a valid Bitcoin address');
      }
    } catch (err) {
      console.error('Manual connect error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isConnecting) {
      handleManualConnect();
    }
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-background border border-foreground p-4 sm:p-6 ${view === 'choice' ? 'max-w-xs' : 'max-w-md'} w-full mx-4 shadow-xl relative`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-start gap-4 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-accent-3">Connect a Wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {view === 'choice' ? (
          <div className="grid grid-cols-2 gap-5 py-4">
            <div className="relative group">
              <button
                onClick={handleXverse}
                disabled={!hasXverse}
                aria-label="Connect with Xverse"
                className="w-full aspect-square flex flex-col items-center justify-center gap-2 border border-border hover:bg-secondary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <XverseLogo className="w-12 h-12" />
                <span className="text-sm font-medium">Xverse</span>
              </button>
              {!hasXverse && (
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-max p-2 bg-background border border-border shadow-lg text-xs z-10">
                  Xverse extension not detected
                </div>
              )}
            </div>
            <button
              onClick={() => setView('manual')}
              aria-label="Connect manually"
              className="aspect-square flex flex-col items-center justify-center gap-2 border border-border hover:bg-secondary-hover transition-colors"
            >
              <SettingsIcon className="w-12 h-12" />
              <span className="text-sm font-medium">Manual</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-secondary border border-border p-3 text-sm text-foreground/80">
              Enter the Bitcoin address you mine with. You&apos;ll approve actions by signing messages with your wallet of choice.
              Please make sure it supports BIP322 generic message signing.
            </div>

            <div>
              <label className="block text-sm font-medium text-accent-2 mb-2" htmlFor="manual-connect-address">
                Bitcoin address
              </label>
              <input
                id="manual-connect-address"
                value={manualAddress}
                onChange={(event) => setManualAddress(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="bc1q..."
                autoFocus
                disabled={isConnecting}
                className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent-3 font-mono text-sm disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setView('choice');
                  setError(null);
                }}
                disabled={isConnecting}
                className="px-4 py-2 border border-border hover:bg-secondary-hover text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                onClick={handleManualConnect}
                disabled={isConnecting || !trimmedAddress}
                className="px-4 py-2 bg-foreground text-background hover:bg-foreground/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
