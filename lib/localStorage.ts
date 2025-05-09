/**
 * Type-safe localStorage utility for storing user preferences
 */

// Define the types for our stored preferences
export interface UserPreferences {
  isCompact: boolean;
  // Add more preferences here as needed
}

// Default values for preferences
export const defaultPreferences: UserPreferences = {
  isCompact: true,
};

// Prefix for all localStorage keys to avoid conflicts
const STORAGE_PREFIX = 'parasite_';

/**
 * Get a preference value from localStorage
 * @param key The preference key
 * @returns The stored value or default value if not found
 */
export function getPreference<K extends keyof UserPreferences>(
  key: K
): UserPreferences[K] {
  try {
    const item = localStorage.getItem(`${STORAGE_PREFIX}${String(key)}`);
    return item ? JSON.parse(item) : defaultPreferences[key];
  } catch (error) {
    console.error(`Error reading preference '${key}' from localStorage:`, error);
    return defaultPreferences[key];
  }
}

/**
 * Set a preference value in localStorage
 * @param key The preference key
 * @param value The value to store
 */
export function setPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): void {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${String(key)}`,
      JSON.stringify(value)
    );
  } catch (error) {
    console.error(`Error saving preference '${key}' to localStorage:`, error);
  }
}
