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

    console.log(`[CREATE SESSION] Creating session for domain: ${domain}, userId: ${userId}, sessionId: ${id}`);
    console.log(`[CREATE SESSION] Secret length: ${secret.length}`);
    console.log(`[CREATE SESSION] Secret hash length: ${secretHash.length}`);
    console.log(`[CREATE SESSION] Secret hash (first 10 bytes):`, Array.from(secretHash.slice(0, 10)));

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

    console.log(`[CREATE SESSION] Session insert result:`, insertResult);

    // Verify the session was actually inserted
    const verifyResult = await db.prepare(`
      SELECT id, secret_hash FROM ${domain}_sessions WHERE id = ?
    `).bind(session.id).first();

    if (!verifyResult) {
      throw new Error(`Session was not inserted into database. Domain: ${domain}, SessionId: ${id}`);
    }

    console.log(`[CREATE SESSION] Session verified in database: ${session.id}`);
    console.log(`[CREATE SESSION] Stored secret hash length: ${(verifyResult.secret_hash as Uint8Array).length}`);
    console.log(`[CREATE SESSION] Stored secret hash (first 10 bytes):`, Array.from((verifyResult.secret_hash as Uint8Array).slice(0, 10)));

    // Double-check the session count
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count FROM ${domain}_sessions
    `).first();
    
    console.log(`[CREATE SESSION] Total sessions in ${domain}_sessions table: ${countResult ? (countResult as any).count : 'unknown'}`);

    return session;
  } catch (error) {
    console.error(`[CREATE SESSION] Error creating session for domain ${domain}, userId ${userId}:`, error);
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
  try {
    console.log(`[CSRF VALIDATION] Starting validation for domain: ${domain}`);
    console.log(`[CSRF VALIDATION] Token: ${csrfToken.substring(0, 10)}...`);
    
    const now = getCurrentUnixTime();
    const expirationTime = now - (60 * 60); // 1 hour expiration
    
    console.log(`[CSRF VALIDATION] Current time: ${now}, Expiration cutoff: ${expirationTime}`);
    
    const result = await db.prepare(`
      SELECT token, created_at
      FROM ${domain}_csrf_tokens 
      WHERE token = ? AND created_at > ?
    `).bind(csrfToken, expirationTime).first();
    
    if (!result) {
      console.error(`[CSRF VALIDATION] Token not found or expired - Domain: ${domain}, Token: ${csrfToken.substring(0, 10)}...`);
      
      // Check if token exists but is expired
      const expiredResult = await db.prepare(`
        SELECT token, created_at
        FROM ${domain}_csrf_tokens 
        WHERE token = ?
      `).bind(csrfToken).first();
      
      if (expiredResult) {
        const tokenAge = now - (expiredResult.created_at as number);
        console.error(`[CSRF VALIDATION] Token exists but expired - Age: ${tokenAge} seconds, Domain: ${domain}`);
      } else {
        console.error(`[CSRF VALIDATION] Token not found in database - Domain: ${domain}`);
      }
      
      return false;
    }
    
    const tokenAge = now - (result.created_at as number);
    console.log(`[CSRF VALIDATION] Token found and valid - Age: ${tokenAge} seconds, Domain: ${domain}`);
    
    // Delete the token after use (one-time use)
    await db.prepare(`
      DELETE FROM ${domain}_csrf_tokens 
      WHERE token = ?
    `).bind(csrfToken).run();
    
    console.log(`[CSRF VALIDATION] Token consumed and deleted - Domain: ${domain}`);
    return true;
    
  } catch (error: any) {
    console.error(`[CSRF VALIDATION] Database error during validation - Domain: ${domain}, Error: ${error.message}`);
    console.error(`[CSRF VALIDATION] This may indicate a database schema issue or connection problem`);
    throw error;
  }
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
    console.error(`[VALIDATE SESSION] Invalid token format - expected 2 parts, got ${tokenParts.length}`);
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
    console.error(`[VALIDATE SESSION] Session not found in database`);
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
    // Byte-by-byte comparison for debugging
    const minLength = Math.min(tokenSecretHash.length, session.secretHash.length);
    let firstMismatch = -1;
    for (let i = 0; i < minLength; i++) {
      if (tokenSecretHash[i] !== session.secretHash[i]) {
        firstMismatch = i;
        break;
      }
    }
    
    console.error(`[VALIDATE SESSION] Secret validation failed - hashes don't match | Session ID: ${sessionId} | Domain: ${domain} | Token hash (hex): ${Array.from(tokenSecretHash).map(b => b.toString(16).padStart(2, '0')).join('')} | Stored hash (hex): ${Array.from(session.secretHash).map(b => b.toString(16).padStart(2, '0')).join('')} | Token hash (first 20): [${Array.from(tokenSecretHash.slice(0, 20)).join(',')}] | Stored hash (first 20): [${Array.from(session.secretHash.slice(0, 20)).join(',')}] | Debug: Token length=${tokenSecretHash.length}, Stored length=${session.secretHash.length}, Lengths match=${tokenSecretHash.length === session.secretHash.length}, Token type=${typeof tokenSecretHash}, Stored type=${typeof session.secretHash}, Token constructor=${tokenSecretHash.constructor.name}, Stored constructor=${session.secretHash.constructor.name}, First mismatch at byte=${firstMismatch >= 0 ? `${firstMismatch} (token=${tokenSecretHash[firstMismatch]}, stored=${session.secretHash[firstMismatch]})` : 'none found'}`);
    
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
    console.error(`Session not found in database table: ${tableName}`);
    return null;
  }

  console.log(`Session found in database table: ${tableName}, created at: ${result.created_at}, user_id: ${result.user_id}`);

  // Debug the secret_hash from database
  const rawSecretHash = result.secret_hash;
  console.log(`[GET SESSION] Raw secret_hash debug | Type: ${typeof rawSecretHash} | Constructor: ${rawSecretHash?.constructor?.name} | Is Uint8Array: ${rawSecretHash instanceof Uint8Array} | Length: ${(rawSecretHash as any)?.length} | First 10 bytes: [${Array.from((rawSecretHash as any) || []).slice(0, 10).join(',')}]`);

  const session: Session = {
    id: result.id as string,
    userId: result.user_id as string,
    secretHash: rawSecretHash instanceof Uint8Array ? rawSecretHash : new Uint8Array(rawSecretHash as any),
    createdAt: new Date((result.created_at as number) * 1000)
  };

  // Debug the session secretHash
  console.log(`[GET SESSION] Session secretHash debug | Type: ${typeof session.secretHash} | Constructor: ${session.secretHash?.constructor?.name} | Is Uint8Array: ${session.secretHash instanceof Uint8Array} | Length: ${session.secretHash?.length} | First 10 bytes: [${Array.from(session.secretHash || []).slice(0, 10).join(',')}]`);

  // Check expiration
  const ageInSeconds = (now.getTime() - session.createdAt.getTime()) / 1000;
  console.log(`Session age: ${ageInSeconds} seconds, expires after: ${SESSION_EXPIRES_IN_SECONDS} seconds`);

  if (ageInSeconds >= SESSION_EXPIRES_IN_SECONDS) {
    console.error(`Session expired, deleting: ${sessionId} from table: ${tableName}`);
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