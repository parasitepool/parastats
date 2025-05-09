"use client";

import Link from "next/link";
import MinerSetupGuide from "./MinerSetupGuide";

export default function UserAddressHelp({ address }: { address: string }) {
  return (
    <div className="w-full max-w-3xl mx-auto bg-background p-6 border border-border shadow-md">
      <h1 className="text-2xl font-bold mb-4 text-accent-1">
        Address Not Found
      </h1>

      <p className="mb-4">
        The address{" "}
        <span className="font-mono bg-foreground/10 px-2 py-1">
          {address}
        </span>{" "}
        was not found.
      </p>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-accent-2">
          Here are some things to check:
        </h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Verify that you&apos;ve entered the correct Bitcoin address</li>
          <li>Ensure the miner is on and connected to the internet</li>
          <li>Check that your miner&apos;s pool settings are correct</li>
          <li>Check that the miner appears to be submitting shares</li>
        </ul>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-accent-2">
          Setting up your miner:
        </h2>
        <MinerSetupGuide />
      </div>

      <div className="flex space-x-4 mt-8">
        <Link
          href="/"
          className="px-4 py-2 bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          Back to Home
        </Link>
        {/* <Link
          href="/help"
          className="px-4 py-2 border border-foreground text-foreground hover:bg-foreground/10 transition-colors"
        >
          View Full Documentation
        </Link> */}
      </div>
    </div>
  );
}
