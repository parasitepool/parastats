"use client";

import { StratumNotification } from "../../api/stratum/route";
import { 
  decodeCoinbaseScriptSigInfo,
  getTransaction
} from "../../utils/bitcoinUtils";
import { formatDifficulty } from "../../utils/hashmath";
import InfoCard from "./InfoCard";
import { useMemo } from "react";

interface BlockHeaderProps {
  notification: StratumNotification;
}

export default function BlockHeader({ notification }: BlockHeaderProps) {
  const blockData = useMemo(() => {
    const previousBlockHash = stratumPrevHashToBlockHash(notification.prevBlockHash);
    const previousBlockHashIsValid = isBlockHash(previousBlockHash);

    try {
      // Use actual extranonce values from stratum notification, with fallbacks
      const extranonce1 = notification.extranonce1 || '00000000';
      const extranonce2Size = notification.extranonce2Size || 4;
      const extranonce2 = '00'.repeat(extranonce2Size);
      
      const coinbaseRaw = notification.coinbase1 + extranonce1 + extranonce2 + notification.coinbase2;
      
      // Parse coinbase transaction to get block height
      const tx = getTransaction(coinbaseRaw);
      const scriptSigInfo = decodeCoinbaseScriptSigInfo(Buffer.from(tx.ins[0].script));
      
      // Calculate difficulty from nBits
      const difficulty = calculateDifficultyFromNBits(notification.nBits);
      
      // Format timestamp
      const readableTimestamp = formatHexTimestamp(notification.nTime);
      
      return {
        blockHeight: scriptSigInfo.height,
        difficulty,
        readableTimestamp,
        previousBlockHash,
        previousBlockHashIsValid,
        success: true
      };
    } catch (error) {
      console.error('Error parsing block data:', error);
      return {
        blockHeight: null,
        difficulty: 0,
        readableTimestamp: 'Invalid',
        previousBlockHash,
        previousBlockHashIsValid,
        success: false
      };
    }
  }, [notification.coinbase1, notification.coinbase2, notification.extranonce1, notification.extranonce2Size, notification.nBits, notification.nTime, notification.prevBlockHash]);

  return (
    <div className="space-y-6">
      {/* Top cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard
          label="Block Height"
          value={blockData.blockHeight?.toLocaleString() ?? "Unknown"}
        />
        <InfoCard
          label="Job ID"
          value={notification.jobId}
          isMono
        />
        <InfoCard
          label="nBits (Network difficulty)"
          value={`${notification.nBits} (${formatDifficulty(blockData.difficulty)})`}
          isMono
        />
        <InfoCard
          label="Version"
          value={notification.version}
          isMono
        />
        <InfoCard
          label="nTime (Timestamp)"
          value={`${notification.nTime} (${blockData.readableTimestamp})`}
          isMono
        />
        <InfoCard
          label="Previous Block Hash"
          value={blockData.previousBlockHash}
          isMono
        >
          {blockData.previousBlockHashIsValid ? (
            <a
              href={`https://mempool.space/block/${blockData.previousBlockHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm break-all text-accent-2 hover:text-white underline transition-colors"
              title="Open previous block on mempool.space"
            >
              {blockData.previousBlockHash}
            </a>
          ) : (
            <span className="font-mono text-sm break-all">
              {blockData.previousBlockHash}
            </span>
          )}
        </InfoCard>
      </div>
    </div>
  );
}

// Calculate difficulty from nBits using proper Bitcoin difficulty calculation
function calculateDifficultyFromNBits(nBits: string): number {
  try {
    const nBitsInt = parseInt(nBits, 16);
    
    // Extract exponent and mantissa from nBits (compact target representation)
    const exponent = nBitsInt >> 24;
    const mantissa = nBitsInt & 0xffffff;
    
    // Handle edge cases
    if (exponent <= 3) {
      return 0;
    }
    
    // Calculate current target from nBits
    // target = mantissa * 256^(exponent - 3)
    const currentTarget = mantissa * Math.pow(256, exponent - 3);
    
    // Bitcoin's maximum target (difficulty 1 target)
    // This corresponds to nBits = 0x1d00ffff 
    // maxTarget = 0x00ffff * 256^(0x1d - 3) = 0x00ffff * 256^26
    const maxTarget = 0x00ffff * Math.pow(256, 26);
    
    // Difficulty = maxTarget / currentTarget
    const difficulty = maxTarget / currentTarget;
    
    return Math.max(difficulty, 0);
  } catch (error) {
    console.error('Error calculating difficulty from nBits:', error);
    return 0;
  }
}

function isBlockHash(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

// Stratum sends the previous block hash with its 4-byte words reversed.
function stratumPrevHashToBlockHash(prevHash: string): string {
  const normalized = prevHash.toLowerCase();
  if (!isBlockHash(normalized)) return normalized;

  return normalized.match(/.{8}/g)?.reverse().join("") ?? normalized;
}

// Format hex timestamp to readable date
function formatHexTimestamp(hexTimestamp: string): string {
  try {
    const timestamp = parseInt(hexTimestamp, 16);
    return new Date(timestamp * 1000).toLocaleString();
  } catch (error) {
    console.error('Error formatting hex timestamp:', error);
    return 'Invalid timestamp';
  }
}
