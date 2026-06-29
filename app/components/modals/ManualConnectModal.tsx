'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/app/hooks/useWallet';
import { isValidBitcoinAddress } from '@/app/utils/validators';

interface ManualConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ManualConnectModal({ isOpen, onClose }: ManualConnectModalProps) {
  const { connectManual } = useWallet();
  const router = useRouter();
  const [manualAddress, setManualAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when the modal closes
  useEffect(() => {
    if (!isOpen) {
      setManualAddress('');
      setIsConnecting(false);
      setError(null);
    }
  }, [isOpen]);

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

  const handleConnect = async () => {
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
      handleConnect();
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
        className="bg-background border border-foreground p-4 sm:p-6 max-w-md w-full mx-4 shadow-xl relative"
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

        <div className="space-y-4">
          <div className="bg-secondary border border-border p-3 text-sm text-foreground/80">
            Enter the Bitcoin address you mine with. You&apos;ll approve actions (like dispenser claims
            or the privacy toggle) by signing a message with your own wallet, such as Sparrow.
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
              onClick={onClose}
              disabled={isConnecting}
              className="px-4 py-2 border border-border hover:bg-secondary-hover text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={isConnecting || !trimmedAddress}
              className="px-4 py-2 bg-foreground text-background hover:bg-foreground/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
