'use client';

import Link from 'next/link';

export default function MinerSetupGuide() {
  return (
    <ol className="list-decimal pl-4 space-y-2 ml-6">
      <li>
        Install the Xverse wallet extension from{" "}
        <Link
          href="https://www.xverse.app/"
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          xverse.app
        </Link>: 
        <ul className="list-disc pl-4 mt-2">
          <li>Create a brand new wallet (not just a new account)</li>
          <li>Ensure there are no Bitcoin or Ordinals on it</li>
          <li>Securely store your seed phrase</li>
        </ul>
      </li>
      <li>
        Visit{" "}
        <Link
          href="https://parasite.sati.pro"
          className="underline hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          parasite.sati.pro
        </Link>{" "}
        and connect your new Xverse wallet:
        <ul className="list-disc pl-4 mt-2">
          <li>Complete the wallet connect signature</li>
          <li>Copy your generated &quot;static ln address&quot; for later use</li>
        </ul>
      </li>
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
        </ul>
      </li>
      <li>
        Set your username using this format:
        <div className="font-mono bg-foreground/10 px-2 py-1 rounded mt-2 break-words">
          xverseL1address.username.staticlnaddress@staticdomain
        </div>
        <p className="text-sm mt-2">
          <strong>Important:</strong> Use the same ending/domain (@sati.pro or @parasite.sati.pro) that appears in your generated static ln address
        </p>
        <p className="text-sm mt-2 italic break-words">
          <strong>Examples:</strong><br/>
          bc1qnotarealaddress.steveMiner.d1a7a1bef2@sati.pro<br/>
          bc1qnotarealaddress.jillAxe.a5f9b2c8e1@parasite.sati.pro
        </p>
      </li>
      <li>Use any password (it&apos;s not checked)</li>
      <li>Save your configuration and restart if needed</li>
    </ol>
  );
} 