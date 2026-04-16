'use client';

import { useState, useEffect } from 'react';
import { request, RpcErrorCode } from '@sats-connect/core';
import { useWallet } from '@/app/hooks/useWallet';
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

  useEffect(() => {
    if (isOpen) setError(null);
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
            endpoint: 'parasite.wtf:42069',
            username: `${address}.refinery`,
            password: null,
          },
          hashdays: 1e15,
          price: hashPrice,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to create order (${res.status})`);
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
              <p className="text-foreground break-all">parasite.wtf:42069</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-accent-2 mb-2">Work</h3>
            <div className="bg-secondary p-3 border border-border">
              <p className="text-foreground">1 PHd</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-accent-2 mb-2">Price</h3>
            <div className="bg-secondary p-3 border border-border">
              <p className="text-foreground">{hashPrice.toLocaleString()} sats</p>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
              {error}
            </div>
          )}

          {isOwnProfile ? (
            <div className="flex gap-2 justify-center mt-6">
              <button onClick={onClose} className="px-4 py-2 bg-foreground text-background text-sm font-medium hover:bg-foreground/80">
                Cancel
              </button>
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
