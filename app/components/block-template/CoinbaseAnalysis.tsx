"use client";

import {
  computeCoinbaseOutputs,
  computeCoinbaseOutputValue,
  decodeCoinbaseScriptSigInfo,
  getCoinbaseTxDetails,
  getFormattedCoinbaseAsciiTag,
  getTransaction,
  type CoinbaseOutput,
  type CoinbaseScriptSigInfo,
  type CoinbaseTxDetails,
} from "../../utils/bitcoinUtils";
import { StratumNotification } from "../../api/stratum/route";
import InfoCard from "./InfoCard";
import { useMemo } from "react";

interface CoinbaseAnalysisProps {
  notification: StratumNotification;
}

export default function CoinbaseAnalysis({
  notification,
}: CoinbaseAnalysisProps) {
  // Construct the complete coinbase transaction
  const coinbaseData = useMemo(() => {
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

      const tx = getTransaction(coinbaseRaw);
      const outputs = computeCoinbaseOutputs(coinbaseRaw);
      const totalValue = computeCoinbaseOutputValue(coinbaseRaw);
      const scriptSigInfo = decodeCoinbaseScriptSigInfo(tx.ins[0].script);
      const txDetails = getCoinbaseTxDetails(coinbaseRaw);
      const asciiTag = getFormattedCoinbaseAsciiTag(
        notification.coinbase1,
        extranonce1,
        extranonce2Size,
        notification.coinbase2
      );

      return {
        raw: coinbaseRaw,
        outputs,
        totalValue,
        scriptSigInfo,
        txDetails,
        asciiTag,
        extranonce1,
        extranonce2Size,
        success: true,
      };
    } catch (error) {
      console.error("Error parsing coinbase:", error);
      return {
        raw: "",
        outputs: [] as CoinbaseOutput[],
        totalValue: 0,
        scriptSigInfo: { remainingScriptHex: "" } as CoinbaseScriptSigInfo,
        txDetails: {} as CoinbaseTxDetails,
        asciiTag: "",
        extranonce1: "",
        extranonce2Size: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }, [
    notification.coinbase1,
    notification.coinbase2,
    notification.extranonce1,
    notification.extranonce2Size,
  ]);

  if (!coinbaseData.success) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Coinbase Transaction Analysis</h3>
        <div className="p-4 bg-red-500/10 border border-red-500/20">
          <p className="text-red-400">
            Error parsing coinbase transaction: {coinbaseData.error}
          </p>
        </div>
      </div>
    );
  }

  const addressOutputs = coinbaseData.outputs.filter(
    (o) => o.type === "address"
  );
  const dataOutputs = coinbaseData.outputs.filter((o) => o.type === "nulldata");

  return (
    <div className="space-y-6">
      {/* ScriptSig Analysis */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold">ScriptSig Analysis</h4>

        <div className="grid lg:grid-cols-2 gap-4">
          {coinbaseData.scriptSigInfo.height && (
            <InfoCard
              label="Block Height (BIP 34)"
              value={coinbaseData.scriptSigInfo.height.toString()}
            >
              <div className="text-base mb-1">
                {coinbaseData.scriptSigInfo.height.toString()}
              </div>
              <div className="text-xs text-accent-3">
                Extracted from coinbase scriptSig
              </div>
            </InfoCard>
          )}

          {coinbaseData.txDetails.inputSequence !== undefined && (
            <InfoCard
              label="Input Sequence"
              value={`0x${coinbaseData.txDetails.inputSequence.toString(16)}`}
            >
              <div className="font-mono text-base mb-1">
                0x{coinbaseData.txDetails.inputSequence.toString(16)}
              </div>
              <div className="text-xs text-accent-3">
                Usually 0xffffffff for coinbase
              </div>
            </InfoCard>
          )}

          {coinbaseData.extranonce1 && (
            <InfoCard
              label="Extranonce1 (Pool)"
              value={coinbaseData.extranonce1}
              isMono
              copyable
            >
              <div className="font-mono text-base mb-1">
                {coinbaseData.extranonce1}
              </div>
              <div className="text-xs text-accent-3">
                Pool-provided nonce part ({coinbaseData.extranonce1.length / 2}{" "}
                bytes)
              </div>
            </InfoCard>
          )}

          {coinbaseData.extranonce2Size !== undefined && (
            <InfoCard
              label="Extranonce2 Size"
              value={`${coinbaseData.extranonce2Size} bytes`}
            >
              <div className="text-base mb-1">
                {coinbaseData.extranonce2Size} bytes
              </div>
              <div className="text-xs text-accent-3">
                Miner-controlled nonce space size
              </div>
            </InfoCard>
          )}
        </div>

        {coinbaseData.scriptSigInfo.auxPowData && (
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-accent-2">
              Auxiliary Proof-of-Work (AuxPOW)
            </h5>
            <div className="grid lg:grid-cols-2 gap-4">
              <InfoCard
                label="Aux Hash/Root"
                value={
                  coinbaseData.scriptSigInfo.auxPowData.auxHashOrRoot || "N/A"
                }
                isMono
                copyable
              />

              {coinbaseData.scriptSigInfo.auxPowData.merkleSize !==
                undefined && (
                <InfoCard
                  label="Merkle Size"
                  value={coinbaseData.scriptSigInfo.auxPowData.merkleSize.toString()}
                />
              )}

              {coinbaseData.scriptSigInfo.auxPowData.nonce !== undefined && (
                <InfoCard
                  label="Nonce"
                  value={coinbaseData.scriptSigInfo.auxPowData.nonce.toString()}
                />
              )}
            </div>
          </div>
        )}

        <InfoCard
          label="ASCII Tag / Pool Signature"
          value={
            coinbaseData.asciiTag ||
            "No readable ASCII found in script signature"
          }
        >
          <div
            className={`${
              coinbaseData.asciiTag ? "font-mono" : ""
            } text-base mb-1`}
          >
            {coinbaseData.asciiTag ||
              "No readable ASCII found in script signature"}
          </div>
        </InfoCard>

        {coinbaseData.txDetails.witnessCommitmentNonce && (
          <InfoCard
            label="Witness Commitment Nonce"
            value={coinbaseData.txDetails.witnessCommitmentNonce}
            isMono
            copyable
          >
            <div className="font-mono text-base mb-1">
              {coinbaseData.txDetails.witnessCommitmentNonce}
            </div>
            <div className="text-xs text-accent-3">
              Nonce for the witness commitment
            </div>
          </InfoCard>
        )}
      </div>

      {/* Output Analysis */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold">Outputs Analysis</h4>

        {/* Transaction Overview */}
        <div className="grid lg:grid-cols-3 gap-4">
          <InfoCard
            label="Total Block Reward"
            value={`${(coinbaseData.totalValue / 100000000).toFixed(8)} BTC`}
          >
            <div className="font-mono text-base mb-1">
              {(coinbaseData.totalValue / 100000000).toFixed(8)}{" "}
              <span className="text-sm text-accent-2">BTC</span>
            </div>
            <div className="text-xs text-accent-3">
              {coinbaseData.totalValue.toLocaleString()} satoshis
            </div>
          </InfoCard>

          <InfoCard
            label="Number of Recipients"
            value={coinbaseData.outputs.length.toString()}
          >
            <div className="text-base mb-1">
              {coinbaseData.outputs.length} total output
              {coinbaseData.outputs.length !== 1 ? "s" : ""}
            </div>
            <div className="text-xs text-accent-3">
              {addressOutputs.length} address
              {addressOutputs.length !== 1 ? "es" : ""}, {dataOutputs.length}{" "}
              data output{dataOutputs.length !== 1 ? "s" : ""}
            </div>
          </InfoCard>

          <InfoCard
            label="Transaction Details"
            value={`Version ${coinbaseData.txDetails.txVersion || "Unknown"}`}
          >
            <div className="text-base mb-1">
              Version {coinbaseData.txDetails.txVersion || "Unknown"}
            </div>
            <div className="text-xs text-accent-3">
              Locktime: {coinbaseData.txDetails.txLocktime || 0}
            </div>
          </InfoCard>
        </div>

        <div className="space-y-4">
          {coinbaseData.outputs.map((output, index) => (
            <OutputCard key={index} output={output} index={index} />
          ))}
        </div>
      </div>

      {/* Complete Transaction */}
      {/* <InfoCard 
        label={`Complete Coinbase Transaction (${coinbaseData.raw.length / 2} bytes)`}
        value={coinbaseData.raw}
        isMono
        copyable
      >
        <div className="mt-2 p-3 bg-foreground/10 rounded max-h-32 overflow-y-auto">
          <div className="font-mono text-xs break-all text-accent-3">
            {coinbaseData.raw}
          </div>
        </div>
      </InfoCard> */}
    </div>
  );
}

// Component for individual output display - Compact version
function OutputCard({
  output,
  index,
}: {
  output: CoinbaseOutput;
  index: number;
}) {
  const isOpReturn = output.type === "nulldata";

  return (
    <div className="p-3 bg-foreground/5 border border-border">
      {/* Header with output info and value in one line */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Output #{index}</span>
          <span
            className={`px-1.5 py-0.5 text-xs rounded ${
              output.type === "address"
                ? "bg-foreground/20 text-foreground"
                : output.type === "nulldata"
                ? "bg-foreground/20 text-foreground"
                : "bg-foreground/20 text-foreground"
            }`}
          >
            {output.type === "address"
              ? "Address"
              : output.type === "nulldata"
              ? "Data"
              : "Unknown"}
          </span>
        </div>

        {!isOpReturn && (
          <div className="font-mono text-sm font-semibold">
            {(output.value / 100000000).toFixed(8)}{" "}
            <span className="text-xs text-accent-2">BTC</span>
          </div>
        )}
      </div>

      {/* Address/Script - more compact */}
      {output.address && (
        <div className="mb-2">
          {output.address === "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" ? (
            <div className="font-mono text-xs bg-foreground/10 p-1.5 rounded break-all text-accent-3">
              Block Miner&apos;s Address
            </div>
          ) : output.address === "bc1qkgef7pl8vdrtuc4wk8fssycz366xp5ukzsm8gp" ? (
            <div className="space-y-1">
              <div className="font-mono text-xs bg-foreground/10 p-1.5 rounded break-all text-accent-3">
                {output.address}
              </div>
              <div className="text-xs text-foreground font-medium italic">
                Lightning Payout Deposit Address
              </div>
            </div>
          ) : (
            <div className="font-mono text-xs bg-foreground/10 p-1.5 rounded break-all text-accent-3">
              {output.address}
            </div>
          )}
        </div>
      )}

      {/* OP_RETURN data - compact */}
      {output.decodedData && (
        <div className="mb-2">
          <div className="text-xs text-accent-2 font-medium mb-1">
            {output.decodedData.protocol}
          </div>
          {output.decodedData.details && (
            <div className="text-xs space-y-0.5">
              {Object.entries(output.decodedData.details).map(
                ([key, value]) => (
                  <div key={key} className="flex gap-1.5">
                    <span className="text-accent-3 capitalize min-w-0">
                      {key.replace(/([A-Z])/g, " $1")}:
                    </span>
                    <span className="font-mono break-all text-accent-2">
                      {String(value)}
                    </span>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* ScriptPubKey - collapsible/minimal */}
      {output.address !== "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" && (
        <details className="text-xs">
          <summary className="text-accent-3 cursor-pointer hover:text-accent-2">
            ScriptPubKey ({output.hex?.length || 0} chars)
          </summary>
          <div className="font-mono text-xs text-accent-3 break-all bg-foreground/10 p-1.5 rounded mt-1">
            {output.hex}
          </div>
        </details>
      )}
    </div>
  );
}
