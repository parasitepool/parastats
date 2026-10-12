'use client';

import { useMemo, useState } from 'react';
import SortableTable from '../SortableTable';
import { BidInfo, fmtSats, fmtTimeAgo, shortAddr } from './utils';

interface BidHistoryProps {
  bids: BidInfo[];
  ownAddress: string | null;
}

interface BidRow {
  id: string;
  bidder: string;
  isOwn: boolean;
  amount: number;
  created: number;
}

const PAGE_SIZE = 10;

const columns = [
  {
    key: 'bidder' as keyof BidRow,
    header: 'Bidder',
    render: (_value: BidRow[keyof BidRow], row: BidRow) => (
      <span className="font-mono">
        {shortAddr(row.bidder)}
        {row.isOwn && <span className="ml-2 text-accent-3 font-semibold">you</span>}
      </span>
    ),
  },
  {
    key: 'amount' as keyof BidRow,
    header: 'Amount',
    render: (value: BidRow[keyof BidRow]) => `${fmtSats(Number(value))} sats`,
  },
  {
    key: 'created' as keyof BidRow,
    header: 'Time',
    render: (value: BidRow[keyof BidRow]) => (
      <span className="text-foreground/60">{fmtTimeAgo(Number(value))}</span>
    ),
  },
];

export default function BidHistory({ bids, ownAddress }: BidHistoryProps) {
  const [mobilePage, setMobilePage] = useState(0);

  const rows = useMemo<BidRow[]>(
    () =>
      bids.map((bid) => ({
        id: bid.id,
        bidder: bid.bidder_payment_address,
        isOwn: ownAddress !== null && bid.bidder_payment_address === ownAddress,
        amount: bid.amount,
        created: bid.created_at,
      })),
    [bids, ownAddress]
  );

  if (rows.length === 0) {
    return (
      <div className="mt-4" data-collapse-ignore>
        <h3 className="text-sm font-medium text-accent-2 mb-2">Bids</h3>
        <p className="text-sm text-foreground/60">No bids yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-4" data-collapse-ignore>
      <h3 className="text-sm font-medium text-accent-2 mb-2">Bids</h3>

      <div className="hidden md:block">
        <SortableTable
          data={rows}
          columns={columns}
          defaultSortColumn="created"
          defaultSortDirection="desc"
          pageSize={PAGE_SIZE}
        />
      </div>

      <div className="md:hidden space-y-4">
        {rows
          .slice()
          .sort((a, b) => b.created - a.created)
          .slice(mobilePage * PAGE_SIZE, (mobilePage + 1) * PAGE_SIZE)
          .map((row) => (
            <div
              key={row.id}
              className={`${row.isOwn ? 'bg-secondary' : 'bg-background'} border border-border p-4 shadow-sm`}
            >
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-mono text-foreground/80">
                  {shortAddr(row.bidder)}
                  {row.isOwn && <span className="ml-2 text-accent-3 font-semibold">you</span>}
                </span>
                <span className="font-medium">{fmtSats(row.amount)} sats</span>
              </div>
              <p className="text-xs text-foreground/60">{fmtTimeAgo(row.created)}</p>
            </div>
          ))}
        {rows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-foreground/60">
              {mobilePage * PAGE_SIZE + 1}–{Math.min((mobilePage + 1) * PAGE_SIZE, rows.length)} of {rows.length}
            </span>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 text-sm border border-border hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={mobilePage === 0}
                onClick={() => setMobilePage(mobilePage - 1)}
              >
                Prev
              </button>
              <button
                className="px-3 py-1 text-sm border border-border hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed"
                disabled={(mobilePage + 1) * PAGE_SIZE >= rows.length}
                onClick={() => setMobilePage(mobilePage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
