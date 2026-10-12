'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import CardHeader from '../CardHeader';
import { useWallet } from '@/app/hooks/useWallet';
import { getCollapsibleContainerClassName, shouldToggleCollapse } from '../collapsible';
import { GavelIcon } from '../icons';
import { auctionHouseUrl } from '@/app/utils/auctionHouse';
import BidHistory from './BidHistory';
import {
  AuctionInfo,
  BidInfo,
  fmtCountdown,
  fmtPhd,
  fmtSats,
  isLive,
} from './utils';

const POLL_MS = 30_000;
const POLL_NEAR_END_MS = 5_000;
const NEAR_END_SECS = 120;

interface AuctionProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const statusColor: Record<string, string> = {
  open: 'text-green-500',
  extended: 'text-amber-500',
};

export default function Auction({ collapsed = false, onToggle }: AuctionProps) {
  const { address } = useWallet();
  // The live auction closest to finishing; null hides the whole card.
  const [auction, setAuction] = useState<AuctionInfo | null>(null);
  const [bids, setBids] = useState<BidInfo[]>([]);
  const [hashPrice, setHashPrice] = useState<number | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  // Poll the auction list, accelerating near the end so anti-snipe extensions
  // show up promptly.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      let next: AuctionInfo | null = null;
      try {
        const response = await fetch('/api/dispenser/auctions', { cache: 'no-store' });
        if (response.ok) {
          const list: AuctionInfo[] = await response.json();
          next = list.filter(isLive).sort((a, b) => a.end_time - b.end_time)[0] ?? null;
          if (!cancelled) setAuction(next);
        }
      } catch (error) {
        console.error('Error fetching auctions:', error);
      }

      if (next) {
        try {
          const bidsResponse = await fetch(
            `/api/dispenser/auction/${encodeURIComponent(next.id)}/bids`,
            { cache: 'no-store' }
          );
          if (bidsResponse.ok && !cancelled) {
            setBids(await bidsResponse.json());
          }
        } catch (error) {
          console.error('Error fetching auction bids:', error);
        }
      } else if (!cancelled) {
        setBids([]);
      }

      if (!cancelled) {
        const remaining = next ? next.end_time - Math.floor(Date.now() / 1000) : Infinity;
        timer = setTimeout(tick, remaining > 0 && remaining <= NEAR_END_SECS ? POLL_NEAR_END_MS : POLL_MS);
      }
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Hash price for the PHd conversion, only meaningful for hashrate payouts.
  const auctionId = auction?.id;
  const payout = auction?.payout;
  useEffect(() => {
    if (!auctionId || payout === 'address') {
      setHashPrice(null);
      return;
    }

    let cancelled = false;
    fetch('/api/dispenser/refinery/price', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setHashPrice(data?.hash_price ?? null);
      })
      .catch(() => {
        if (!cancelled) setHashPrice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [auctionId, payout]);

  // 1s clock for the countdown.
  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!auction) {
    return null;
  }

  const hasStarted = now >= auction.start_time;
  const countdownTarget = hasStarted ? auction.end_time : auction.start_time;
  const highPhd = auction.current_high !== null && hashPrice !== null
    ? fmtPhd(auction.current_high, hashPrice)
    : null;

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (onToggle && shouldToggleCollapse(event, '[data-collapse-ignore]')) {
      onToggle();
    }
  };

  return (
    <div
      className={getCollapsibleContainerClassName(
        'w-full bg-background border border-border p-4 sm:p-6 shadow-md',
        collapsed,
        Boolean(onToggle)
      )}
      onClick={handleClick}
    >
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            Auction
            {auction.source.kind === 'listing' && (
              <span className="text-xs font-normal text-accent-3 border border-border px-1.5 py-0.5">
                Community
              </span>
            )}
          </span>
        }
        icon={<GavelIcon />}
        action={
          collapsed || !hasStarted ? null : auctionHouseUrl ? (
            <a
              href={`${auctionHouseUrl}/auction/${auction.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-auction flex-shrink-0 px-4 py-2 bg-secondary border border-border text-sm font-medium hover:bg-secondary/80"
            >
              Bid
            </a>
          ) : (
            <span className="btn-auction flex-shrink-0 px-4 py-2 bg-secondary border border-border text-sm font-medium hover:bg-secondary/80">
              Bid
            </span>
          )
        }
      />

      {!collapsed && (
        <div className="mt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <a
              href={`https://ordinals.com/inscription/${auction.inscription_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block w-full md:w-56 md:flex-shrink-0 aspect-square bg-secondary border border-border overflow-hidden"
            >
              <Image
                src={`https://ordinals.com/content/${auction.inscription_id}`}
                alt={`Inscription ${auction.inscription_id}`}
                fill
                unoptimized
                style={{ imageRendering: 'pixelated', objectFit: 'contain' }}
              />
            </a>

            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-secondary border border-border p-3 min-h-[88px]">
                  <div className="text-xs text-accent-2 mb-1">Status</div>
                  <div className={`text-lg font-semibold ${statusColor[auction.status] ?? ''}`}>
                    {auction.status}
                  </div>
                </div>
                <div className="bg-secondary border border-border p-3 min-h-[88px]">
                  <div className="text-xs text-accent-2 mb-1">Highest bid</div>
                  <div className="text-lg font-semibold">
                    {auction.current_high !== null ? `${fmtSats(auction.current_high)} sats` : 'No bids yet'}
                  </div>
                  {highPhd && <div className="text-xs text-foreground/60">{highPhd}</div>}
                </div>
                <div className="bg-secondary border border-border p-3 min-h-[88px]">
                  <div className="text-xs text-accent-2 mb-1">{hasStarted ? 'Ends in' : 'Starts in'}</div>
                  <div className="text-lg font-semibold">{fmtCountdown(countdownTarget - now)}</div>
                </div>
              </div>
            </div>
          </div>

          <BidHistory bids={bids} ownAddress={address} />
        </div>
      )}
    </div>
  );
}
