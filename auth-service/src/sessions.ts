import { Session, SessionWithToken, SessionValidationResult } from './types';
import { 
  generateSecureRandomString, 
  hashSecret, 
  getCurrentUnixTime,
  constantTimeEqual
} from './generator';

// Session expiration time in seconds (1 day)
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24;

/**
 * Create a new session following Lucia's recommendations
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param userId - User ID to associate with the session
 * @returns Promise<SessionWithToken>
 */
export async function createSession(db: D1Database, domain: string, userId: string): Promise<SessionWithToken> {
  try {
    const now = new Date();

    const id = generateSecureRandomString();
    const secret = generateSecureRandomString();
    const secretHash = await hashSecret(secret);

    const token = id + "." + secret;

    const session: SessionWithToken = {
      id,
      userId,
      secretHash,
      createdAt: now,
      token
    };

    console.log(`Creating session for domain: ${domain}, userId: ${userId}, sessionId: ${id}`);

    // Insert session into domain-specific table
    const insertResult = await db.prepare(`
      INSERT INTO ${domain}_sessions (id, user_id, secret_hash, created_at) 
      VALUES (?, ?, ?, ?)
    `).bind(
      session.id,
      session.userId,
      session.secretHash,
      Math.floor(session.createdAt.getTime() / 1000)
    ).run();

    console.log(`Session insert result:`, insertResult);

    // Verify the session was actually inserted
    const verifyResult = await db.prepare(`
      SELECT id FROM ${domain}_sessions WHERE id = ?
    `).bind(session.id).first();

    if (!verifyResult) {
      throw new Error(`Session was not inserted into database. Domain: ${domain}, SessionId: ${id}`);
    }

    console.log(`Session verified in database: ${session.id}`);

    // Double-check the session count
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count FROM ${domain}_sessions
    `).first();
    
    console.log(`Total sessions in ${domain}_sessions table: ${countResult ? (countResult as any).count : 'unknown'}`);

    return session;
  } catch (error) {
    console.error(`Error creating session for domain ${domain}, userId ${userId}:`, error);
    throw error;
  }
}

/**
 * Generate a CSRF token for form protection
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @returns Promise<string> - The generated CSRF token
 */
export async function generateCSRFToken(db: D1Database, domain: string): Promise<string> {
  const csrfToken = generateSecureRandomString();
  const now = getCurrentUnixTime();
  
  // Store CSRF token in a separate table with expiration
  await db.prepare(`
    INSERT INTO ${domain}_csrf_tokens (token, created_at) 
    VALUES (?, ?)
  `).bind(csrfToken, now).run();
  
  return csrfToken;
}

/**
 * Validate a CSRF token
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param csrfToken - CSRF token to validate
 * @returns Promise<boolean> - True if token is valid
 */
export async function validateCSRFToken(db: D1Database, domain: string, csrfToken: string): Promise<boolean> {
  const now = getCurrentUnixTime();
  const expirationTime = now - (60 * 60); // 1 hour expiration
  
  const result = await db.prepare(`
    SELECT token 
    FROM ${domain}_csrf_tokens 
    WHERE token = ? AND created_at > ?
  `).bind(csrfToken, expirationTime).first();
  
  if (!result) {
    return false;
  }
  
  // Delete the token after use (one-time use)
  await db.prepare(`
    DELETE FROM ${domain}_csrf_tokens 
    WHERE token = ?
  `).bind(csrfToken).run();
  
  return true;
}

/**
 * Validate a session token with detailed error information
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param token - Session token in format <SESSION_ID>.<SESSION_SECRET>
 * @returns Promise<SessionValidationResult>
 */
export async function validateSessionToken(db: D1Database, domain: string, token: string): Promise<SessionValidationResult> {
  console.log(`[VALIDATE SESSION] Starting validation for domain: ${domain}`);
  console.log(`[VALIDATE SESSION] Token: ${token.substring(0, 10)}...`);
  
  const tokenParts = token.split(".");
  if (tokenParts.length != 2) {
    console.log(`[VALIDATE SESSION] Invalid token format - expected 2 parts, got ${tokenParts.length}`);
    return {
      success: false,
      error: {
        type: 'invalid_format',
        message: 'Session token format is invalid. Expected format: <session_id>.<session_secret>'
      }
    };
  }
  
  const sessionId = tokenParts[0];
  const sessionSecret = tokenParts[1];
  
  console.log(`[VALIDATE SESSION] Session ID: ${sessionId}`);
  console.log(`[VALIDATE SESSION] Session Secret length: ${sessionSecret.length}`);

  const session = await getSession(db, domain, sessionId);
  if (!session) {
    console.log(`[VALIDATE SESSION] Session not found in database`);
    return {
      success: false,
      error: {
        type: 'session_not_found',
        message: 'Session not found. The session may have been deleted or never existed.'
      }
    };
  }

  console.log(`[VALIDATE SESSION] Session found, validating secret...`);
  console.log(`[VALIDATE SESSION] Stored secret hash length: ${session.secretHash.length}`);
  
  const tokenSecretHash = await hashSecret(sessionSecret);
  console.log(`[VALIDATE SESSION] Token secret hash length: ${tokenSecretHash.length}`);
  
  const validSecret = constantTimeEqual(tokenSecretHash, session.secretHash);
  console.log(`[VALIDATE SESSION] Secret validation result: ${validSecret}`);
  
  if (!validSecret) {
    console.log(`[VALIDATE SESSION] Secret validation failed - hashes don't match`);
    console.log(`[VALIDATE SESSION] Token secret hash (first 10 bytes):`, Array.from(tokenSecretHash.slice(0, 10)));
    console.log(`[VALIDATE SESSION] Stored secret hash (first 10 bytes):`, Array.from(session.secretHash.slice(0, 10)));
    return {
      success: false,
      error: {
        type: 'invalid_secret',
        message: 'Session secret is invalid. The session token may be corrupted or tampered with.'
      }
    };
  }

  console.log(`[VALIDATE SESSION] Session validation successful`);
  return {
    success: true,
    session: session
  };
}

