'use client';

import { useState, useEffect } from 'react';
import { request, RpcErrorCode } from '@sats-connect/core';
import QRCode from 'react-qr-code';
import { useWallet } from '@/app/hooks/useWallet';
import { InfoIcon, CopyIcon, CheckIcon } from '@/app/components/icons';
import { getBitcoinPrice } from '@/app/utils/api';
import { formatHashDays, formatPrice } from '@/app/utils/formatters';
import type { OrderDetail, OrderResponse } from '@/app/api/router/types';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
  address: string;
  hashPrice: number;
  halt: boolean;
}

const MIN_PHD = 0.199;
const MIN_SLIDER_PHD = 1;
const MAX_PHD = 99;
const phdToSlider = (phd: number) => phd < MIN_SLIDER_PHD ? 0 : phd;
const sliderToPhd = (pos: number) => pos === 0 ? MIN_PHD : clamp(Math.round(pos), MIN_SLIDER_PHD, MAX_PHD);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const formatPhd = (phd: number) => (phd < 1 ? formatHashDays(phd * 1e15) : `${trimPhd(phd)} PHd`);

const trimPhd = (phd: number) => String(Math.round(phd * 100) / 100);

type AmountUnit = 'sats' | 'btc';

export default function CreateOrderModal({ isOpen, onClose, onCreated, address, hashPrice, halt }: CreateOrderModalProps) {
  const { address: walletAddress, isConnected, walletType } = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [selectedPhd, setSelectedPhd] = useState(1);
  const [editingField, setEditingField] = useState<'phd' | AmountUnit | null>(null);
  const [editValue, setEditValue] = useState('');
  const [balanceSats, setBalanceSats] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<'form' | 'payment'>('form');
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentSent, setPaymentSent] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [bitcoinPrice, setBitcoinPrice] = useState<number | null>(null);

  const minSats = Math.max(1, Math.ceil(MIN_PHD * hashPrice));
  const maxSats = Math.ceil(MAX_PHD * hashPrice);
  const chargeSats = clamp(Math.ceil(selectedPhd * hashPrice), minSats, maxSats);
  const firstSatsIncrement = Math.ceil(minSats / 1000) * 1000;
  const maxSpendSliderPosition = Math.max(0, 1 + Math.floor((maxSats - firstSatsIncrement) / 1000));
  const spendSliderPosition = chargeSats <= minSats
    ? 0
    : clamp(Math.round((chargeSats - firstSatsIncrement) / 1000) + 1, 0, maxSpendSliderPosition);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedPhd(1);
      setEditingField(null);
      setEditValue('');
      setBalanceSats(null);
      setSubmitting(false);
      setView('form');
      setOrderData(null);
      setCopiedField(null);
      setPaying(false);
      setPaymentSent(false);
      setPaymentConfirmed(false);
      setBitcoinPrice(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || view !== 'payment' || !orderData) return;

    let cancelled = false;
    let checking = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let closeTimeout: ReturnType<typeof setTimeout> | undefined;

    const checkPayment = async () => {
      if (cancelled || checking) return;
      checking = true;

      try {
        const response = await fetch(`/api/router/order/${orderData.order_id}`, { cache: 'no-store' });
        if (!response.ok) return;

        const detail: OrderDetail = await response.json();
        if (detail.txids?.length) {
          cancelled = true;
          if (intervalId) clearInterval(intervalId);
          setPaymentConfirmed(true);
          closeTimeout = setTimeout(onClose, 3000);
          try {
            await onCreated?.();
          } catch {}
        }
      } catch {}
      finally {
        checking = false;
      }
    };

    checkPayment();
    intervalId = setInterval(checkPayment, 5000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (closeTimeout) clearTimeout(closeTimeout);
    };
  }, [isOpen, view, orderData, onClose, onCreated]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    getBitcoinPrice().then(price => {
      if (!cancelled) setBitcoinPrice(price);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || walletType !== 'xverse') return;

    let cancelled = false;

    (async () => {
      try {
        const response = await request('getBalance', null);
        if (cancelled || response.status !== 'success') return;
        const confirmed = Number(response.result.confirmed);
        if (Number.isFinite(confirmed)) setBalanceSats(confirmed);
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, walletType]);

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

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const setPhdAmount = (phd: number) => {
    setSelectedPhd(clamp(phd, MIN_PHD, MAX_PHD));
  };

  const setSatsAmount = (sats: number) => {
    setPhdAmount((sats - 0.5) / hashPrice);
  };

  const commitPhdEdit = (raw: string) => {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) setPhdAmount(parsed);
    setEditingField(null);
  };

  const amountToSats = (amount: number, unit: AmountUnit) => {
    return unit === 'sats' ? amount : amount * 1e8;
  };

  const satsToAmount = (sats: number, unit: AmountUnit) => {
    return unit === 'sats' ? String(sats) : (sats / 1e8).toFixed(8);
  };

  const getAmountEditSats = () => {
    if (editingField !== 'sats' && editingField !== 'btc') return chargeSats;
    const parsed = parseFloat(editValue);
    if (!Number.isFinite(parsed)) return chargeSats;
    return amountToSats(parsed, editingField);
  };

  const commitAmountEdit = () => {
    if (editingField === 'sats' || editingField === 'btc') {
      const parsed = parseFloat(editValue);
      if (Number.isFinite(parsed)) setSatsAmount(amountToSats(parsed, editingField));
    }
    setEditingField(null);
  };

  const startPhdEdit = () => {
    setEditValue(trimPhd(selectedPhd));
    setEditingField('phd');
  };

  const startAmountEdit = (unit: AmountUnit) => {
    setEditValue(satsToAmount(getAmountEditSats(), unit));
    setEditingField(unit);
  };

  const editingSats = getAmountEditSats();
  const editingUsd = bitcoinPrice !== null
    ? formatPrice((editingSats / 1e8) * bitcoinPrice)
    : bitcoinPrice === null ? 'Loading...' : '—';

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
          hash_days: selectedPhd * 1e15,
          hash_price: hashPrice,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? `Failed to create order (${res.status})`);
      }

      const data: OrderResponse = await res.json();
      setOrderData(data);
      setView('payment');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayWithXverse = async () => {
    if (!orderData) return;
    setPaying(true);
    setError(null);

    try {
      const response = await request('sendTransfer', {
        recipients: [{ address: orderData.payment_address, amount: orderData.payment_amount }],
      });

      if (response.status !== 'success') {
        if (response.error?.code === RpcErrorCode.USER_REJECTION) {
          return;
        }
        throw new Error(response.error?.message || 'Failed to send transaction');
      }

      setPaymentSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to send payment');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-background border border-foreground p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-accent-3">{view === 'form' ? 'Create Order' : 'Payment Details'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500 focus:outline-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {view === 'form' && (
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
                  <span className="pointer-events-none absolute bottom-full left-0 -translate-y-2 w-56 p-2 bg-background border border-border rounded shadow-lg text-xs font-normal text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    PHd (petahash-day): Work done by 1 PH/s over 1 day. Conceptually like a KWh (kilowatt-hour).
                  </span>
                </span>
              </h3>
              <div className="bg-secondary p-3 border border-border space-y-2">
                <div
                  className="cursor-text"
                  onClick={() => {
                    if (editingField !== 'phd') startPhdEdit();
                  }}
                >
                  <p className="text-foreground break-all">
                      {editingField === 'phd' ? (
                        <span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitPhdEdit(editValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitPhdEdit(editValue);
                            }}
                            autoFocus
                            className="w-24 bg-secondary border border-foreground text-center text-foreground outline-none"
                          /> PHd
                        </span>
                      ) : (
                        <span className="border-b border-dashed border-foreground/40 hover:border-foreground">
                          {formatPhd(selectedPhd)}
                        </span>
                      )}
                  </p>
                </div>
                <div className="relative h-7">
                  <input
                    type="range"
                    min={0}
                    max={MAX_PHD}
                    step={1}
                    value={clamp(phdToSlider(selectedPhd), 0, 100)}
                    onChange={(e) => {
                      setSelectedPhd(clamp(sliderToPhd(parseFloat(e.target.value)), MIN_PHD, MAX_PHD));
                      setEditingField(null);
                    }}
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full phd-slider z-10"
                  />
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-accent-2 mb-2">Spend</h3>
              <div className="bg-secondary p-3 border border-border space-y-2">
                <div
                  className="cursor-text"
                  onClick={() => {
                    if (editingField !== 'sats' && editingField !== 'btc') startAmountEdit('sats');
                  }}
                >
                  <p className="text-foreground break-all">
                    {editingField === 'sats' || editingField === 'btc' ? (
                      <span data-spend-editor className="inline-flex flex-wrap items-baseline gap-1">
                        {editingField === 'sats' ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={(e) => {
                              const nextTarget = e.relatedTarget;
                              const editor = e.currentTarget.closest('[data-spend-editor]');
                              if (!(nextTarget instanceof Node) || !editor?.contains(nextTarget)) {
                                commitAmountEdit();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitAmountEdit();
                            }}
                            autoFocus
                            className="w-28 bg-secondary border border-foreground text-center text-foreground outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startAmountEdit('sats')}
                            className="border-b border-dashed border-foreground/40 hover:border-foreground"
                          >
                            {Math.round(editingSats).toLocaleString()}
                          </button>
                        )}
                        <span>sats</span>
                        <span className="text-foreground/40">(</span>
                        {editingField === 'btc' ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={(e) => {
                              const nextTarget = e.relatedTarget;
                              const editor = e.currentTarget.closest('[data-spend-editor]');
                              if (!(nextTarget instanceof Node) || !editor?.contains(nextTarget)) {
                                commitAmountEdit();
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitAmountEdit();
                            }}
                            autoFocus
                            className="w-28 bg-secondary border border-foreground text-center text-foreground outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startAmountEdit('btc')}
                            className="border-b border-dashed border-foreground/40 hover:border-foreground"
                          >
                            {(editingSats / 1e8).toFixed(8)}
                          </button>
                        )}
                        <span className="text-foreground/40">BTC)</span>
                        <span className="text-foreground/40 ml-2">(~{editingUsd})</span>
                      </span>
                    ) : (
                        <span className="border-b border-dashed border-foreground/40 hover:border-foreground">
                          {chargeSats.toLocaleString()} sats
                          <span className="text-foreground/40 ml-2">({(chargeSats / 1e8).toFixed(8)} BTC)</span>
                          {bitcoinPrice !== null && (
                            <span className="text-foreground/40 ml-2">(~{formatPrice((chargeSats / 1e8) * bitcoinPrice)})</span>
                          )}
                        </span>
                    )}
                  </p>
                </div>
                <div className="relative h-7">
                  <input
                    type="range"
                    min={0}
                    max={maxSpendSliderPosition}
                    step={1}
                    value={spendSliderPosition}
                    onChange={(e) => {
                      const sliderPosition = Number(e.target.value);
                      const sats = sliderPosition === 0
                        ? minSats
                        : Math.min(maxSats, firstSatsIncrement + (sliderPosition - 1) * 1000);
                      setSatsAmount(sats);
                      setEditingField(null);
                    }}
                    className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full phd-slider z-10"
                  />
                </div>
              </div>
              <div className="mt-4 border border-border bg-secondary/50 px-3 py-2 text-sm space-y-1">
                {walletType === 'xverse' && balanceSats != null && (
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-foreground/60">Balance</span>
                    <span className="text-foreground text-right">{balanceSats.toLocaleString()} sats</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-foreground/60">Hashprice</span>
                  <span className="text-foreground text-right">{hashPrice.toLocaleString()} sats/PHd</span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-foreground/60">BTC price</span>
                  <span className="text-foreground text-right">{formatPrice(bitcoinPrice)}</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-gray-300 italic mt-6">
              This order will deliver {formatPhd(selectedPhd)} of work. Delivery will start after 1 confirmation. Confirmation must happen within 6 blocks, otherwise the order will expire. Use a high fee rate.
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
        )}

        {view === 'payment' && orderData && (
          paymentConfirmed ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-4">
              <div className="h-40 w-40 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="h-24 w-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-green-500">Payment detected</p>
            </div>
          ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="bg-white p-2 rounded-md overflow-hidden">
                <QRCode
                  value={orderData.payment_address}
                  size={208}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                />
              </div>
              <p className="text-[10px] text-foreground/40">Scan to get the deposit address</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-accent-2 mb-2">Payment Address</h3>
              <div className="bg-secondary p-3 border border-border flex items-center justify-between gap-2">
                <p className="text-foreground break-all text-sm flex-1">{orderData.payment_address}</p>
                <button
                  onClick={() => copyToClipboard(orderData.payment_address, 'address')}
                  className="flex items-center gap-1 px-2 py-1 bg-foreground text-background hover:bg-foreground/80 transition-colors text-xs font-medium flex-shrink-0"
                >
                  {copiedField === 'address' ? (
                    <><CheckIcon className="w-3 h-3" /><span>Copied</span></>
                  ) : (
                    <><CopyIcon className="w-3 h-3" /><span>Copy</span></>
                  )}
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-accent-2 mb-2">Amount</h3>
              <div className="bg-secondary p-3 border border-border flex items-center justify-between gap-2">
                <p className="text-foreground flex-1">
                  {orderData.payment_amount.toLocaleString()} sats
                  <span className="text-foreground/40 ml-2">({(orderData.payment_amount / 1e8).toFixed(8)} BTC)</span>
                  {bitcoinPrice !== null && (
                    <span className="text-foreground/40 ml-2">(~{formatPrice((orderData.payment_amount / 1e8) * bitcoinPrice)})</span>
                  )}
                </p>
                <button
                  onClick={() => copyToClipboard(String(orderData.payment_amount), 'amount')}
                  className="flex items-center gap-1 px-2 py-1 bg-foreground text-background hover:bg-foreground/80 transition-colors text-xs font-medium flex-shrink-0"
                >
                  {copiedField === 'amount' ? (
                    <><CheckIcon className="w-3 h-3" /><span>Copied</span></>
                  ) : (
                    <><CopyIcon className="w-3 h-3" /><span>Copy</span></>
                  )}
                </button>
              </div>
            </div>

            <div className="text-[10px] text-gray-300 italic mt-4">
              Send the exact amount to the address above. Confirmation must happen within 6 blocks, otherwise the order will expire. Use a high fee rate.
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 p-3 border border-red-500/20">
                {error}
              </div>
            )}

            <div className="flex flex-col items-center gap-3 mt-6">
              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
                <span>Waiting for payment</span>
              </div>
              <div className="flex justify-center gap-3">
                {isConnected && walletType !== 'manual' && (
                  <button
                    type="button"
                    onClick={handlePayWithXverse}
                    disabled={paying || paymentSent || paymentConfirmed}
                    className={`px-4 py-2 text-sm font-medium ${paying || paymentSent || paymentConfirmed ? 'bg-foreground/40 text-background/60 cursor-not-allowed' : 'bg-foreground text-background hover:bg-foreground/80'}`}
                  >
                    {paying ? 'Paying…' : paymentConfirmed ? 'Payment detected' : paymentSent ? 'Waiting for payment…' : 'Pay with Xverse'}
                  </button>
                )}
              </div>
            </div>
          </div>
          )
        )}
      </div>
    </div>
  );
}
