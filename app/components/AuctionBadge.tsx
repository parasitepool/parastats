'use client';

import Image from 'next/image';

import avocadoBadge from '@/public/avocado-badge.png';

// Base URL of the standalone Leptos auction house (see DispenserClaim).
const auctionHouseUrl = process.env.NEXT_PUBLIC_AUCTION_HOUSE_URL?.replace(/\/$/, '');

/**
 * Small pixel-art avocado shown beside the connect button on account pages.
 * Links to the auction house when one is configured, otherwise it is just a
 * badge.
 */
export default function AuctionBadge() {
  const image = (
    <Image
      src={avocadoBadge}
      unoptimized
      alt="Bravocado auctions"
      height={32}
      loading="eager"
      className="h-7 sm:h-8 w-auto"
      style={{ imageRendering: 'pixelated' }}
    />
  );

  if (!auctionHouseUrl) {
    return <span className="flex-shrink-0">{image}</span>;
  }

  return (
    <a
      href={auctionHouseUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Bravocado auctions"
      className="flex-shrink-0 hover:opacity-80 transition-opacity"
    >
      {image}
    </a>
  );
}
