import { User, UserWithPassword } from './types';
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
    createdAt: now
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
    SELECT id, email, password_hash, password_salt, created_at 
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
    createdAt: new Date((result.created_at as number) * 1000)
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
    SELECT id, email, created_at 
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
    createdAt: new Date((result.created_at as number) * 1000)
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
    createdAt: userWithPassword.createdAt
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