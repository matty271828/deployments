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
 * Hash a password using PBKDF2 with salt
 * Following security best practices for password storage
 * 
 * @param password - The password to hash
 * @param salt - Optional salt (will generate if not provided)
 * @returns Object containing hash and salt
 */
export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  // Generate salt if not provided
  if (!salt) {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    salt = Array.from(saltBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Convert password and salt to bytes
  const passwordBytes = new TextEncoder().encode(password);
  const saltBytes = new Uint8Array(salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  // Use PBKDF2 to derive key
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const hashBytes = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000, // High iteration count for security
      hash: 'SHA-256'
    },
    key,
    256 // 256 bits = 32 bytes
  );

  const hash = Array.from(new Uint8Array(hashBytes), byte => byte.toString(16).padStart(2, '0')).join('');

  return { hash, salt };
}

/**
 * Verify a password against a stored hash
 * 
 * @param password - The password to verify
 * @param storedHash - The stored hash
 * @param storedSalt - The stored salt
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const { hash } = await hashPassword(password, storedSalt);
  return constantTimeEqual(
    new Uint8Array(hash.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))),
    new Uint8Array(storedHash.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
  );
} 