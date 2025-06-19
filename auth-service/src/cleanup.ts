/**
 * Automated cleanup system for the authentication service
 * Handles cleanup of expired sessions and rate limit data across all domains
 */

import { cleanupExpiredSessions } from './sessions';
import { rateLimiters } from './rate-limiter';

/**
 * Get all active domains from the database
 * 
 * @param db - D1Database instance
 * @returns Promise<string[]> - Array of domain prefixes
 */
async function getActiveDomains(db: D1Database): Promise<string[]> {
  try {
    // Query all tables to find domain prefixes
    const tables = await db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE '%_users'
    `).all();

    const domains: string[] = [];
    for (const table of tables.results as any[]) {
      const tableName = table.name as string;
      const domain = tableName.replace('_users', '');
      domains.push(domain);
    }

    return domains;
  } catch (error) {
    console.error('Error getting active domains:', error);
    return [];
  }
}

/**
 * Clean up expired sessions for all domains
 * 
 * @param db - D1Database instance
 */
async function cleanupAllSessions(db: D1Database): Promise<void> {
  try {
    const domains = await getActiveDomains(db);
    
    for (const domain of domains) {
      try {
        await cleanupExpiredSessions(db, domain);
        console.log(`Cleaned up sessions for domain: ${domain}`);
      } catch (error) {
        console.error(`Error cleaning up sessions for domain ${domain}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in session cleanup:', error);
  }
}

/**
 * Clean up rate limit data for all domains
 * 
 * @param db - D1Database instance
 */
async function cleanupAllRateLimits(db: D1Database): Promise<void> {
  try {
    const domains = await getActiveDomains(db);
    
    for (const domain of domains) {
      try {
        // Clean up all rate limiters for this domain
        await rateLimiters.login.cleanup(db, domain, 24);
        await rateLimiters.signup.cleanup(db, domain, 24);
        await rateLimiters.session.cleanup(db, domain, 24);
        await rateLimiters.api.cleanup(db, domain, 24);
        
        console.log(`Cleaned up rate limits for domain: ${domain}`);
      } catch (error) {
        console.error(`Error cleaning up rate limits for domain ${domain}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in rate limit cleanup:', error);
  }
}

/**
 * Perform comprehensive cleanup for all domains
 * This function should be called periodically (e.g., daily)
 * 
 * @param db - D1Database instance
 */
export async function performCleanup(db: D1Database): Promise<void> {
  console.log('Starting automated cleanup...');
  
  // Clean up expired sessions
  await cleanupAllSessions(db);
  
  // Clean up old rate limit data
  await cleanupAllRateLimits(db);
  
  console.log('Automated cleanup completed');
}

/**
 * Check if cleanup should run based on last cleanup time
 * This prevents running cleanup too frequently
 * 
 * @param db - D1Database instance
 * @returns Promise<boolean> - True if cleanup should run
 */
export async function shouldRunCleanup(db: D1Database): Promise<boolean> {
  try {
    // Check if we have a cleanup tracking table
    const result = await db.prepare(`
      SELECT value FROM cleanup_tracker WHERE key = 'last_cleanup'
    `).first();

    if (!result) {
      // First time running, create tracking table and run cleanup
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS cleanup_tracker (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `).run();
      
      await db.prepare(`
        INSERT INTO cleanup_tracker (key, value) VALUES ('last_cleanup', ?)
      `).bind(Date.now().toString()).run();
      
      return true;
    }

    const lastCleanup = parseInt(result.value as string);
    const now = Date.now();
    const hoursSinceLastCleanup = (now - lastCleanup) / (1000 * 60 * 60);

    // Run cleanup if it's been more than 12 hours
    if (hoursSinceLastCleanup >= 12) {
      // Update last cleanup time
      await db.prepare(`
        UPDATE cleanup_tracker SET value = ? WHERE key = 'last_cleanup'
      `).bind(now.toString()).run();
      
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking cleanup schedule:', error);
    // On error, allow cleanup to run
    return true;
  }
} 