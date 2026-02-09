"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { StratumIcon, CopyIcon, CheckIcon } from "@/app/components/icons";

interface StratumInfoProps {
  userId: string;
  isLoading?: boolean;
}

export default function StratumInfo({ userId, isLoading = false }: StratumInfoProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [useHighDiff, setUseHighDiff] = useState(false);

  const stratumUrl = useHighDiff ? "parasite.wtf:42068" : "parasite.wtf:42069";
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
          {/* Endpoint shimmer */}
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-accent-2 mb-2">Endpoint</h3>
            <div className="bg-secondary p-3 sm:p-4 border border-border h-[5rem] flex items-center">
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2"></div>
            </div>
          </div>

          {/* Username shimmer */}
          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-accent-2 mb-2">Username</h3>
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
        {/* Endpoint */}
        <div className="flex flex-col">
          <h3 className="text-sm font-medium text-accent-2 mb-2">Endpoint</h3>
          <div className="bg-secondary p-3 sm:p-4 border border-border flex-1 flex items-center justify-between gap-2 h-[5rem]">
            <p className="text-lg sm:text-xl font-semibold whitespace-nowrap overflow-x-auto flex-1 scrollbar-hide">
              parasite.wtf:
              <motion.span
                key={String(useHighDiff)}
                initial={{ x: 0 }}
                animate={{
                  x: [0, -4, 4, -4, 4, 0],
                  transition: { duration: 0.4, ease: "easeInOut" }
                }}
                className="inline-block"
              >
                {useHighDiff ? "42068" : "42069"}
              </motion.span>
            </p>
            <button
              onClick={() => setUseHighDiff(prev => !prev)}
              className={`flex items-center gap-1 px-2 py-1 text-xs font-medium flex-shrink-0 transition-colors ${
                useHighDiff
                  ? "bg-foreground text-background hover:bg-foreground/80"
                  : "bg-foreground/50 text-background/70 hover:bg-foreground/80"
              }`}
              title={useHighDiff ? "Currently using high difficulty port (1,000,000 initial diff). Click to switch to standard port." : "Switch to high difficulty port. Sets the initial difficulty to 1,000,000. Only use for powerful miners."}
            >
              <span className={useHighDiff ? "" : "line-through"}>high diff</span>
            </button>
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

        {/* Username */}
        <div className="flex flex-col">
          <h3 className="text-sm font-medium text-accent-2 mb-2">Username</h3>
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

