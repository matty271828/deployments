import { User, UserWithPassword, PasswordResetToken } from './types';
import { generateSecureRandomString, hashPassword, verifyPassword } from './generator';

/**
 * Create a new user
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param email - User's email address
 * @param password - User's password
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @returns Promise<User> - The created user (without password)
 */
export async function createUser(db: D1Database, domain: string, email: string, password: string, firstName: string, lastName: string): Promise<User> {
  // Validate email format
  if (!isValidEmail(email)) {
    throw new Error('Invalid email format');
  }

  // Validate password strength
  if (!isValidPassword(password)) {
    throw new Error(getPasswordValidationError(password));
  }

  // Validate name fields
  if (!firstName || !lastName) {
    throw new Error('First name and last name are required');
  }

  // Check if user already exists
  const existingUser = await getUserByEmail(db, domain, email);
  if (existingUser) {
    throw new Error('User already exists');
  }

  // Generate user ID and hash password
  const id = generateSecureRandomString();
  const { hash: passwordHash, salt } = await hashPassword(password);
  const now = new Date();

  // Store user in domain-specific table
  await db.prepare(`
    INSERT INTO ${domain}_users (id, email, first_name, last_name, password_hash, password_salt, created_at) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    email.toLowerCase(), // Store email in lowercase
    firstName.trim(),
    lastName.trim(),
    passwordHash,
    salt,
    Math.floor(now.getTime() / 1000)
  ).run();

  // Return user without password
  const user: User = {
    id,
    email: email.toLowerCase(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    createdAt: now,
    failedLoginAttempts: 0,
    lockedUntil: undefined
  };

  return user;
}

/**
 * Get user by email
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param email - User's email address
 * @returns Promise<UserWithPassword | null>
 */
export async function getUserByEmail(db: D1Database, domain: string, email: string): Promise<UserWithPassword | null> {
  const result = await db.prepare(`
    SELECT id, email, first_name, last_name, password_hash, password_salt, created_at, failed_login_attempts, locked_until
    FROM ${domain}_users 
    WHERE email = ?
  `).bind(email.toLowerCase()).first();

  if (!result) {
    return null;
  }

  const user: UserWithPassword = {
    id: result.id as string,
    email: result.email as string,
    firstName: result.first_name as string,
    lastName: result.last_name as string,
    passwordHash: result.password_hash as string,
    createdAt: new Date((result.created_at as number) * 1000),
    failedLoginAttempts: result.failed_login_attempts as number,
    lockedUntil: result.locked_until ? new Date((result.locked_until as number) * 1000) : undefined
  };

  return user;
}

/**
 * Get user by ID
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param userId - User ID
 * @returns Promise<User | null>
 */
export async function getUserById(db: D1Database, domain: string, userId: string): Promise<User | null> {
  const result = await db.prepare(`
    SELECT id, email, first_name, last_name, created_at, failed_login_attempts, locked_until
    FROM ${domain}_users 
    WHERE id = ?
  `).bind(userId).first();

  if (!result) {
    return null;
  }

  const user: User = {
    id: result.id as string,
    email: result.email as string,
    firstName: result.first_name as string,
    lastName: result.last_name as string,
    createdAt: new Date((result.created_at as number) * 1000),
    failedLoginAttempts: result.failed_login_attempts as number,
    lockedUntil: result.locked_until ? new Date((result.locked_until as number) * 1000) : undefined
  };

  return user;
}

/**
 * Validate user credentials
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise<User | null> - User if credentials are valid, null otherwise
 */
export async function validateCredentials(db: D1Database, domain: string, email: string, password: string): Promise<User | null> {
  const userWithPassword = await getUserByEmail(db, domain, email);
  if (!userWithPassword) {
    return null;
  }

  // Get the salt from the database
  const result = await db.prepare(`
    SELECT password_salt 
    FROM ${domain}_users 
    WHERE id = ?
  `).bind(userWithPassword.id).first();

  if (!result) {
    return null;
  }

  const salt = result.password_salt as string;
  const isValid = await verifyPassword(password, userWithPassword.passwordHash, salt);

  if (!isValid) {
    return null;
  }

  // Return user without password
  const user: User = {
    id: userWithPassword.id,
    email: userWithPassword.email,
    firstName: userWithPassword.firstName,
    lastName: userWithPassword.lastName,
    createdAt: userWithPassword.createdAt,
    failedLoginAttempts: userWithPassword.failedLoginAttempts,
    lockedUntil: userWithPassword.lockedUntil
  };

  return user;
}

/**
 * Validate email format
 * 
 * @param email - Email to validate
 * @returns boolean - True if valid email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * 
 * @param password - Password to validate
 * @returns boolean - True if password meets requirements
 */
function isValidPassword(password: string): boolean {
  // Minimum length requirement (increased from 8 to 12)
  if (password.length < 12) {
    return false;
  }

  // Check for complexity requirements
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  // All complexity requirements must be met
  if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
    return false;
  }

  // Check for common weak passwords and patterns
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'hello',
    'freedom', 'whatever', 'qazwsx', 'trustno1', 'jordan', 'harley',
    'ranger', 'iwantu', 'jennifer', 'hunter', 'buster', 'soccer',
    'baseball', 'tiger', 'charlie', 'andrew', 'michelle', 'love',
    'sunshine', 'jessica', 'asshole', '696969', 'amanda', 'access',
    'yankees', '987654321', 'dallas', 'austin', 'thunder', 'taylor',
    'matrix', 'mobilemail', 'mom', 'monitor', 'monitoring', 'montana',
    'moon', 'moscow', 'mother', 'movie', 'mozilla', 'music', 'mustang',
    'password', 'pa$$w0rd', 'p@ssw0rd', 'p@$$w0rd', 'pass123', 'pass1234',
    'password1', 'password12', 'password123', 'password1234', 'password12345'
  ];

  const lowerPassword = password.toLowerCase();
  if (commonPasswords.includes(lowerPassword)) {
    return false;
  }

  // Check for sequential patterns (e.g., 123456, abcdef)
  const sequentialPatterns = [
    '123456789', 'abcdefgh', 'qwertyui', 'asdfghjk', 'zxcvbnm',
    '987654321', 'zyxwvuts', 'poiuytre', 'lkjhgfds', 'mnbvcxz'
  ];

  for (const pattern of sequentialPatterns) {
    if (lowerPassword.includes(pattern)) {
      return false;
    }
  }

  // Check for repeated characters (more than 3 consecutive same characters)
  for (let i = 0; i < password.length - 2; i++) {
    if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
      return false;
    }
  }

  return true;
}

/**
 * Get detailed password validation error message
 * 
 * @param password - Password to validate
 * @returns string - Detailed error message explaining what's missing
 */
export function getPasswordValidationError(password: string): string {
  const errors: string[] = [];

  // Check length
  if (password.length < 12) {
    errors.push(`at least 12 characters long (currently ${password.length})`);
  }

  // Check complexity requirements
  if (!/[A-Z]/.test(password)) {
    errors.push('at least one uppercase letter (A-Z)');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('at least one lowercase letter (a-z)');
  }
  if (!/\d/.test(password)) {
    errors.push('at least one number (0-9)');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  // Check for common passwords
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
    'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'hello',
    'freedom', 'whatever', 'qazwsx', 'trustno1', 'jordan', 'harley',
    'ranger', 'iwantu', 'jennifer', 'hunter', 'buster', 'soccer',
    'baseball', 'tiger', 'charlie', 'andrew', 'michelle', 'love',
    'sunshine', 'jessica', 'asshole', '696969', 'amanda', 'access',
    'yankees', '987654321', 'dallas', 'austin', 'thunder', 'taylor',
    'matrix', 'mobilemail', 'mom', 'monitor', 'monitoring', 'montana',
    'moon', 'moscow', 'mother', 'movie', 'mozilla', 'music', 'mustang',
    'password', 'pa$$w0rd', 'p@ssw0rd', 'p@$$w0rd', 'pass123', 'pass1234',
    'password1', 'password12', 'password123', 'password1234', 'password12345'
  ];

  const lowerPassword = password.toLowerCase();
  if (commonPasswords.includes(lowerPassword)) {
    errors.push('not be a common password');
  }

  // Check for sequential patterns
  const sequentialPatterns = [
    '123456789', 'abcdefgh', 'qwertyui', 'asdfghjk', 'zxcvbnm',
    '987654321', 'zyxwvuts', 'poiuytre', 'lkjhgfds', 'mnbvcxz'
  ];

  for (const pattern of sequentialPatterns) {
    if (lowerPassword.includes(pattern)) {
      errors.push('not contain sequential patterns');
      break;
    }
  }

  // Check for repeated characters
  for (let i = 0; i < password.length - 2; i++) {
    if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
      errors.push('not contain more than 2 consecutive identical characters');
      break;
    }
  }

  if (errors.length === 0) {
    return 'Password meets all requirements';
  }

  return `Password must be ${errors.join(', ')}`;
}

/**
 * Get password requirements for display to users
 * 
 * @returns string - Human-readable password requirements
 */
export function getPasswordRequirements(): string {
  return 'Password must be at least 12 characters long and contain at least one uppercase letter (A-Z), one lowercase letter (a-z), one number (0-9), and one special character (!@#$%^&*()_+-=[]{}|;:,.<>?). It cannot be a common password or contain sequential patterns.';
}

/**
 * Check if user account is locked
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param userId - User ID to check
 * @returns Promise<{isLocked: boolean, lockedUntil?: Date, remainingAttempts: number}>
 */
export async function checkAccountLockout(db: D1Database, domain: string, userId: string): Promise<{isLocked: boolean, lockedUntil?: Date, remainingAttempts: number}> {
  const result = await db.prepare(`
    SELECT failed_login_attempts, locked_until 
    FROM ${domain}_users 
    WHERE id = ?
  `).bind(userId).first();

  if (!result) {
    return { isLocked: false, remainingAttempts: 5 };
  }

  const failedAttempts = result.failed_login_attempts as number;
  const lockedUntil = result.locked_until as number | null;

  // Check if account is currently locked
  if (lockedUntil && lockedUntil > Math.floor(Date.now() / 1000)) {
    return {
      isLocked: true,
      lockedUntil: new Date(lockedUntil * 1000),
      remainingAttempts: 0
    };
  }

  // Calculate remaining attempts before lockout
  const maxAttempts = getMaxAttemptsForLevel(failedAttempts);
  const remainingAttempts = Math.max(0, maxAttempts - failedAttempts);

  return {
    isLocked: false,
    remainingAttempts
  };
}

/**
 * Record a failed login attempt
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param userId - User ID
 * @returns Promise<void>
 */
export async function recordFailedLogin(db: D1Database, domain: string, userId: string): Promise<void> {
  const result = await db.prepare(`
    SELECT failed_login_attempts 
    FROM ${domain}_users 
    WHERE id = ?
  `).bind(userId).first();

  if (!result) {
    return;
  }

  const currentAttempts = (result.failed_login_attempts as number) + 1;
  const maxAttempts = getMaxAttemptsForLevel(currentAttempts);
  
  let lockedUntil: number | null = null;
  
  // If we've reached the limit, calculate lockout period
  if (currentAttempts >= maxAttempts) {
    lockedUntil = Math.floor(Date.now() / 1000) + getLockoutDuration(currentAttempts);
  }

  await db.prepare(`
    UPDATE ${domain}_users 
    SET failed_login_attempts = ?, locked_until = ? 
    WHERE id = ?
  `).bind(currentAttempts, lockedUntil, userId).run();
}

/**
 * Reset failed login attempts on successful login
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param userId - User ID
 * @returns Promise<void>
 */
export async function resetFailedLogins(db: D1Database, domain: string, userId: string): Promise<void> {
  await db.prepare(`
    UPDATE ${domain}_users 
    SET failed_login_attempts = 0, locked_until = NULL 
    WHERE id = ?
  `).bind(userId).run();
}

/**
 * Get maximum attempts allowed for current failure level
 * 
 * @param failedAttempts - Current number of failed attempts
 * @returns number - Maximum attempts allowed before lockout
 */
function getMaxAttemptsForLevel(failedAttempts: number): number {
  if (failedAttempts < 3) return 3;
  if (failedAttempts < 5) return 5;
  if (failedAttempts < 7) return 7;
  return 10;
}

/**
 * Get lockout duration in seconds for current failure level
 * 
 * @param failedAttempts - Current number of failed attempts
 * @returns number - Lockout duration in seconds
 */
function getLockoutDuration(failedAttempts: number): number {
  if (failedAttempts <= 3) return 5 * 60;      // 5 minutes
  if (failedAttempts <= 5) return 15 * 60;     // 15 minutes
  if (failedAttempts <= 7) return 60 * 60;     // 1 hour
  return 24 * 60 * 60;                         // 24 hours
}

/**
 * Create a password reset token for a user
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param email - User's email address
 * @returns Promise<PasswordResetToken | null> - Reset token if user exists, null otherwise
 */
export async function createPasswordResetToken(db: D1Database, domain: string, email: string): Promise<PasswordResetToken | null> {
  // Find user by email
  const user = await getUserByEmail(db, domain, email);
  if (!user) {
    return null;
  }

  // Generate secure token
  const token = generateSecureRandomString();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes expiry

  // Store token in database
  await db.prepare(`
    INSERT INTO ${domain}_password_reset_tokens (token, user_id, created_at, expires_at) 
    VALUES (?, ?, ?, ?)
  `).bind(
    token,
    user.id,
    Math.floor(now.getTime() / 1000),
    Math.floor(expiresAt.getTime() / 1000)
  ).run();

  const resetToken: PasswordResetToken = {
    token,
    userId: user.id,
    createdAt: now,
    expiresAt,
    usedAt: undefined
  };

  return resetToken;
}

/**
 * Validate a password reset token
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param token - Reset token to validate
 * @returns Promise<PasswordResetToken | null> - Valid token if found and not expired/used, null otherwise
 */
export async function validatePasswordResetToken(db: D1Database, domain: string, token: string): Promise<PasswordResetToken | null> {
  const result = await db.prepare(`
    SELECT token, user_id, created_at, expires_at, used_at
    FROM ${domain}_password_reset_tokens 
    WHERE token = ?
  `).bind(token).first();

  if (!result) {
    return null;
  }

  const resetToken: PasswordResetToken = {
    token: result.token as string,
    userId: result.user_id as string,
    createdAt: new Date((result.created_at as number) * 1000),
    expiresAt: new Date((result.expires_at as number) * 1000),
    usedAt: result.used_at ? new Date((result.used_at as number) * 1000) : undefined
  };

  // Check if token is expired
  if (resetToken.expiresAt < new Date()) {
    return null;
  }

  // Check if token has already been used
  if (resetToken.usedAt) {
    return null;
  }

  return resetToken;
}

/**
 * Mark a password reset token as used
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param token - Reset token to mark as used
 * @returns Promise<boolean> - True if token was marked as used, false if not found
 */
export async function markPasswordResetTokenAsUsed(db: D1Database, domain: string, token: string): Promise<boolean> {
  const now = Math.floor(new Date().getTime() / 1000);
  
  await db.prepare(`
    UPDATE ${domain}_password_reset_tokens 
    SET used_at = ? 
    WHERE token = ? AND used_at IS NULL
  `).bind(now, token).run();

  // Check if any rows were affected by querying the token again
  const result = await db.prepare(`
    SELECT used_at FROM ${domain}_password_reset_tokens WHERE token = ?
  `).bind(token).first();
  
  return result ? result.used_at !== null : false;
}

/**
 * Update user password
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @param userId - User ID
 * @param newPassword - New password
 * @returns Promise<User> - Updated user (without password)
 */
export async function updateUserPassword(db: D1Database, domain: string, userId: string, newPassword: string): Promise<User> {
  // Validate password strength
  if (!isValidPassword(newPassword)) {
    throw new Error(getPasswordValidationError(newPassword));
  }

  // Generate new password hash and salt
  const { hash: passwordHash, salt } = await hashPassword(newPassword);

  // Update password in database
  await db.prepare(`
    UPDATE ${domain}_users 
    SET password_hash = ?, password_salt = ? 
    WHERE id = ?
  `).bind(passwordHash, salt, userId).run();

  // Reset failed login attempts and unlock account
  await db.prepare(`
    UPDATE ${domain}_users 
    SET failed_login_attempts = 0, locked_until = NULL 
    WHERE id = ?
  `).bind(userId).run();

  // Return updated user
  const user = await getUserById(db, domain, userId);
  if (!user) {
    throw new Error('User not found after password update');
  }

  return user;
}

/**
 * Clean up expired password reset tokens
 * 
 * @param db - D1Database instance
 * @param domain - Domain prefix for table names
 * @returns Promise<number> - Number of tokens cleaned up
 */
export async function cleanupExpiredPasswordResetTokens(db: D1Database, domain: string): Promise<number> {
  const now = Math.floor(new Date().getTime() / 1000);
  
  // Get count before deletion
  const countResult = await db.prepare(`
    SELECT COUNT(*) as count FROM ${domain}_password_reset_tokens WHERE expires_at < ?
  `).bind(now).first();
  
  const count = countResult ? (countResult.count as number) : 0;
  
  // Delete expired tokens
  await db.prepare(`
    DELETE FROM ${domain}_password_reset_tokens 
    WHERE expires_at < ?
  `).bind(now).run();

  return count;
} 