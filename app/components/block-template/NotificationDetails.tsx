"use client";

import { StratumNotification } from "../../api/stratum/route";
import BlockHeader from "./BlockHeader";
import CoinbaseAnalysis from "./CoinbaseAnalysis";
import MerkleBranches from "./MerkleBranches";
import RawMessage from "./RawMessage";

interface NotificationDetailsProps {
  notification: StratumNotification;
}

export default function NotificationDetails({ notification }: NotificationDetailsProps) {
  return (
    <div className="bg-background border border-border shadow-lg">
      {/* Header */}
      {/* <div className="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Block Template - Job {notification.jobId}
          </h2>
          {blockHeight && (
            <p className="text-accent-2 mt-1">
              Block Height: <span className="font-mono font-medium">{blockHeight.toLocaleString()}</span>
            </p>
          )}
        </div>
        
        {showCloseButton && (
          <button
            onClick={onClose}
            className="p-2 text-accent-2 hover:text-foreground hover:bg-foreground/10 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div> */}

      {/* Content */}
      <div className="p-6 space-y-8">
        {/* Block Header Information */}
        <section>
          <BlockHeader notification={notification} />
        </section>

        {/* Coinbase Analysis */}
        <section>
          <CoinbaseAnalysis notification={notification} />
        </section>

        {/* Merkle Branches */}
        <section>
          <MerkleBranches notification={notification} />
        </section>

        {/* Raw Stratum Message */}
        <section>
          <RawMessage notification={notification} />
        </section>
      </div>
    </div>
  );
}
