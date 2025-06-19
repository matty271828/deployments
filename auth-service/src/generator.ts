// Secure random generation utilities following Lucia's recommendations
// These functions generate cryptographically secure IDs and secrets

/**
 * Generate a secure random string with 120 bits of entropy
 * Uses a human-readable alphabet (a-z, 0-9 without l, o, 0, 1 to avoid confusion)
 * 
 * @returns A secure random string suitable for IDs and secrets
 */
export function generateSecureRandomString(): string {
  // Human readable alphabet (a-z, 0-9 without l, o, 0, 1 to avoid confusion)
  const alphabet = "abcdefghijklmnpqrstuvwxyz23456789";

  // Generate 24 bytes = 192 bits of entropy.
  // We're only going to use 5 bits per byte so the total entropy will be 192 * 5 / 8 = 120 bits
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  let id = "";
  for (let i = 0; i < bytes.length; i++) {
    // >> 3 "removes" the right-most 3 bits of the byte
    id += alphabet[bytes[i] >> 3];
  }
  return id;
}

/**
 * Generate a session ID using secure random generation
 * @returns A secure session ID
 */
export function generateSessionId(): string {
  return generateSecureRandomString();
}

/**
 * Generate a session secret using secure random generation
 * @returns A secure session secret
 */
export function generateSessionSecret(): string {
  return generateSecureRandomString();
}

/**
 * Generate a user ID using secure random generation
 * @returns A secure user ID
 */
export function generateUserId(): string {
  return generateSecureRandomString();
}

/**
 * Hash a secret using SHA-256
 * Following Lucia's recommendations for session secret hashing
 * 
 * @param secret - The secret to hash
 * @returns A Uint8Array containing the hash
 */
export async function hashSecret(secret: string): Promise<Uint8Array> {
  const secretBytes = new TextEncoder().encode(secret);
  const secretHashBuffer = await crypto.subtle.digest("SHA-256", secretBytes);
  return new Uint8Array(secretHashBuffer);
}

/**
 * Constant-time comparison for Uint8Arrays
 * Prevents timing attacks when comparing secrets and hashes
 * 
 * @param a - First array to compare
 * @param b - Second array to compare
 * @returns True if arrays are equal, false otherwise
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  let c = 0;
  for (let i = 0; i < a.byteLength; i++) {
    c |= a[i] ^ b[i];
  }
  return c === 0;
}

/**
 * Get current time as Unix timestamp (seconds)
 * @returns Current time in seconds since Unix epoch
 */
export function getCurrentUnixTime(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Convert Unix timestamp to Date object
 * @param unixTime - Unix timestamp in seconds
 * @returns Date object
 */
export function unixTimeToDate(unixTime: number): Date {
  return new Date(unixTime * 1000);
} 