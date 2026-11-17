'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useWallet } from '@/app/hooks/useWallet';
import HelpModal from './modals/HelpModal';
import WalletConnectModal, { type WalletConnectView } from './modals/WalletConnectModal';
import { ORDER_BUTTON_CLASS } from './connect-button-styles';
import { isWalletProviderError } from '@/app/utils/xverse';

interface WalletConnectButtonProps {
  children: ReactNode;
  /**
   * Notifies the parent (e.g. an open order modal) while a nested connect
   * modal is open, so the parent can hold off its own Escape handling.
   */
  onOpenChange?: (open: boolean) => void;
}

export default function WalletConnectButton({ children, onOpenChange }: WalletConnectButtonProps) {
  const { connectWithLightning } = useWallet();
  const [connectModalView, setConnectModalView] = useState<WalletConnectView | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const nestedOpen = connectModalView !== null || showHelpModal;
  useEffect(() => {
    onOpenChange?.(nestedOpen);
  }, [nestedOpen, onOpenChange]);

  const openManualConnect = () => {
    setShowHelpModal(false);
    setConnectModalView('manual');
  };

  const handleXverseConnect = async () => {
    setIsConnecting(true);
    try {
      await connectWithLightning();
    } catch (err: unknown) {
      if (isWalletProviderError(err)) setShowHelpModal(true);
      else console.error('Failed to connect:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConnectModalView('choice')}
        disabled={isConnecting}
        className={ORDER_BUTTON_CLASS}
      >
        {isConnecting ? 'Connecting…' : children}
      </button>

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
        // Keep manual connects in the order flow instead of navigating away.
        stayInPlace
      />
    </>
  );
}
