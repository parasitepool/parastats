'use client';

import { auctionHouseUrl } from '@/app/utils/auctionHouse';

interface AuctionButtonProps {
  className?: string;
  onClick?: () => void;
}

export default function AuctionButton({ className, onClick }: AuctionButtonProps) {
  const resolvedClassName =
    className ??
    'btn-auction flex-shrink-0 h-10 inline-flex items-center justify-center px-3 sm:px-4 bg-secondary border border-border text-xs sm:text-sm font-medium hover:bg-secondary/80';

  if (!auctionHouseUrl) {
    return <span className={resolvedClassName} onClick={onClick}>Auction</span>;
  }

  return (
    <a
      href={auctionHouseUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={resolvedClassName}
      onClick={onClick}
    >
      Auction
    </a>
  );
}
