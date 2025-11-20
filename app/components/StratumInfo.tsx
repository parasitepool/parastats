"use client";

import { useState } from "react";
import { StratumIcon, CopyIcon, CheckIcon } from "@/app/components/icons";

interface StratumInfoProps {
  userId: string;
  isLoading?: boolean;
}

export default function StratumInfo({ userId, isLoading = false }: StratumInfoProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const stratumUrl = "parasite.wtf:42069";
  const stratumUsername = `${userId}.WORKER_NAME`;

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (isLoading) {
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

        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {/* Stratum URL shimmer */}
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-accent-2 mb-2">Stratum URL</h3>
            <div className="bg-secondary p-3 sm:p-4 border border-border h-[5rem] flex items-center">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
            </div>
          </div>

          {/* Stratum Username shimmer */}
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-accent-2 mb-2">Stratum Username</h3>
            <div className="bg-secondary p-3 sm:p-4 border border-border h-[5rem] flex items-center">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {/* Stratum URL */}
        <div className="flex flex-col">
          <h3 className="text-sm font-medium text-accent-2 mb-2">Stratum URL</h3>
          <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex items-center justify-between gap-2 h-[5rem]">
            <p className="text-lg sm:text-xl font-semibold whitespace-nowrap overflow-x-auto flex-1 scrollbar-hide">
              {stratumUrl}
            </p>
            <button
              onClick={() => copyToClipboard(stratumUrl, "url")}
              className="flex items-center gap-1 px-2 py-1 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs font-medium flex-shrink-0"
              title="Copy to clipboard"
            >
              {copiedField === "url" ? (
                <>
                  <CheckIcon className="w-3 h-3" />
                  <span>Copy</span>
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
          <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex items-center justify-between gap-2 h-[5rem]">
            <p className="text-lg sm:text-xl font-semibold whitespace-nowrap overflow-x-auto flex-1 scrollbar-hide">
              {stratumUsername}
            </p>
            <button
              onClick={() => copyToClipboard(stratumUsername, "username")}
              className="flex items-center gap-1 px-2 py-1 bg-foreground text-background hover:bg-gray-700 transition-colors text-xs font-medium flex-shrink-0"
              title="Copy to clipboard"
            >
              {copiedField === "username" ? (
                <>
                  <CheckIcon className="w-3 h-3" />
                  <span>Copy</span>
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
      </div>
    </div>
  );
}

