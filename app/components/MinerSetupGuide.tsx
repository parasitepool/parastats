'use client';

import Link from 'next/link';

export default function MinerSetupGuide() {
  return (
    <div className="space-y-4">
      <div className="border border-foreground/20 rounded-lg p-4 space-y-3">
        <p className="text-sm text-foreground/60 uppercase tracking-wide">Choose your setup:</p>
        <div className="grid gap-3">
          <div className="flex gap-3">
            <span className="font-mono text-foreground/50 shrink-0">A.</span>
            <div>
              <p className="font-medium">With Xverse wallet</p>
              <p className="text-sm text-foreground/70">
                Install{" "}
                <Link
                  href="https://www.xverse.app/"
                  className="underline hover:text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Xverse
                </Link>
                {" "}→ Connect at{" "}
                <Link
                  href="https://parasite.space"
                  className="underline hover:text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  parasite.space
                </Link>
                {" "}→ Continue below
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="font-mono text-foreground/50 shrink-0">B.</span>
            <div>
              <p className="font-medium">Direct mining</p>
              <p className="text-sm text-foreground/70">
                Have your BTC address ready → Continue below
              </p>
            </div>
          </div>
        </div>
      </div>

      <ol className="list-decimal pl-4 space-y-2 ml-6">
        <li>Connect your Bitcoin miner and go to the &quot;Pool Settings&quot; tab</li>
        <li>
          Configure your mining settings:
          <ul className="list-disc pl-4 mt-2">
            <li>
              Stratum URL:{" "}
              <span className="font-mono bg-foreground/10 px-2 py-1 rounded">
                parasite.wtf
              </span>
            </li>
            <li>
              Port:{" "}
              <span className="font-mono bg-foreground/10 px-2 py-1 rounded">
                42069
              </span>
            </li>
            <li>
              Depending on your miner it will look something like this:<br />
              <span className="font-mono bg-foreground/10 px-2 py-0.25 rounded">
                parasite.wtf:42069<br />
              </span>
              <span className="font-mono bg-foreground/10 px-2 py-0.25 rounded">
                stratum+tcp://parasite.wtf:42069
              </span>
            </li>
          </ul>
        </li>
        <li>
          Set your username using this format:
          <div className="font-mono bg-foreground/10 px-2 py-1 rounded mt-2 break-words">
            BTC_ADDRESS.WORKER_NAME
          </div>
          <p className="text-sm mt-2 italic break-words">
            <strong>Examples:</strong><br />
            bc1qnotarealaddress.steveMiner<br />
            bc1qnotarealaddress.jillAxe
          </p>
        </li>
        <li>Use any password (it&apos;s not checked)</li>
        <li>Save your configuration and restart if needed</li>
        <li>
          Once your miner is up and running:
          <ul className="list-disc pl-4 mt-2">
            <li>Head to your account page to see your stats
              <p className="text-sm mt-2 italic break-words">
                You can either put your BTC_ADDRESS in the search bar or press the account button on the connect menu item
              </p>
            </li>
          </ul>
        </li>
        <li>
          If you have a very powerful miner you can also use the high diff port at {" "}
          <span className="font-mono bg-foreground/10 px-2 py-1 rounded">
            42068
          </span>
        </li>
      </ol>
    </div>
  );
} 
