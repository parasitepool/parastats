'use client';

import type { ReactNode } from 'react';
import { useWallet } from '@/app/hooks/useWallet';
import { ORDER_BUTTON_CLASS } from './connect-button-styles';

interface WalletConnectButtonProps {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export default function WalletConnectButton({ children, onOpenChange }: WalletConnectButtonProps) {
  const { isConnectingXverse, openConnectModal } = useWallet();

  return (
    <button
      type="button"
      onClick={() =>
        openConnectModal({
          initialView: 'choice',
          stayInPlace: true,
          onOpenChange,
        })
      }
      disabled={isConnectingXverse}
      className={ORDER_BUTTON_CLASS}
    >
      {isConnectingXverse ? 'Connecting…' : children}
    </button>
  );
}
