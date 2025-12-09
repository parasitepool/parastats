import { Transaction, address, networks } from "bitcoinjs-lib";

/**
 * Performance Optimization Strategy:
 * 1. Shared Transaction Cache: We use a shared transaction cache to avoid parsing the same
 * transaction multiple times across different utility functions.
 * 2. Function-Specific Caches: Each function has its own cache for its specific output.
 * 3. Cache Size Limits: All caches have size limits to prevent memory leaks.
 * 4. Optimal Function Call Order: For best performance, call computeCoinbaseOutputs first,
 * then other functions that use the same transaction.
 */

// Maximum size for all caches to prevent memory leaks
const MAX_CACHE_SIZE = 1000;

// Shared transaction cache
const transactionCache = new Map<string, Transaction>();

// Cache for coinbase script ASCII
const coinbaseScriptAsciiCache = new Map<string, string>();
const coinbaseOutputValueCache = new Map<string, number>();

// Type definition for the output structure - Exported
export interface CoinbaseOutput {
  type: 'address' | 'nulldata' | 'unknown';
  value: number; // Value in satoshis
  address?: string;
  hex?: string; // Full script hex for OP_RETURN/Unknown
  decodedData?: OpReturnData | null; // Decoded OP_RETURN data
}

// Type definition for decoded OP_RETURN data
export interface OpReturnData {
  protocol: string;
  details?: {
    // CoreDAO specific
    validatorAddress?: string;
    rewardAddress?: string;
    // RSK specific
    rskBlockHash?: string;
    // ExSat specific
    synchronizerAccount?: string;
    // Hathor specific
    auxBlockHash?: string;
    // Syscoin specific
    relatedHash?: string; // If merge-mining: Syscoin block hash? Else: TXID, asset ID, etc.
    suffixDataHex?: string; // If merge-mining: Flags/version? Else: Other data
    // Elastos specific
    elastosBlockHash?: string;
    // Generic fields for other protocols
    [key: string]: unknown;
  };
  dataHex?: string; // Raw hex data for fallback display
}

// Type for coinbase scriptSig information
export interface CoinbaseScriptSigInfo {
  height?: number;
  auxPowData?: AuxPowData | null;
  remainingScriptHex: string; // Everything else in the script after height and auxpow
}

// Type for AuxPOW data
export interface AuxPowData {
  auxHashOrRoot?: string;
  merkleSize?: number;
  nonce?: number;
}

// Type for other coinbase transaction details
export interface CoinbaseTxDetails {
  txVersion?: number;
  inputSequence?: number;
  txLocktime?: number;
  witnessCommitmentNonce?: string | null;
}

// Cache size management
function manageCacheSize<K, V>(cache: Map<K, V>): void {
  if (cache.size > MAX_CACHE_SIZE) {
    const keysToDelete = Array.from(cache.keys()).slice(0, Math.floor(MAX_CACHE_SIZE / 2));
    keysToDelete.forEach(key => cache.delete(key));
  }
}

// Get transaction with caching
export function getTransaction(coinbaseRaw: string): Transaction {
  if (transactionCache.has(coinbaseRaw)) {
    return transactionCache.get(coinbaseRaw)!;
  }

  const tx = Transaction.fromHex(coinbaseRaw);
  transactionCache.set(coinbaseRaw, tx);
  manageCacheSize(transactionCache);
  
  return tx;
}

// Compute coinbase output value with caching
export function computeCoinbaseOutputValue(coinbaseRaw: string): number {
  if (coinbaseOutputValueCache.has(coinbaseRaw)) {
    return coinbaseOutputValueCache.get(coinbaseRaw)!;
  }
  
  try {
    const tx = getTransaction(coinbaseRaw);
    const totalValue = tx.outs.reduce((sum, out) => sum + Number(out.value), 0);
    
    coinbaseOutputValueCache.set(coinbaseRaw, totalValue);
    manageCacheSize(coinbaseOutputValueCache);
    
    return totalValue;
  } catch (error) {
    console.error('Error computing coinbase output value:', error);
    return 0;
  }
}

