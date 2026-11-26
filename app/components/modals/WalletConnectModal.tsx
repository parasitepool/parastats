'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isProviderInstalled } from '@sats-connect/core';
import { isValidBitcoinAddress } from '@/app/utils/validators';
import { isMobileDevice, XVERSE_PROVIDER_ID } from '@/app/utils/xverse';
import { formatAddress } from '@/app/utils/formatters';
import { SettingsIcon, XverseLogo } from '@/app/components/icons';
import type { SavedWallet } from '@/app/utils/wallet-storage';

export type WalletConnectView = 'switcher' | 'choice' | 'manual';

interface WalletConnectModalProps {
  isOpen: boolean;
  initialView?: WalletConnectView;
  stayInPlace?: boolean;
  isConnectingXverse?: boolean;
  wallets: SavedWallet[];
  activeWallet: SavedWallet | null;
  onClose: () => void;
  onXverse: () => void;
  onSwitchWallet: (address: string) => Promise<void>;
  onRemoveWallet: (address: string) => Promise<void>;
  onDisconnectWallet: () => Promise<void>;
  onConnectManual: (address: string) => Promise<string | null>;
}

export default function WalletConnectModal({
  isOpen,
  initialView = 'choice',
  stayInPlace = false,
  isConnectingXverse = false,
  wallets,
  activeWallet,
  onClose,
  onXverse,
  onSwitchWallet,
  onRemoveWallet,
  onDisconnectWallet,
  onConnectManual,
}: WalletConnectModalProps) {
  const router = useRouter();
  const [view, setView] = useState<WalletConnectView>(initialView);
  const [manualAddress, setManualAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasXverse, setHasXverse] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setHasXverse(isProviderInstalled(XVERSE_PROVIDER_ID));
      setIsMobile(isMobileDevice());
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

  const handleSelectWallet = async (wallet: SavedWallet) => {
    const wasDisconnected = !activeWallet;
    await onSwitchWallet(wallet.address);

    if (!stayInPlace && wasDisconnected) {
      router.push(`/user/${wallet.address}`);
    }

    onClose();
  };

  const handleRemoveWallet = async (event: React.MouseEvent, walletAddress: string) => {
    event.stopPropagation();
    const willBeEmpty = wallets.length <= 1;
    await onRemoveWallet(walletAddress);
    if (willBeEmpty && view === 'switcher') {
      setView('choice');
    }
  };

  const handleDisconnectWallet = async (event: React.MouseEvent) => {
    event.stopPropagation();
    const willBeEmpty = wallets.length <= 1;
    await onDisconnectWallet();
    if (willBeEmpty && view === 'switcher') {
      setView('choice');
    }
  };

  const handleManualConnect = async () => {
    if (!isValidBitcoinAddress(trimmedAddress)) {
      setError('Enter a valid Bitcoin address');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const result = await onConnectManual(trimmedAddress);
      if (result) {
        onClose();
        if (!stayInPlace) router.push(`/user/${result}`);
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

  const modalTitle =
    view === 'switcher' ? 'Switch Wallet' : view === 'choice' ? 'Add' : null;
  const widthClass = view === 'choice' ? 'w-fit max-w-[21rem]' : 'w-full max-w-md';
  const showBack = view === 'manual' || (view === 'choice' && activeWallet);
  const headerHasContent = Boolean(showBack || modalTitle);
  const backDisabled = view === 'manual' && isConnecting;

  const handleBack = () => {
    if (view === 'manual') {
      setView('choice');
      setError(null);
    } else if (view === 'choice') {
      setView('switcher');
    }
  };

  const renderWalletList = (list: SavedWallet[], showActiveBadge: boolean) => (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {list.map((wallet) => {
        const isActive = showActiveBadge && activeWallet?.address === wallet.address;

        return (
          <div
            key={wallet.address}
            className={`flex items-center justify-between gap-2 border p-2.5 transition-colors ${
              isActive
                ? 'border-accent-3 bg-secondary'
                : 'border-border hover:bg-secondary-hover'
            }`}
          >
            <button
              type="button"
              onClick={() => handleSelectWallet(wallet)}
              className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left"
            >
              <div className="min-w-0 flex items-center gap-2">
                {wallet.type === 'xverse' ? (
                  <XverseLogo className="w-5 h-5 flex-shrink-0" />
                ) : (
                  <SettingsIcon className="w-5 h-5 flex-shrink-0 text-foreground/70" />
                )}
                <div className="min-w-0">
                  <div className="font-mono text-sm text-foreground truncate">
                    {formatAddress(wallet.address)}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-foreground/60">
                    {isActive ? (
                      <span className="text-green-500 font-medium">Active</span>
                    ) : (
                      <span>{wallet.type === 'xverse' ? 'XVERSE' : 'Manual'}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={(event) =>
                isActive
                  ? handleDisconnectWallet(event)
                  : handleRemoveWallet(event, wallet.address)
              }
              className="p-1.5 text-foreground/50 hover:text-red-400 transition-colors flex-shrink-0"
              title={isActive ? 'Disconnect active wallet' : 'Remove saved wallet'}
              aria-label={isActive ? `Disconnect ${wallet.address}` : `Remove ${wallet.address}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className={`bg-background border border-foreground p-4 sm:p-6 ${widthClass} mx-4 shadow-xl relative`}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 ${
            headerHasContent ? 'min-h-[38px] mb-2' : 'mb-1'
          }`}
        >
          <div className="flex justify-start">
            {showBack && (
              <button
                type="button"
                onClick={handleBack}
                disabled={backDisabled}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
          </div>
          {modalTitle ? (
            <h2 className="text-center text-xl sm:text-2xl font-bold text-accent-3">{modalTitle}</h2>
          ) : (
            <div />
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {view === 'switcher' ? (
          <div className="space-y-4">
            {wallets.length > 0 ? (
              renderWalletList(wallets, true)
            ) : (
              <p className="text-sm text-foreground/60">No saved wallets yet.</p>
            )}

            <button
              type="button"
              onClick={() => setView('choice')}
              className="w-full py-2.5 border border-border hover:bg-secondary-hover text-sm font-medium transition-colors"
            >
              + Add Wallet
            </button>
          </div>
        ) : view === 'choice' ? (
          <div className="space-y-4">
            {!activeWallet && wallets.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-semibold text-accent-2">Saved</h3>
                {renderWalletList(wallets, false)}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-4 sm:gap-5">
              <div className="relative group">
                <button
                  onClick={handleXverse}
                  disabled={(!hasXverse && !isMobile) || isConnectingXverse}
                  aria-label={isMobile && !hasXverse ? 'Open in XVERSE app' : 'Connect with XVERSE'}
                  className="w-[7.5rem] h-[7.5rem] sm:w-32 sm:h-32 flex flex-col items-center justify-center gap-2 border border-border hover:bg-secondary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <XverseLogo className="w-20 h-20" />
                  <span className="text-sm font-medium">
                    {isConnectingXverse ? 'Connecting...' : 'XVERSE'}
                  </span>
                </button>
                {!hasXverse && !isMobile && (
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-max p-2 bg-background border border-border shadow-lg text-xs z-10">
                    XVERSE extension not detected
                  </div>
                )}
              </div>
              <button
                onClick={() => setView('manual')}
                aria-label="Connect manually"
                className="w-[7.5rem] h-[7.5rem] sm:w-32 sm:h-32 flex flex-col items-center justify-center gap-2 border border-border hover:bg-secondary-hover transition-colors"
              >
                <SettingsIcon className="w-20 h-20" />
                <span className="text-sm font-medium">Manual</span>
              </button>
            </div>

            {isMobile && !hasXverse && (
              <p className="text-center text-xs text-foreground/60">
                XVERSE will open this page in its in-app browser and ask you to connect.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-accent-2 mb-2" htmlFor="manual-connect-address">
                Mining address
              </label>
              <input
                id="manual-connect-address"
                value={manualAddress}
                onChange={(event) => setManualAddress(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="bc1p..."
                autoFocus
                disabled={isConnecting}
                className="w-full bg-secondary text-foreground px-3 py-2 border border-border focus:outline-none focus:border-accent-3 font-mono text-sm disabled:opacity-50"
              />
            </div>

            <div className="bg-secondary border border-border p-3 text-sm text-foreground/80">
              Certain actions require BIP322 support, make sure your wallet supports it.
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
                {error}
              </div>
            )}

            <div className="flex justify-center pt-2">
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
