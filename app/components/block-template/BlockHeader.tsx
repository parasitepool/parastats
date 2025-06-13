"use client";

import { StratumNotification } from "../../api/stratum/route";
import { 
  decodeCoinbaseScriptSigInfo,
  getTransaction
} from "../../utils/bitcoinUtils";
import InfoCard from "./InfoCard";
import { useMemo } from "react";

interface BlockHeaderProps {
  notification: StratumNotification;
}

export default function BlockHeader({ notification }: BlockHeaderProps) {
  const blockData = useMemo(() => {
    try {
      // Use actual extranonce values from stratum notification, with fallbacks
      const extranonce1 = notification.extranonce1 || '00000000';
      const extranonce2Size = notification.extranonce2Size || 4;
      const extranonce2 = '00'.repeat(extranonce2Size);
      
      const coinbaseRaw = notification.coinbase1 + extranonce1 + extranonce2 + notification.coinbase2;
      
      // Parse coinbase transaction to get block height
      const tx = getTransaction(coinbaseRaw);
      const scriptSigInfo = decodeCoinbaseScriptSigInfo(tx.ins[0].script);
      
      // Calculate difficulty from nBits
      const difficulty = calculateDifficultyFromNBits(notification.nBits);
      
      // Format timestamp
      const readableTimestamp = formatHexTimestamp(notification.nTime);
      
      return {
        blockHeight: scriptSigInfo.height,
        difficulty,
        readableTimestamp,
        success: true
      };
    } catch (error) {
      console.error('Error parsing block data:', error);
      return {
        blockHeight: null,
        difficulty: 0,
        readableTimestamp: 'Invalid',
        success: false
      };
    }
  }, [notification.coinbase1, notification.coinbase2, notification.extranonce1, notification.extranonce2Size, notification.nBits, notification.nTime]);

  return (
    <div className="space-y-6">
      {/* Block Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InfoCard 
          label="Pool" 
          value={notification.pool} 
          className="md:col-span-1"
        />
        {blockData.blockHeight && (
          <InfoCard 
            label="Block Height" 
            value={blockData.blockHeight.toLocaleString()} 
            className="md:col-span-1 lg:col-span-1"
          />
        )}
        <InfoCard 
            label="Job type" 
            value={notification.cleanJobs ? 
              'New template (clean job)' : 
              'Existing template update'
            }
            className="md:col-span-1 lg:col-span-1"
          />
      </div>

      {/* Technical Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InfoCard 
          label="Job ID" 
          value={notification.jobId} 
          isMono 
        />
        <InfoCard 
          label="Version" 
          value={notification.version} 
          isMono 
        />
        <InfoCard 
          label="nBits (Target difficulty)" 
          value={`${notification.nBits} (${blockData.difficulty.toFixed(2)})`} 
          isMono 
        />
        <InfoCard 
          label="nTime (Timestamp)" 
          value={`${notification.nTime} (${blockData.readableTimestamp})`} 
          isMono 
        />
      </div>

      {/* Large Data Fields */}
      <div className="space-y-4">
        <InfoCard 
          label="Previous Block Hash" 
          value={notification.prevBlockHash} 
          isMono 
        />
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

// Format hex timestamp to readable date
function formatHexTimestamp(hexTimestamp: string): string {
  try {
    const timestamp = parseInt(hexTimestamp, 16);
    return new Date(timestamp * 1000).toLocaleString();
  } catch (error) {
    return 'Invalid timestamp';
  }
}