// Function to decode OP_RETURN data
function decodeOpReturnData(opReturnHex: string): OpReturnData | null {
  try {
    // Remove OP_RETURN opcode (6a) and get the data part
    const withoutOpReturn = opReturnHex.startsWith('6a') ? opReturnHex.substring(2) : opReturnHex;
    
    // Parse push data opcode
    if (withoutOpReturn.length < 2) return null;
    
    const pushOp = parseInt(withoutOpReturn.substring(0, 2), 16);
    let dataStart = 2;
    let dataLength = 0;
    
    if (pushOp <= 75) {
      dataLength = pushOp;
    } else if (pushOp === 0x4c) { // OP_PUSHDATA1
      if (withoutOpReturn.length < 4) return null;
      dataLength = parseInt(withoutOpReturn.substring(2, 4), 16);
      dataStart = 4;
    } else if (pushOp === 0x4d) { // OP_PUSHDATA2
      if (withoutOpReturn.length < 6) return null;
      dataLength = parseInt(withoutOpReturn.substring(4, 6) + withoutOpReturn.substring(2, 4), 16);
      dataStart = 6;
    } else if (pushOp === 0x4e) { // OP_PUSHDATA4
      if (withoutOpReturn.length < 10) return null;
      dataLength = parseInt(
        withoutOpReturn.substring(8, 10) + withoutOpReturn.substring(6, 8) +
        withoutOpReturn.substring(4, 6) + withoutOpReturn.substring(2, 4), 16
      );
      dataStart = 10;
    } else {
      return null;
    }
    
    const dataHex = withoutOpReturn.substring(dataStart, dataStart + dataLength * 2);
    if (dataHex.length !== dataLength * 2) return null;
    
    // Try to decode known protocols
    const protocol = identifyProtocol(dataHex);
    const details = decodeProtocolData(dataHex, protocol);
    
    return {
      protocol,
      details,
      dataHex
    };
  } catch (error) {
    console.error('Error decoding OP_RETURN data:', error);
    return null;
  }
}

// Identify the protocol from OP_RETURN data
function identifyProtocol(dataHex: string): string {
  if (dataHex.length < 8) return 'Unknown';
  
  // Check for merged mining magic bytes
  const mergedMiningMagics = [
    'fabe6d6d', // Standard merged mining
    '2cfabe6d6d', // With prefix
  ];
  
  for (const magic of mergedMiningMagics) {
    if (dataHex.toLowerCase().includes(magic)) {
      // Try to identify specific chains
      if (dataHex.length >= 72) { // Enough for hash + some identification
        // This is a simplified detection - in practice you'd need more sophisticated logic
        return 'Merged Mining';
      }
    }
  }
  
  // Check for other known protocol patterns
  if (dataHex.startsWith('434f5245')) { // "CORE" in ASCII
    return 'CoreDAO';
  }
  
  if (dataHex.startsWith('52534b')) { // "RSK" in ASCII
    return 'RSK';
  }
  
  return 'Unknown';
}

// Decode protocol-specific data
function decodeProtocolData(dataHex: string, protocol: string): Record<string, unknown> | undefined {
  switch (protocol) {
    case 'CoreDAO':
      return decodeCoreDAOData(dataHex);
    case 'RSK':
      return decodeRSKData(dataHex);
    case 'Merged Mining':
      return decodeMergedMiningData(dataHex);
    default:
      return undefined;
  }
}

function decodeCoreDAOData(dataHex: string): Record<string, unknown> | undefined {
  // Simplified CoreDAO decoding - extend as needed
  try {
    if (dataHex.length >= 48) { // At least 24 bytes for addresses
      return {
        validatorAddress: dataHex.substring(8, 48), // Skip "CORE" prefix
        rewardAddress: dataHex.length > 48 ? dataHex.substring(48, 88) : undefined
      };
    }
  } catch {
    console.error('Error decoding CoreDAO data');
  }
  return undefined;
}

function decodeRSKData(dataHex: string): Record<string, unknown> | undefined {
  // Simplified RSK decoding
  try {
    if (dataHex.length >= 70) { // "RSK" + 32-byte hash
      return {
        rskBlockHash: dataHex.substring(6, 70) // Skip "RSK" prefix
      };
    }
  } catch {
    console.error('Error decoding RSK data');
  }
  return undefined;
}

function decodeMergedMiningData(dataHex: string): Record<string, unknown> | undefined {
  // Simplified merged mining decoding
  try {
    const magicIndex = dataHex.toLowerCase().indexOf('fabe6d6d');
    if (magicIndex !== -1) {
      const afterMagic = dataHex.substring(magicIndex + 8);
      if (afterMagic.length >= 64) {
        return {
          auxBlockHash: afterMagic.substring(0, 64)
        };
      }
    }
  } catch {
    console.error('Error decoding merged mining data');
  }
  return undefined;
}

