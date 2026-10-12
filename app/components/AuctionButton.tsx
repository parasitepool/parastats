'use client';

import { auctionHouseUrl } from '@/app/utils/auctionHouse';

export default function AuctionButton() {
  const className =
    'btn-auction flex-shrink-0 px-4 py-2 bg-secondary border border-border text-sm font-medium hover:bg-secondary/80';

  if (!auctionHouseUrl) {
    return <span className={className}>Auction</span>;
  }

  return (
    <a
      href={auctionHouseUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      Auction
    </a>
  );
}