/**
 * Get a session by ID with expiration check
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param sessionId - Session ID
 * @returns Promise<Session | null>
 */
export async function getSession(db: D1Database, domain: string, sessionId: string): Promise<Session | null> {
  const now = new Date();
  const tableName = `${domain}_sessions`;

  console.log(`Looking up session: ${sessionId} in table: ${tableName}`);

  const result = await db.prepare(`
    SELECT id, user_id, secret_hash, created_at 
    FROM ${tableName} 
    WHERE id = ?
  `).bind(sessionId).first();

  if (!result) {
    console.log(`Session not found in database table: ${tableName}`);
    return null;
  }

  console.log(`Session found in database table: ${tableName}, created at: ${result.created_at}, user_id: ${result.user_id}`);

  const session: Session = {
    id: result.id as string,
    userId: result.user_id as string,
    secretHash: result.secret_hash as Uint8Array,
    createdAt: new Date((result.created_at as number) * 1000)
  };

  // Check expiration
  const ageInSeconds = (now.getTime() - session.createdAt.getTime()) / 1000;
  console.log(`Session age: ${ageInSeconds} seconds, expires after: ${SESSION_EXPIRES_IN_SECONDS} seconds`);

  if (ageInSeconds >= SESSION_EXPIRES_IN_SECONDS) {
    console.log(`Session expired, deleting: ${sessionId} from table: ${tableName}`);
    await deleteSession(db, domain, sessionId);
    return null;
  }

  console.log(`Session is valid: ${sessionId} in table: ${tableName}`);
  return session;
}

/**
 * Delete a session
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param sessionId - Session ID to delete
 */
export async function deleteSession(db: D1Database, domain: string, sessionId: string): Promise<void> {
  const tableName = `${domain}_sessions`;
  console.log(`DELETING session: ${sessionId} from table: ${tableName}`);
  
  const result = await db.prepare(`
    DELETE FROM ${tableName} 
    WHERE id = ?
  `).bind(sessionId).run();
  
  console.log(`DELETE result for session ${sessionId}:`, result);
}

/**
 * Clean up expired sessions
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 */
export async function cleanupExpiredSessions(db: D1Database, domain: string): Promise<void> {
  const currentTime = getCurrentUnixTime();
  const expirationTime = currentTime - SESSION_EXPIRES_IN_SECONDS;

  await db.prepare(`
    DELETE FROM ${domain}_sessions 
    WHERE created_at < ?
  `).bind(expirationTime).run();
}

/**
 * Clean up expired CSRF tokens
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 */
export async function cleanupExpiredCSRFTokens(db: D1Database, domain: string): Promise<void> {
  const currentTime = getCurrentUnixTime();
  const expirationTime = currentTime - (60 * 60); // 1 hour expiration

  await db.prepare(`
    DELETE FROM ${domain}_csrf_tokens 
    WHERE created_at < ?
  `).bind(expirationTime).run();
} 