// Function to compute coinbase outputs with proper address decoding
export function computeCoinbaseOutputs(coinbaseRaw: string): CoinbaseOutput[] {
  try {
    const tx = getTransaction(coinbaseRaw);
    const outputs: CoinbaseOutput[] = [];
    
    for (const out of tx.outs) {
      const scriptHex = Buffer.from(out.script).toString('hex');
      let outputType: 'address' | 'nulldata' | 'unknown' = 'unknown';
      let outputAddress: string | undefined;
      let decodedData: OpReturnData | null = null;
      
      // Check if it's OP_RETURN
      if (scriptHex.startsWith('6a')) {
        outputType = 'nulldata';
        decodedData = decodeOpReturnData(scriptHex);
      } else {
        // Try to decode as address
        try {
          outputAddress = address.fromOutputScript(Buffer.from(out.script), networks.bitcoin);
          outputType = 'address';
        } catch {
          // If we can't decode as address, check for known script patterns
          outputAddress = parseScriptToReadableFormat(scriptHex);
          outputType = outputAddress ? 'address' : 'unknown';
        }
      }
      
      outputs.push({
        type: outputType,
        value: Number(out.value),
        address: outputAddress,
        hex: scriptHex,
        decodedData
      });
    }
    
    return outputs;
  } catch (error) {
    console.error('Error computing coinbase outputs:', error);
    return [];
  }
}

// Helper function to parse script to readable format when address decoding fails
function parseScriptToReadableFormat(scriptHex: string): string | undefined {
  try {
    // P2PKH: 76a914{20 bytes}88ac
    if (scriptHex.startsWith('76a914') && scriptHex.endsWith('88ac') && scriptHex.length === 50) {
      const hash160 = scriptHex.substring(6, 46);
      return `P2PKH (${hash160})`;
    }
    
    // P2SH: a914{20 bytes}87
    if (scriptHex.startsWith('a914') && scriptHex.endsWith('87') && scriptHex.length === 46) {
      const hash160 = scriptHex.substring(4, 44);
      return `P2SH (${hash160})`;
    }
    
    // P2WPKH: 0014{20 bytes}
    if (scriptHex.startsWith('0014') && scriptHex.length === 44) {
      const hash160 = scriptHex.substring(4);
      return `P2WPKH (${hash160})`;
    }
    
    // P2WSH: 0020{32 bytes}
    if (scriptHex.startsWith('0020') && scriptHex.length === 68) {
      const hash256 = scriptHex.substring(4);
      return `P2WSH (${hash256})`;
    }
    
    // P2TR: 5120{32 bytes}
    if (scriptHex.startsWith('5120') && scriptHex.length === 68) {
      const taproot = scriptHex.substring(4);
      return `P2TR (${taproot})`;
    }
    
    return `Unknown Script (${scriptHex.substring(0, Math.min(20, scriptHex.length))}...)`;
  } catch {
    return undefined;
  }
}

// AuxPOW magic bytes for detection
const AUXPOW_MAGIC_BYTES = Buffer.from([0xfa, 0xbe, 0x6d, 0x6d]);

// Get formatted coinbase ASCII tag
export function getFormattedCoinbaseAsciiTag(
  coinbase1: string,
  extranonce1: string,
  extranonce2Length: number,
  coinbase2: string
): string {
  if (coinbaseScriptAsciiCache.has(coinbase1 + extranonce1 + coinbase2)) {
    return coinbaseScriptAsciiCache.get(coinbase1 + extranonce1 + coinbase2)!;
  }
  
  try {
    const cbRaw = coinbase1 + extranonce1 + ('00'.repeat(extranonce2Length)) + coinbase2;
    const { remainingScriptHex } = decodeCoinbaseScriptSigInfo(Buffer.from(getTransaction(cbRaw).ins[0].script));
    
    const formatted = formatScriptAsAscii(remainingScriptHex);
    
    coinbaseScriptAsciiCache.set(coinbase1 + extranonce1 + coinbase2, formatted);
    manageCacheSize(coinbaseScriptAsciiCache);
    
    return formatted;
  } catch (error) {
    console.error('Error getting formatted coinbase ASCII:', error);
    return '';
  }
}

// Format script as ASCII with readable characters - Enhanced version
function formatScriptAsAscii(scriptHex: string): string {
  if (!scriptHex) return '';
  
  try {
    // Convert hex to buffer first
    const buffer = Buffer.from(scriptHex, 'hex');
    
    // Convert to ASCII string
    const ascii = buffer.toString('ascii');
    
    // Filter out non-printable characters (keep only space ' ' to tilde '~')
    const printable = ascii
      .split("")
      .filter((ch) => ch >= " " && ch <= "~")
      .join("");
    
    // Limit length and add ellipsis if needed
    const maxLength = 80;
    const result = printable.length > maxLength 
      ? printable.substring(0, maxLength) + "…" 
      : printable;
    
    return result || '';
  } catch (err) {
    console.error("Error formatting script hex to ASCII:", err);
    return '';
  }
}

