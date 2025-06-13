/**
 * Generate a color based on the hash value for Merkle tree visualization
 * @param hash - The hash string to generate a color from
 * @returns A hex color string
 */
export function getMerkleColor(hash: string): string {
  if (!hash || hash.length === 0) {
    return '#666666'; // Default gray for empty hashes
  }

  // Use the first 6 characters of the hash to generate a color
  // Convert to a number and then to a color value
  let colorValue = 0;
  for (let i = 0; i < Math.min(6, hash.length); i++) {
    colorValue = (colorValue << 4) + parseInt(hash[i], 16);
  }

  // Generate RGB values with some constraints to ensure visibility
  const r = Math.floor((colorValue & 0xFF0000) >> 16) % 256;
  const g = Math.floor((colorValue & 0x00FF00) >> 8) % 256;
  const b = Math.floor(colorValue & 0x0000FF) % 256;

  // Ensure minimum brightness for visibility
  const minBrightness = 80;
  const maxBrightness = 200;
  
  const adjustedR = Math.max(minBrightness, Math.min(maxBrightness, r));
  const adjustedG = Math.max(minBrightness, Math.min(maxBrightness, g));
  const adjustedB = Math.max(minBrightness, Math.min(maxBrightness, b));

  return `#${adjustedR.toString(16).padStart(2, '0')}${adjustedG.toString(16).padStart(2, '0')}${adjustedB.toString(16).padStart(2, '0')}`;
} 