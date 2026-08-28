'use client';

import type { BadgesPayload } from '@/lib/badge-types';
import {
  BLOCK_BADGE_ID,
  BLOCK_WINNER_BADGE_ID,
  LOYALTY_BADGE_ID,
  REFINERY_BADGE_ID,
  DISPENSER_BADGE_ID,
  BRAVOCADO_BADGE_ID,
  MINER_BADGE_ID,
  AUCTION_WINNER_BADGE_ID,
  LOYALTY_BLOCKS_PER_INSTANCE,
} from '@/lib/badge-types';
import BlockBadge from './BlockBadge';
import BlockWinnerBadge from './BlockWinnerBadge';
import StackedMedal from './StackedMedal';
import {
  PickaxeIcon,
  LoyaltyIcon,
  DispenserIcon,
  RefineryIcon,
  MushroomIcon,
  MinerRigIcon,
  GavelIcon,
} from './icons';

interface BadgeDisplayProps {
  badges: BadgesPayload | null;
  loading?: boolean;
  /** Called when the stacked "N more blocks" medal is clicked. */
  onBlocksClick?: () => void;
}

export default function BadgeDisplay({ badges, loading, onBlocksClick }: BadgeDisplayProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-[44px] h-[44px] rounded-full bg-gray-700 animate-pulse" />
        <div className="w-[44px] h-[44px] rounded-full bg-gray-700 animate-pulse" />
      </div>
    );
  }

  const types = badges?.types ?? {};
  const block = types[BLOCK_BADGE_ID];
  const blockUnique = block?.unique ?? [];
  const blockStacked = block?.bucket?.count ?? 0;
  const winners = types[BLOCK_WINNER_BADGE_ID]?.unique ?? [];
  const loyalty = types[LOYALTY_BADGE_ID]?.bucket?.count ?? 0;
  const refinery = types[REFINERY_BADGE_ID]?.bucket?.count ?? 0;
  const dispenser = types[DISPENSER_BADGE_ID]?.bucket?.count ?? 0;
  const bravocado = types[BRAVOCADO_BADGE_ID]?.bucket?.count ?? 0;
  const miner = types[MINER_BADGE_ID]?.bucket?.count ?? 0;
  const auctionWins = types[AUCTION_WINNER_BADGE_ID]?.bucket?.count ?? 0;

  const hasAny =
    winners.length > 0 ||
    blockUnique.length > 0 ||
    blockStacked > 0 ||
    loyalty > 0 ||
    refinery > 0 ||
    dispenser > 0 ||
    bravocado > 0 ||
    miner > 0 ||
    auctionWins > 0;

  if (!hasAny) {
    return <span className="text-gray-400">-</span>;
  }

  const loyaltyBlocks = (loyalty * LOYALTY_BLOCKS_PER_INSTANCE / 1000);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {winners.map((instance) => (
        <BlockWinnerBadge key={`w-${instance.blockheight}`} blockHeight={instance.blockheight} />
      ))}

      {blockUnique.map((instance) => (
        <BlockBadge key={`b-${instance.blockheight}`} blockHeight={instance.blockheight} />
      ))}
      {blockStacked > 0 && (
        <StackedMedal
          count={blockStacked}
          icon={<PickaxeIcon />}
          tooltip={`Mined on ${blockStacked} more block${blockStacked === 1 ? '' : 's'}`}
          onClick={onBlocksClick}
        />
      )}

      {loyalty > 0 && (
        <StackedMedal
          count={loyalty}
          icon={<LoyaltyIcon />}
          tooltip={`Loyalty — ${loyaltyBlocks}k blocks mined`}
        />
      )}

      {auctionWins > 0 && (
        <StackedMedal
          count={auctionWins}
          icon={<GavelIcon />}
          tooltip={`Auction Winner — ${auctionWins} auction${auctionWins === 1 ? '' : 's'} won`}
        />
      )}

      {bravocado > 0 && (
        <StackedMedal
          count={bravocado}
          icon={<MushroomIcon />}
          showCount={false}
          tooltip="Bravocado — collected from the dispenser"
        />
      )}

      {miner > 0 && (
        <StackedMedal
          count={miner}
          icon={<MinerRigIcon />}
          showCount={false}
          tooltip="Miner — collected from the dispenser"
        />
      )}

      {dispenser > 0 && (
        <StackedMedal
          count={dispenser}
          icon={<DispenserIcon />}
          tooltip={`${dispenser} dispenser asset type${dispenser === 1 ? '' : 's'} collected`}
        />
      )}

      {refinery > 0 && (
        <StackedMedal
          count={refinery}
          icon={<RefineryIcon />}
          showCount={false}
          tooltip={`Refinery Operator — ${refinery} order${refinery === 1 ? '' : 's'} fulfilled`}
        />
      )}
    </div>
  );
}