// Decode coinbase scriptSig information
export function decodeCoinbaseScriptSigInfo(scriptSig: Buffer): CoinbaseScriptSigInfo {
  try {
    let height: number | undefined;
    let auxPowData: AuxPowData | null = null;
    const remainingParts: Buffer[] = [];
    let currentIndex = 0;

    // Extract height (BIP 34) - first byte is length, followed by height in little-endian
    if (scriptSig.length > 0) {
      const heightLength = scriptSig[0];
      if (heightLength > 0 && heightLength <= 8 && scriptSig.length >= heightLength + 1) {
        let heightValue = 0;
        for (let i = 0; i < heightLength; i++) {
          heightValue += scriptSig[1 + i] * Math.pow(256, i);
        }
        height = heightValue;
        currentIndex = heightLength + 1;
      }
    }

    // Look for AuxPOW magic bytes
    const magicIndex = scriptSig.indexOf(AUXPOW_MAGIC_BYTES, currentIndex);
    if (magicIndex !== -1) {
      // Extract AuxPOW data
      const auxDataStart = magicIndex + AUXPOW_MAGIC_BYTES.length;
      if (scriptSig.length >= auxDataStart + 32) {
        const auxHashOrRoot = scriptSig.slice(auxDataStart, auxDataStart + 32).toString('hex');
        
        auxPowData = { auxHashOrRoot };
        
        // Try to extract additional AuxPOW fields if present
        if (scriptSig.length >= auxDataStart + 32 + 4) {
          const merkleSize = scriptSig.readUInt32LE(auxDataStart + 32);
          auxPowData.merkleSize = merkleSize;
        }
        
        if (scriptSig.length >= auxDataStart + 32 + 8) {
          const nonce = scriptSig.readUInt32LE(auxDataStart + 36);
          auxPowData.nonce = nonce;
        }
      }

      // Add segment before AuxPOW, respecting already processed height bytes
      if (magicIndex > currentIndex) {
        remainingParts.push(scriptSig.slice(currentIndex, magicIndex));
      }

      // Move index past AuxPOW data
      const auxDataEnd = magicIndex + AUXPOW_MAGIC_BYTES.length + 32 + (auxPowData?.merkleSize !== undefined ? 8 : 0);
      currentIndex = Math.max(currentIndex, auxDataEnd);
    }

    // Add any remaining part after height/AuxPOW
    if (currentIndex < scriptSig.length) {
      remainingParts.push(scriptSig.slice(currentIndex));
    }

    // Concatenate remaining parts and convert to hex
    const remainingScriptHex = Buffer.concat(remainingParts).toString('hex');

    return { height, auxPowData, remainingScriptHex };
  } catch (error) {
    console.error('Error decoding coinbase scriptSig info:', error);
    return { remainingScriptHex: scriptSig.toString('hex') };
  }
}

// Function to get coinbase transaction hash
export function getCoinbaseTxHash(coinbaseRaw: string): string {
  try {
    const tx = getTransaction(coinbaseRaw);
    return tx.getId();
  } catch (error) {
    console.error('Error getting coinbase transaction hash:', error);
    return '';
  }
}

// Function to get other coinbase transaction details
export function getCoinbaseTxDetails(coinbaseRaw: string): CoinbaseTxDetails {
  try {
    const tx = getTransaction(coinbaseRaw);
    let witnessCommitmentNonce: string | null = null;

    // Witness data exists on the first input, and has exactly one element
    // This element is typically the nonce for the witness commitment
    if (tx.ins && tx.ins.length > 0 && tx.ins[0].witness && tx.ins[0].witness.length === 1) {
      // Double-check by ensuring a witness commitment output actually exists
      const hasWitnessCommitmentOutput = tx.outs.some(out => 
        Buffer.from(out.script).toString('hex').startsWith('6a24aa21a9ed')
      );
      if (hasWitnessCommitmentOutput) {
        witnessCommitmentNonce = Buffer.from(tx.ins[0].witness[0]).toString('hex');
      }
    }

    return {
      txVersion: tx.version,
      // Coinbase input sequence is typically 0xffffffff, but read it anyway
      inputSequence: tx.ins[0]?.sequence || 0,
      txLocktime: tx.locktime,
      witnessCommitmentNonce: witnessCommitmentNonce
    };
  } catch (error) {
    console.error('Error getting coinbase transaction details:', error);
    return {};
  }
} 