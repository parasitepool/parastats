'use client';

import { useState, useEffect } from 'react';
import { request, RpcErrorCode } from '@sats-connect/core';
import { useWallet } from '@/app/hooks/useWallet';
import { InfoIcon } from '@/app/components/icons';
import type { OrderResponse } from '@/app/api/router/types';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
  address: string;
  hashPrice: number;
}

export default function CreateOrderModal({ isOpen, onClose, onCreated, address, hashPrice }: CreateOrderModalProps) {
  const { address: walletAddress, isConnected } = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [selectedPhd, setSelectedPhd] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedPhd(1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isOwnProfile = isConnected && walletAddress === address;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCreate = async () => {
    setError(null);

    try {
      const res = await fetch('/api/router/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upstream_target: {
            endpoint: 'parasite.wtf:42068',
            username: `${address}.refinery`,
            password: null,
          },
          hash_days: selectedPhd * 1e15,
          hash_price: hashPrice,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `Failed to create order (${res.status})`);
      }

      const data: OrderResponse = await res.json();

      const response = await request('sendTransfer', {
        recipients: [{ address: data.payment_address, amount: data.payment_amount }],
      });

      if (response.status !== 'success') {
        if (response.error?.code === RpcErrorCode.USER_REJECTION) {
          onClose();
          return;
        }
        throw new Error(response.error?.message || 'Failed to send transaction');
      }

      onClose();
      await onCreated?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to create order');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-background border border-foreground p-6 max-w-2xl w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-accent-3">Create Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 focus:outline-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-accent-2 mb-2">Workername</h3>
            <div className="bg-secondary p-3 border border-border">
              <p className="text-foreground break-all">{address}.refinery</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-accent-2 mb-2">Endpoint</h3>
            <div className="bg-secondary p-3 border border-border">
              <p className="text-foreground break-all">parasite.wtf:42068</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-accent-2 mb-2 flex items-center gap-1">
              Work
              <span className="relative inline-flex group">
                <InfoIcon className="h-4 w-4 text-foreground/60 cursor-help" />
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-2 w-56 p-2 bg-background border border-border rounded shadow-lg text-xs font-normal text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  PHd (petahash-day): Work done by 1 PH/s over 1 day. Conceptually like a KWh (kilowatt-hour).
                </span>
              </span>
            </h3>
            <div className="flex gap-2">
              {[1, 9, 99].map(phd => (
                <button
                  key={phd}
                  type="button"
                  onClick={() => setSelectedPhd(phd)}
                  className={`flex-1 p-3 border text-sm font-medium ${selectedPhd === phd ? 'bg-foreground text-background border-foreground' : 'bg-secondary text-foreground border-border hover:border-foreground/40'}`}
                >
                  {phd} PHd
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-accent-2 mb-2">Price</h3>
            <div className="bg-secondary p-3 border border-border">
              <p className="text-foreground">{(selectedPhd * hashPrice).toLocaleString()} sats</p>
            </div>
          </div>

          <div className="text-[10px] text-gray-300 italic mt-10">
            Each order will deliver exactly {selectedPhd} PHd of work. Delivery will start after 1 confirmation. Confirmation must happen within 6 blocks, otherwise the order will expire. Use a high fee rate.
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
              {error}
            </div>
          )}

          {isOwnProfile ? (
            <div className="flex justify-center mt-6">
              <button onClick={handleCreate} className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80">
                Create & Pay
              </button>
            </div>
          ) : (
            <p className="text-sm text-accent-2 text-center mt-4">Connect your wallet to create an order</p>
          )}
        </div>
      </div>
    </div>
  );
}
