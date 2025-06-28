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
  emailVerified: boolean;
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

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
  csrfToken?: string; // Optional CSRF token for form protection
}

/**
 * Password reset confirmation request
 */
export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
  csrfToken?: string; // Optional CSRF token for form protection
}

/**
 * Password reset token interface
 */
export interface PasswordResetToken {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
}

/**
 * Email verification token interface
 */
export interface EmailVerificationToken {
  token: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
}

/**
 * Email verification request
 */
export interface EmailVerificationRequest {
  token: string;
  csrfToken?: string; // Optional CSRF token for form protection
}

/**
 * Resend verification email request
 */
export interface ResendVerificationRequest {
  email: string;
  csrfToken?: string; // Optional CSRF token for form protection
}

// Subscription-related interfaces

/**
 * Subscription status
 */
export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId?: string;
  status: 'free' | 'standard' | 'canceled' | 'past_due';
  planId?: string;
  currentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Stripe customer interface
 */
export interface StripeCustomer {
  id: string;
  userId: string;
  stripeCustomerId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create checkout session request
 */
export interface CreateCheckoutSessionRequest {
  priceId: string; // Required - frontend should provide the domain-specific price ID
  successUrl: string;
  cancelUrl: string;
  csrfToken?: string;
}

/**
 * Create customer portal session request
 */
export interface CreatePortalSessionRequest {
  returnUrl: string;
  csrfToken?: string;
}

/**
 * Subscription response
 */
export interface SubscriptionResponse {
  success: boolean;
  subscription?: Subscription;
  error?: string;
} 