// TypeScript interfaces for our authentication system
// Following Lucia's recommendations for secure session implementation

/**
 * Session interface following Lucia's recommendations
 */
export interface Session {
  id: string;
  userId: string;
  secretHash: Uint8Array; // Uint8Array is a byte array
  createdAt: Date;
}

/**
 * Session with token for client communication
 */
export interface SessionWithToken extends Session {
  token: string; // Format: <SESSION_ID>.<SESSION_SECRET>
}

/**
 * Session validation result with specific error information
 */
export interface SessionValidationResult {
  success: boolean;
  session?: Session;
  error?: {
    type: 'invalid_format' | 'session_not_found' | 'invalid_secret' | 'expired';
    message: string;
  };
}

/**
 * User interface
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
}

/**
 * User with password for internal operations
 */
export interface UserWithPassword extends User {
  passwordHash: string;
}

/**
 * Authentication response for API endpoints
 */
export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  session?: {
    id: string;
    token: string;
    expiresAt: Date;
  };
}

/**
 * Error response for API endpoints
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

/**
 * Signup request
 */
export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  csrfToken?: string; // Optional CSRF token for form protection
}

/**
 * Login request
 */
export interface LoginRequest {
  email: string;
  password: string;
  csrfToken?: string; // Optional CSRF token for form protection
}

/**
 * Session validation request
 */
export interface SessionRequest {
  token: string;
} 