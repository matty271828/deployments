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
    throw new Error('Password must be at least 8 characters long');
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
  return password.length >= 8;
} 