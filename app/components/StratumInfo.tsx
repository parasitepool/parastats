"use client";

import { useState } from "react";
import { StratumIcon, CopyIcon, CheckIcon } from "@/app/components/icons";

interface StratumInfoProps {
  userId: string;
  lnAddress: string | null;
}

export default function StratumInfo({ userId, lnAddress }: StratumInfoProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const stratumUrl = "parasite.wtf:42069";
  const stratumUsername = lnAddress 
    ? `${userId}.WORKER_NAME.${lnAddress}`
    : `${userId}.WORKER_NAME.username@domain`;

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="bg-background p-4 sm:p-6 shadow-md border border-border h-full">
      <div className="flex items-center mb-4 sm:mb-6">
        <div className="flex items-center">
          <div className="mr-2 text-accent-3">
            <StratumIcon />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold">Stratum</h2>
        </div>
      </div>

      <div className="space-y-4">
        {/* Stratum URL */}
        <div className="flex flex-col">
          <h3 className="text-sm font-medium text-accent-2 mb-2">Stratum URL</h3>
          <div className="bg-secondary p-3 sm:p-4 border border-border flex items-center justify-between gap-2">
            <p className="text-lg sm:text-xl font-semibold font-mono break-all flex-1">
              {stratumUrl}
            </p>
            <button
              onClick={() => copyToClipboard(stratumUrl, "url")}
              className="flex items-center gap-1 px-2 py-2 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs font-medium flex-shrink-0"
              title="Copy to clipboard"
            >
              {copiedField === "url" ? (
                <>
                  <CheckIcon className="w-3 h-3" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <CopyIcon className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stratum Username */}
        <div className="flex flex-col">
          <h3 className="text-sm font-medium text-accent-2 mb-2">Stratum Username</h3>
          <div className="bg-secondary p-3 sm:p-4 border border-border flex items-center justify-between gap-2">
            <p className="text-sm sm:text-base font-semibold font-mono break-all flex-1">
              {stratumUsername}
            </p>
            <button
              onClick={() => copyToClipboard(stratumUsername, "username")}
              className="flex items-center gap-1 px-2 py-2 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs font-medium flex-shrink-0"
              title="Copy to clipboard"
            >
              {copiedField === "username" ? (
                <>
                  <CheckIcon className="w-3 h-3" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <CopyIcon className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Helper text */}
        {!lnAddress && (
          <div className="text-xs text-accent-2 bg-accent-1/5 p-2 border border-border">
            <p>
              <strong>Note:</strong> Complete account activation to get your personalized stratum username.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

