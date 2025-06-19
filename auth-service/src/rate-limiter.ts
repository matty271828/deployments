/**
 * Token Bucket Rate Limiter for Cloudflare Workers
 * Uses D1 database for persistent storage across serverless invocations
 * Following Lucia's recommendations for rate limiting
 */

export interface RateLimitConfig {
  max: number;
  refillIntervalSeconds: number;
  cleanupIntervalHours?: number;
}

export class TokenBucketRateLimit {
  private storageKey: string;
  public max: number;
  public refillIntervalSeconds: number;

  constructor(storageKey: string, max: number, refillIntervalSeconds: number) {
    this.storageKey = storageKey;
    this.max = max;
    this.refillIntervalSeconds = refillIntervalSeconds;
  }

  /**
   * Consume tokens from the bucket
   * 
   * @param db - D1Database instance
   * @param domain - Domain prefix for table names
   * @param key - Rate limit key (e.g., IP address, user ID)
   * @param cost - Number of tokens to consume (default: 1)
   * @returns Promise<boolean> - True if request is allowed, false if rate limited
   */
  async consume(db: D1Database, domain: string, key: string, cost: number = 1): Promise<boolean> {
    const bucketKey = `token_bucket.v1:${this.storageKey}:${this.refillIntervalSeconds}:${key}`;
    const now = Date.now();

    try {
      // Get current bucket state
      const result = await db.prepare(`
        SELECT count, refilled_at_ms 
        FROM ${domain}_rate_limits 
        WHERE key = ?
      `).bind(bucketKey).first();

      let count: number;
      let refilledAtMs: number;

      if (!result) {
        // Create new bucket
        count = this.max - cost;
        refilledAtMs = now;
        
        await db.prepare(`
          INSERT INTO ${domain}_rate_limits (key, count, refilled_at_ms, created_at) 
          VALUES (?, ?, ?, ?)
        `).bind(bucketKey, count, refilledAtMs, Math.floor(now / 1000)).run();
        
        return true;
      }

      // Get existing bucket values
      count = result.count as number;
      refilledAtMs = result.refilled_at_ms as number;

      // Calculate refill
      const refill = Math.floor((now - refilledAtMs) / (this.refillIntervalSeconds * 1000));
      count = Math.min(count + refill, this.max);
      refilledAtMs = refilledAtMs + refill * this.refillIntervalSeconds * 1000;

      // Check if we have enough tokens
      if (count < cost) {
        // Update bucket state even if we can't consume
        await db.prepare(`
          UPDATE ${domain}_rate_limits 
          SET count = ?, refilled_at_ms = ? 
          WHERE key = ?
        `).bind(count, refilledAtMs, bucketKey).run();
        
        return false;
      }

      // Consume tokens
      count -= cost;
      
      await db.prepare(`
        UPDATE ${domain}_rate_limits 
        SET count = ?, refilled_at_ms = ? 
        WHERE key = ?
      `).bind(count, refilledAtMs, bucketKey).run();

      return true;

    } catch (error) {
      console.error('Rate limit error:', error);
      // On error, allow the request to prevent blocking legitimate users
      return true;
    }
  }

  /**
   * Clean up old rate limit entries
   * 
   * @param db - D1Database instance
   * @param domain - Domain prefix for table names
   * @param maxAgeHours - Maximum age in hours before cleanup (default: 24)
   */
  async cleanup(db: D1Database, domain: string, maxAgeHours: number = 24): Promise<void> {
    try {
      const cutoffTime = Math.floor((Date.now() - (maxAgeHours * 60 * 60 * 1000)) / 1000);
      
      await db.prepare(`
        DELETE FROM ${domain}_rate_limits 
        WHERE created_at < ?
      `).bind(cutoffTime).run();
    } catch (error) {
      console.error('Rate limit cleanup error:', error);
    }
  }
}

/**
 * Get client IP address from request
 * 
 * @param request - The incoming request
 * @returns string - Client IP address
 */
export function getClientIP(request: Request): string {
  // Try to get real IP from Cloudflare headers
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to X-Forwarded-For
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  // Last resort - use a default
  return 'unknown';
}

/**
 * Create rate limiters for different endpoints
 */
export const rateLimiters = {
  // Login attempts: 5 attempts per 15 minutes
  login: new TokenBucketRateLimit('login', 5, 15 * 60),
  
  // Signup attempts: 3 attempts per hour
  signup: new TokenBucketRateLimit('signup', 3, 60 * 60),
  
  // Session operations: 30 requests per minute (more lenient for legitimate use)
  session: new TokenBucketRateLimit('session', 30, 60),
  
  // General API: 100 requests per minute
  api: new TokenBucketRateLimit('api', 100, 60)
}; 