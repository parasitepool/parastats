/**
 * Bitcoin address validation utilities
 */

/**
 * Validates if a string is a valid Bitcoin address
 * This is a simplified validation that checks basic format rules
 * For production, consider using a more robust validation library
 */
export function isValidBitcoinAddress(address: string): boolean {
  if (!address) return false;
  
  // Basic validation for different Bitcoin address formats
  
  // Legacy addresses (P2PKH) start with 1
  const legacyRegex = /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  
  // Segwit addresses (P2SH) start with 3
  const segwitRegex = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  
  // Bech32 addresses (native Segwit) start with bc1
  const bech32Regex = /^bc1[a-z0-9]{25,90}$/;
  
  return legacyRegex.test(address) || segwitRegex.test(address) || bech32Regex.test(address);
} 