/**
 * Cryptographically secure random number generation using Web Crypto API
 */

/**
 * Generate a cryptographically secure random number between 0 and 1
 * Similar to Math.random() but using Web Crypto API
 */
export function getSecureRandom(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] / (0xFFFFFFFF + 1);
}

/**
 * Generate a cryptographically secure random integer in range [min, max] (inclusive)
 */
export function getSecureRandomInt(min: number, max: number): number {
  const range = max - min + 1;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return min + (array[0] % range);
}

/**
 * Generate a cryptographically secure random boolean
 * @param probability - Probability of returning true (0-1, default 0.5)
 */
export function getSecureRandomBoolean(probability: number = 0.5): boolean {
  return getSecureRandom() < probability;
}

/**
 * Shuffle an array using Fisher-Yates algorithm with crypto random
 * Returns a new shuffled array (does not mutate original)
 */
export function secureShuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pick N random items from an array without replacement
 * Returns a new array with the selected items
 */
export function securePickN<T>(array: T[], n: number): T[] {
  if (n > array.length) {
    throw new Error(`Cannot pick ${n} items from array of length ${array.length}`);
  }
  const shuffled = secureShuffleArray(array);
  return shuffled.slice(0, n);
}

/**
 * Generate an array of secure random booleans
 * Useful for determining card reversals in tarot
 */
export function generateReversalArray(count: number, probability: number = 0.5): boolean[] {
  return Array.from({ length: count }, () => getSecureRandomBoolean(probability));
}
