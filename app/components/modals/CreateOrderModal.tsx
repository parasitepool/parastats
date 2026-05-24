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
  halt: boolean;
}

const MIN_PHD = 1;
const MAX_PHD = 69;
const LOG_MAX = Math.log(MAX_PHD);
const NOTCHES = [1, 9, 19, 29, 39, 49, 59, 69];
const phdToSlider = (phd: number) => Math.log(phd) / LOG_MAX * 100;
const sliderToPhd = (pos: number) => Math.round(Math.exp((pos / 100) * LOG_MAX));

export default function CreateOrderModal({ isOpen, onClose, onCreated, address, hashPrice, halt }: CreateOrderModalProps) {
  const { address: walletAddress, isConnected } = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [selectedPhd, setSelectedPhd] = useState(1);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedPhd(1);
      setEditing(false);
      setEditValue('');
      setSubmitting(false);
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

  const commitEdit = (raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) {
      setSelectedPhd(Math.min(MAX_PHD, Math.max(MIN_PHD, Math.round(parsed))));
    }
    setEditing(false);
  };

  if (!isOpen) return null;

  const isOwnProfile = isConnected && walletAddress === address;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCreate = async () => {
    setSubmitting(true);
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
          hash_days: Math.round(selectedPhd * 1e15),
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
    } finally {
      setSubmitting(false);
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
            <div className="space-y-2">
              <div className="text-center text-foreground font-medium">
                {editing ? (
                  <span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(editValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(editValue);
                      }}
                      autoFocus
                      className="w-24 bg-secondary border border-foreground text-center text-foreground outline-none"
                    /> PHd
                  </span>
                ) : (
                  <span
                    onClick={() => { setEditValue(String(selectedPhd)); setEditing(true); }}
                    className="cursor-text hover:underline"
                  >
                    {selectedPhd} PHd
                  </span>
                )}
              </div>
              <div className="relative h-7">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={phdToSlider(selectedPhd)}
                  onChange={(e) => {
                    setSelectedPhd(Math.min(MAX_PHD, Math.max(MIN_PHD, sliderToPhd(parseFloat(e.target.value)))));
                    setEditing(false);
                  }}
                  className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full phd-slider z-10"
                />
                <div className="absolute inset-0 mx-[8px] pointer-events-none">
                  {NOTCHES.map(phd => (
                    <div key={phd} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-7 bg-foreground/30" style={{ left: `${phdToSlider(phd)}%`, width: '1px' }} />
                  ))}
                </div>
              </div>
              <div className="relative mx-[8px]">
                <span className="absolute text-xs text-accent-2 -translate-x-1/2" style={{ left: `${phdToSlider(1)}%` }}>1</span>
                <span className="absolute text-xs text-accent-2 -translate-x-1/2" style={{ left: `${phdToSlider(69)}%` }}>69</span>
                <span>&nbsp;</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-accent-2 mb-2">Price</h3>
            <div className="bg-secondary p-3 border border-border">
              <p className="text-foreground">
                {Math.ceil(selectedPhd * hashPrice).toLocaleString()} sats
                <span className="text-foreground/40 ml-2">({(Math.ceil(selectedPhd * hashPrice) / 1e8).toFixed(8)} BTC)</span>
              </p>
            </div>
          </div>

          <div className="text-[10px] text-gray-300 italic mt-10">
            Each order will deliver {selectedPhd} PHd of work. Delivery will start after 1 confirmation. Confirmation must happen within 6 blocks, otherwise the order will expire. Use a high fee rate.
          </div>

          {halt && (
            <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
              Order creation paused, come back later
            </div>
          )}

          {error && !halt && (
            <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
              {error}
            </div>
          )}

          {isOwnProfile ? (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleCreate}
                disabled={halt || submitting}
                className={`px-4 py-2 text-sm font-medium ${halt || submitting ? 'bg-foreground/40 text-background/60 cursor-not-allowed' : 'bg-foreground text-background hover:bg-foreground/80'}`}
              >
                {submitting ? 'Creating…' : 'Create & Pay'}
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
