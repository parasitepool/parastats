"use client";

import { StratumNotification } from "../../api/stratum/route";
import { getCoinbaseTxHash } from "../../utils/bitcoinUtils";
import MerkleTreeVisualization from "./MerkleTreeVisualization";
import { useMemo } from "react";

interface MerkleBranchesProps {
  notification: StratumNotification;
}

export default function MerkleBranches({ notification }: MerkleBranchesProps) {
  // Compute coinbase transaction hash for the tree visualization
  const coinbaseHash = useMemo(() => {
    try {
      // Use actual extranonce values from stratum notification, with fallbacks
      const extranonce1 = notification.extranonce1 || "00000000"; // 4 bytes fallback
      const extranonce2Size = notification.extranonce2Size || 4; // 4 bytes fallback
      const extranonce2 = "00".repeat(extranonce2Size);

      const coinbaseRaw =
        notification.coinbase1 +
        extranonce1 +
        extranonce2 +
        notification.coinbase2;

      return getCoinbaseTxHash(coinbaseRaw);
    } catch (error) {
      console.error('Error computing coinbase hash:', error);
      return '';
    }
  }, [notification.coinbase1, notification.coinbase2, notification.extranonce1, notification.extranonce2Size]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const copyAllBranches = () => {
    copyToClipboard(JSON.stringify(notification.merkleBranches, null, 2));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Merkle Branches ({notification.merkleBranches.length})
        </h3>
        <button
          onClick={copyAllBranches}
          className="text-sm px-3 py-1 bg-foreground/10 hover:bg-foreground/20 transition-colors text-accent-2 hover:text-foreground cursor-pointer"
        >
          Copy All
        </button>
      </div>

      {/* Merkle Tree Visualization */}
      {coinbaseHash && notification.merkleBranches.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-md font-semibold text-accent-2">Merkle Tree Structure</h4>
          <div className="bg-foreground/5 border border-border p-4">
            <MerkleTreeVisualization
              coinbaseTxHash={coinbaseHash}
              merkleBranches={notification.merkleBranches}
            />
          </div>
          <div className="text-xs text-accent-3">
            <strong>How to read:</strong> The coinbase transaction (green) and merkle branches (colored) 
            are combined step by step to build the merkle root (red). Each intermediate node represents 
            a hash of its children. These merkle branches prove that all transactions in the block are 
            included without revealing all transaction data, with each branch representing a path in the merkle tree.
          </div>
        </div>
      )}

      {/* Raw Merkle Branches List */}
      {/* <div className="space-y-3">
        <h4 className="text-md font-semibold text-accent-2">Raw Merkle Branch Data</h4>
        {notification.merkleBranches.length === 0 ? (
          <div className="text-center py-8 text-accent-3">
            No merkle branches in this block template
          </div>
        ) : (
          <div className="grid gap-3">
            {notification.merkleBranches.map((branch, index) => (
              <div 
                key={index}
                className="bg-foreground/5 border border-border p-4 hover:bg-foreground/10 transition-colors cursor-pointer"
                onClick={() => copyToClipboard(branch)}
                title="Click to copy"
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-8 h-8 flex items-center justify-center text-sm font-medium flex-shrink-0 text-black border border-black/20"
                    style={{ backgroundColor: getMerkleColor(branch) }}
                  >
                    {index}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm break-all">
                      {branch}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div> */}
    </div>
  );
}
