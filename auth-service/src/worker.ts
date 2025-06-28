/**
 * Authentication Service Worker
 * 
 * A centralized authentication service for multiple domains.
 * Each domain gets its own isolated user and session data.
 * 
 * Endpoints:
 * - GET/POST /auth/health - Service health check
 * - POST /auth/signup - User registration
 * - POST /auth/login - User authentication
 * - GET /auth/session - Session validation
 * - POST /auth/logout - Session termination
 * - POST /auth/refresh - Session token refresh
 * - POST /auth/cleanup - Rate limit cleanup
 * - GET /auth/csrf-token - CSRF token generation
 * - POST/GET /auth/graphql - GraphQL proxy to domain workers
 * - GET /auth/debug - Debug database state and session creation
 * - POST /auth/password-reset - Request password reset
 * - POST /auth/password-reset/confirm - Confirm password reset
 * - POST /auth/verify-email - Verify user email
 * - POST /auth/resend-verification - Resend verification email
 * - GET /auth/subscription - Get user subscription status
 * - POST /auth/create-checkout-session - Create Stripe Checkout session
 * - POST /auth/create-portal-session - Create customer portal session
 * - POST /auth/webhook - Handle Stripe webhooks
 */

import { D1Database } from '@cloudflare/workers-types';
import { createUser, getUserByEmail, getUserById, createPasswordResetToken, validatePasswordResetToken, markPasswordResetTokenAsUsed, updateUserPassword, createEmailVerificationToken, verifyUserEmail } from './users';
import { createSession, deleteSession, validateSessionToken, generateCSRFToken, validateCSRFToken } from './sessions';
import { SignupRequest, LoginRequest, SessionValidationResult, PasswordResetRequest, PasswordResetConfirmRequest, EmailVerificationRequest, ResendVerificationRequest, CreateCheckoutSessionRequest, CreatePortalSessionRequest } from './types';
import { rateLimiters, getClientIP } from './rate-limiter';
import { getSecureCorsHeaders, handlePreflight } from './cors';
import { generateSecureRandomString } from './generator';
import { createEmailService } from './email';
import { getSubscription, createCheckoutSession, createPortalSession, updateSubscriptionFromWebhook, createInitialSubscription, isWebhookProcessed, markWebhookProcessed, getUserEmail, handleCheckoutSessionCompleted, handleSubscriptionEvent, handleInvoicePaymentSucceeded, handleInvoicePaymentFailed } from './subscriptions';

// Type for handler methods
type HandlerMethod = (request: Request, subdomain: string, corsHeaders: any, env?: any) => Promise<Response>;

// Endpoint configuration with allowed methods
const ENDPOINTS = {
  '/auth/health': {
    GET: 'healthCheck',
  },
  '/auth/signup': {
    POST: 'signup'
  },
  '/auth/login': {
    POST: 'login'
  },
  '/auth/session': {
    GET: 'validateSession'
  },
  '/auth/logout': {
    POST: 'logout'
  },
  '/auth/refresh': {
    POST: 'refreshSession'
  },
  '/auth/csrf-token': {
    GET: 'getCSRFToken'
  },
  '/auth/graphql': {
    POST: 'proxyGraphQL',
    GET: 'proxyGraphQL'
  },
  '/auth/debug': {
    GET: 'debugDatabase'
  },
  '/auth/password-reset': {
    POST: 'requestPasswordReset'
  },
  '/auth/password-reset/confirm': {
    POST: 'confirmPasswordReset'
  },
  '/auth/verify-email': {
    POST: 'verifyEmail'
  },
  '/auth/resend-verification': {
    POST: 'resendVerification'
  },
  '/auth/subscription': {
    GET: 'getSubscription'
  },
  '/auth/create-checkout-session': {
    POST: 'createCheckoutSession'
  },
  '/auth/create-portal-session': {
    POST: 'createPortalSession'
  },
  '/auth/webhook': {
    POST: 'handleWebhook'
  }
} as const;

// Helper method to create consistent error responses
function createErrorResponse(error: string, status: number, corsHeaders: any): Response {
  return new Response(JSON.stringify({ 
    success: false, 
    error: error,
    status: status
  }), {
    status: status,
    headers: corsHeaders
  });
}

// Centralized error handling function
function handleApiError(error: any, corsHeaders: any): Response {
  // Handle specific validation errors
  if (error.message === 'Invalid email format') {
    return createErrorResponse('Invalid email format', 400, corsHeaders);
  }
  if (error.message === 'Password must be at least 8 characters long') {
    return createErrorResponse('Password must be at least 8 characters long', 400, corsHeaders);
  }
  if (error.message === 'User already exists') {
    return createErrorResponse('User already exists', 409, corsHeaders);
  }

  // Handle JSON parsing errors
  if (error instanceof SyntaxError) {
    return createErrorResponse('Invalid JSON in request body', 400, corsHeaders);
  }

  // Handle database/schema errors
  if (error.message && error.message.includes('no such table')) {
    return createErrorResponse('Database schema not initialized. Please contact administrator.', 503, corsHeaders);
  }
  if (error.message && error.message.includes('UNIQUE constraint failed')) {
    return createErrorResponse('User already exists', 409, corsHeaders);
  }
  if (error.message && error.message.includes('NOT NULL constraint failed')) {
    return createErrorResponse('Missing required fields', 400, corsHeaders);
  }

  // Handle other errors with more detail
  console.error('API Error:', error);
  return createErrorResponse(
    'Internal server error', 
    500, 
    corsHeaders
  );
}

// Handler implementations
const handlers = {
  /**
   * Health check endpoint - returns service status and domain info
   */
  async healthCheck(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    return new Response(JSON.stringify({ 
      status: 200, 
      domain: request.headers.get('host'),
      subdomain: subdomain,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: corsHeaders
    });
  },

  /**
   * User registration endpoint
   */
  async signup(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.signup.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many signup attempts. Please try again later.', 429, corsHeaders);
      }

      // Parse request body
      const body = await request.json() as SignupRequest;
      const { email, password, firstName, lastName, csrfToken } = body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        return createErrorResponse('Email, password, firstName, and lastName are required', 400, corsHeaders);
      }

      // Validate email and password types
      if (typeof email !== 'string' || typeof password !== 'string' || 
          typeof firstName !== 'string' || typeof lastName !== 'string') {
        return createErrorResponse('All fields must be strings', 400, corsHeaders);
      }

      // CSRF token validation (if provided)
      if (csrfToken) {
        console.log(`[SIGNUP] CSRF token provided: ${csrfToken.substring(0, 10)}...`);
        
        // For form submissions, validate CSRF token
        try {
          const isValidCSRF = await validateCSRFToken(env.AUTH_DB_BINDING, subdomain, csrfToken);
          console.log(`[SIGNUP] CSRF token validation result: ${isValidCSRF}`);
          
          if (!isValidCSRF) {
            console.error(`[SIGNUP] CSRF TOKEN VALIDATION FAILED - Token: ${csrfToken.substring(0, 10)}..., Domain: ${subdomain}, IP: ${clientIP}`);
            console.error(`[SIGNUP] This is a CSRF security issue - token may be expired, invalid, or already used`);
            return createErrorResponse('Invalid CSRF token - security validation failed', 403, corsHeaders);
          }
          
          console.log(`[SIGNUP] CSRF token validation successful`);
        } catch (csrfError: any) {
          console.error(`[SIGNUP] CSRF TOKEN VALIDATION ERROR - Token: ${csrfToken.substring(0, 10)}..., Domain: ${subdomain}, Error: ${csrfError.message}`);
          console.error(`[SIGNUP] This is a CSRF validation error - database issue or token corruption`);
          return createErrorResponse('CSRF token validation error', 403, corsHeaders);
        }
      } else {
        console.log(`[SIGNUP] No CSRF token provided - proceeding without CSRF validation`);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Create user
      const user = await createUser(env.AUTH_DB_BINDING, subdomain, email, password, firstName, lastName);

      // Create email verification token
      const verificationToken = await createEmailVerificationToken(env.AUTH_DB_BINDING, subdomain, email);

      // Send confirmation email
      let emailSent = false;
      let emailError = null;
      try {
        console.log(`[SIGNUP] Attempting to send confirmation email to ${email}...`);
        const emailService = createEmailService(env);
        const fullDomain = new URL(request.url).hostname;
        console.log(`[SIGNUP] Using domain: ${fullDomain} for email`);
        await emailService.sendSignupConfirmation(email, firstName, lastName, fullDomain, verificationToken?.token || '');
        emailSent = true;
        console.log(`[SIGNUP] ✅ Confirmation email sent successfully to ${email} for domain ${fullDomain}`);
      } catch (emailError: any) {
        console.error(`[SIGNUP] ❌ Failed to send confirmation email to ${email}:`, emailError.message);
        console.error(`[SIGNUP] Email error details:`, emailError);
        emailError = emailError.message;
        // Don't fail the signup if email fails - just log the error
      }

      // Create session for the new user
      let session;
      try {
        session = await createSession(env.AUTH_DB_BINDING, subdomain, user.id);
        console.log(`Session created successfully for user ${user.id}: ${session.id}`);
      } catch (sessionError: any) {
        console.error(`Failed to create session for user ${user.id}:`, sessionError);
        // Return user creation success but session creation failure
        return new Response(JSON.stringify({
          success: true,
          message: 'User created successfully, but session creation failed',
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: user.createdAt
          },
          session: null,
          sessionError: sessionError.message,
          emailSent: emailSent,
          emailError: emailError
        }), {
          status: 201,
          headers: corsHeaders
        });
      }

      // Return success response with user and session
      return new Response(JSON.stringify({
        success: true,
        message: 'User created successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt
        },
        session: {
          id: session.id,
          token: session.token,
          expiresAt: new Date(session.createdAt.getTime() + (24 * 60 * 60 * 1000)) // 24 hours
        },
        emailSent: emailSent,
        emailError: emailError
      }), {
        status: 201,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * User authentication endpoint
   */
  async login(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.login.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many login attempts. Please try again later.', 429, corsHeaders);
      }

      // Parse request body
      const body = await request.json() as LoginRequest;
      const { email, password, csrfToken } = body;

      // Validate required fields
      if (!email || !password) {
        return createErrorResponse('Email and password are required', 400, corsHeaders);
      }

      // Validate email and password types
      if (typeof email !== 'string' || typeof password !== 'string') {
        return createErrorResponse('Email and password must be strings', 400, corsHeaders);
      }

      // CSRF token validation (if provided)
      if (csrfToken) {
        // For form submissions, validate CSRF token
        const isValidCSRF = await validateCSRFToken(env.AUTH_DB_BINDING, subdomain, csrfToken);
        if (!isValidCSRF) {
          return createErrorResponse('Invalid CSRF token', 403, corsHeaders);
        }
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Import required functions
      const { validateCredentials, checkAccountLockout, recordFailedLogin, resetFailedLogins } = await import('./users');

      // First, get user by email to check lockout status
      const userWithPassword = await getUserByEmail(env.AUTH_DB_BINDING, subdomain, email);
      
      if (userWithPassword) {
        // Check if account is locked
        const lockoutStatus = await checkAccountLockout(env.AUTH_DB_BINDING, subdomain, userWithPassword.id);
        
        if (lockoutStatus.isLocked) {
          const lockoutTime = lockoutStatus.lockedUntil!;
          const remainingMinutes = Math.ceil((lockoutTime.getTime() - Date.now()) / (1000 * 60));
          
          return createErrorResponse(
            `Account temporarily locked. Please try again in ${remainingMinutes} minutes.`, 
            423, 
            corsHeaders
          );
        }
      }

      // Validate credentials
      const user = await validateCredentials(env.AUTH_DB_BINDING, subdomain, email, password);
      
      if (!user) {
        // Record failed login attempt if user exists
        if (userWithPassword) {
          await recordFailedLogin(env.AUTH_DB_BINDING, subdomain, userWithPassword.id);
          
          // Check if account is now locked after this failed attempt
          const newLockoutStatus = await checkAccountLockout(env.AUTH_DB_BINDING, subdomain, userWithPassword.id);
          
          if (newLockoutStatus.isLocked) {
            const lockoutTime = newLockoutStatus.lockedUntil!;
            const remainingMinutes = Math.ceil((lockoutTime.getTime() - Date.now()) / (1000 * 60));
            
            return createErrorResponse(
              `Account locked due to too many failed attempts. Please try again in ${remainingMinutes} minutes.`, 
              423, 
              corsHeaders
            );
          } else {
            return createErrorResponse(
              `Invalid email or password. ${newLockoutStatus.remainingAttempts} attempts remaining before lockout.`, 
              401, 
              corsHeaders
            );
          }
        }
        
        return createErrorResponse('Invalid email or password', 401, corsHeaders);
      }

      // Reset failed login attempts on successful login
      await resetFailedLogins(env.AUTH_DB_BINDING, subdomain, user.id);

      // Create session for the authenticated user
      const session = await createSession(env.AUTH_DB_BINDING, subdomain, user.id);

      // Return success response with user and session
      return new Response(JSON.stringify({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt
        },
        session: {
          id: session.id,
          token: session.token,
          expiresAt: new Date(session.createdAt.getTime() + (24 * 60 * 60 * 1000)) // 24 hours
        }
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Session validation endpoint
   */
  async validateSession(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.session.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many session requests. Please try again later.', 429, corsHeaders);
      }

      // Get user from session
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createErrorResponse('Authentication required', 401, corsHeaders);
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const sessionValidation = await validateSessionToken(env.AUTH_DB_BINDING, subdomain, token);
      if (!sessionValidation.success || !sessionValidation.session) {
        return createErrorResponse('Authentication required', 401, corsHeaders);
      }

      const userId = sessionValidation.session.userId;

      // Get user information
      const user = await getUserById(env.AUTH_DB_BINDING, subdomain, userId);
      if (!user) {
        return createErrorResponse('User not found', 404, corsHeaders);
      }

      // Return success response with user and session info
      return new Response(JSON.stringify({
        success: true,
        message: 'Session is valid',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt
        },
        session: {
          id: sessionValidation.session.id,
          createdAt: sessionValidation.session.createdAt,
          expiresAt: new Date(sessionValidation.session.createdAt.getTime() + (24 * 60 * 60 * 1000)) // 24 hours
        }
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Session termination endpoint
   */
  async logout(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.session.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many session requests. Please try again later.', 429, corsHeaders);
      }

      // Get session token from Authorization header
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createErrorResponse('Authorization header with Bearer token is required', 401, corsHeaders);
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Parse token to get session ID
      const tokenParts = token.split('.');
      if (tokenParts.length !== 2) {
        return createErrorResponse('Invalid session token format. Expected format: <session_id>.<session_secret>', 400, corsHeaders);
      }

      const sessionId = tokenParts[0];

      // Delete the session
      await deleteSession(env.AUTH_DB_BINDING, subdomain, sessionId);

      // Return success response
      return new Response(JSON.stringify({
        success: true,
        message: 'Logout successful'
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Session refresh endpoint
   */
  async refreshSession(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.session.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many session requests. Please try again later.', 429, corsHeaders);
      }

      // Get session token from Authorization header
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createErrorResponse('Authorization header with Bearer token is required', 401, corsHeaders);
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Validate the current session token
      const validationResult = await validateSessionToken(env.AUTH_DB_BINDING, subdomain, token);
      if (!validationResult.success) {
        console.error(`[REFRESH SESSION API] Session validation failed | Subdomain: ${subdomain} | Error type: ${validationResult.error!.type} | Error message: ${validationResult.error!.message} | Token: ${token.substring(0, 20)}...`);
        return createErrorResponse(validationResult.error!.message, 401, corsHeaders);
      }

      const currentSession = validationResult.session!;

      // Delete the old session
      await deleteSession(env.AUTH_DB_BINDING, subdomain, currentSession.id);

      // Create a new session
      const newSession = await createSession(env.AUTH_DB_BINDING, subdomain, currentSession.userId);

      // Return success response with new session
      return new Response(JSON.stringify({
        success: true,
        message: 'Session refreshed successfully',
        session: {
          id: newSession.id,
          token: newSession.token,
          expiresAt: new Date(newSession.createdAt.getTime() + (24 * 60 * 60 * 1000)) // 24 hours
        }
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Rate limit cleanup endpoint (for maintenance)
   */
  async cleanupRateLimits(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting - very strict for maintenance endpoint
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.api.consume(env.AUTH_DB_BINDING, subdomain, clientIP, 5); // Higher cost
      if (!isAllowed) {
        return createErrorResponse('Too many cleanup requests. Please try again later.', 429, corsHeaders);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Clean up old rate limit entries (older than 24 hours)
      await rateLimiters.login.cleanup(env.AUTH_DB_BINDING, subdomain, 24);
      await rateLimiters.signup.cleanup(env.AUTH_DB_BINDING, subdomain, 24);
      await rateLimiters.api.cleanup(env.AUTH_DB_BINDING, subdomain, 24);

      return new Response(JSON.stringify({
        success: true,
        message: 'Rate limit cleanup completed'
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * CSRF token generation endpoint
   */
  async getCSRFToken(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.api.consume(env.AUTH_DB_BINDING, subdomain, clientIP, 5); // Higher cost
      if (!isAllowed) {
        return createErrorResponse('Too many CSRF token requests. Please try again later.', 429, corsHeaders);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Generate a new CSRF token
      const token = await generateCSRFToken(env.AUTH_DB_BINDING, subdomain);

      // Return success response with CSRF token
      return new Response(JSON.stringify({
        success: true,
        message: 'CSRF token generated successfully',
        token: token
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * GraphQL proxy endpoint - validates user session and proxies to domain worker
   */
  async proxyGraphQL(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Generate a unique request ID for tracking
      const requestId = crypto.randomUUID();
      console.log(`[AUTH SERVICE] [${requestId}] Starting GraphQL proxy for subdomain: ${subdomain}`);
      
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.api.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many GraphQL requests. Please try again later.', 429, corsHeaders);
      }

      // Get session token from Authorization header
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createErrorResponse('Authorization header with Bearer token is required', 401, corsHeaders);
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      console.log(`[AUTH SERVICE] [${requestId}] Session token received: ${token.substring(0, 10)}...`);

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Extract user_id from token without full session validation
      // Since the auth service is the single source of truth, we can trust the token format
      const tokenParts = token.split(".");
      if (tokenParts.length !== 2) {
        console.error(`[AUTH SERVICE] [${requestId}] Invalid token format`);
        return createErrorResponse('Invalid session token format', 401, corsHeaders);
      }

      const sessionId = tokenParts[0];
      console.log(`[AUTH SERVICE] [${requestId}] Extracting user_id from session: ${sessionId}`);

      // Get user_id from session without validating the secret
      const sessionResult = await env.AUTH_DB_BINDING.prepare(
        `SELECT user_id FROM ${subdomain}_sessions WHERE id = ?`
      ).bind(sessionId).first();

      if (!sessionResult) {
        console.error(`[AUTH SERVICE] [${requestId}] Session not found in database`);
        return createErrorResponse('Invalid or expired session', 401, corsHeaders);
      }

      const userId = (sessionResult as any).user_id;
      console.log(`[AUTH SERVICE] [${requestId}] User ID extracted: ${userId}`);

      // Get user information
      const user = await getUserById(env.AUTH_DB_BINDING, subdomain, userId);
      if (!user) {
        return createErrorResponse('User not found', 404, corsHeaders);
      }

      // Find the domain worker for this subdomain
      // The domain worker name format is "{repo_name}-worker"
      // Based on the Terraform configuration, the binding name matches the worker name
      
      console.log(`[AUTH SERVICE] Looking for domain worker binding | Subdomain: ${subdomain} | All available bindings: ${Object.keys(env).join(', ')}`);
      
      // Get all worker bindings
      const workerBindings = Object.keys(env).filter(key => key.includes('worker'));
      console.log(`[AUTH SERVICE] Worker bindings found: ${workerBindings.join(', ')}`);
      
      // The binding name should be "{subdomain}-worker" based on the Terraform configuration
      const domainWorkerName = `${subdomain}-worker`;
      
      if (!env[domainWorkerName]) {
        console.error(`[AUTH SERVICE] Domain worker binding not found: ${domainWorkerName}`);
        console.log(`[AUTH SERVICE] Available worker bindings: ${workerBindings.join(', ')}`);
        
        // If the exact match doesn't work, let's try to find any worker binding
        if (workerBindings.length > 0) {
          console.log(`[AUTH SERVICE] Using fallback binding: ${workerBindings[0]}`);
          // For debugging, use the first available worker binding
          const fallbackBinding = workerBindings[0];
          
          // Continue with the fallback binding for testing
          const graphqlRequest = new Request('https://domain-worker.local/graphql', {
            method: request.method,
            headers: {
              'Content-Type': 'application/json',
              'X-User-ID': user.id.toString(),
              'X-Auth-Service-Token': 'trusted-auth-service',
              'X-Forwarded-By': 'auth-service'
            },
            body: request.method === 'POST' ? await request.text() : undefined
          });

          console.log(`[AUTH SERVICE] Forwarding request to domain worker | Binding: ${fallbackBinding} | Headers: X-User-ID=${user.id.toString()}, X-Auth-Service-Token=trusted-auth-service, X-Forwarded-By=auth-service`);
          
          const domainWorkerResponse = await env[fallbackBinding].fetch(graphqlRequest);
          
          console.log(`[AUTH SERVICE] Domain worker response status: ${domainWorkerResponse.status}`);

          return new Response(domainWorkerResponse.body, {
            status: domainWorkerResponse.status,
            statusText: domainWorkerResponse.statusText,
            headers: {
              ...Object.fromEntries(domainWorkerResponse.headers.entries()),
              ...corsHeaders
            }
          });
        }
        
        return createErrorResponse('Domain worker not available', 503, corsHeaders);
      }
      
      console.log(`[AUTH SERVICE] Using domain worker binding: ${domainWorkerName}`);
      
      // Debug the binding object
      const binding = env[domainWorkerName];
      console.log(`[AUTH SERVICE] Binding debug | Type: ${typeof binding} | Is function: ${typeof binding === 'function'} | Has fetch: ${binding && typeof binding.fetch === 'function'}`);
      
      if (!binding || typeof binding.fetch !== 'function') {
        console.error(`[AUTH SERVICE] Binding is not a valid worker binding!`);
        return createErrorResponse('Invalid domain worker binding', 503, corsHeaders);
      }

      // Prepare the request to the domain worker
      const graphqlRequest = new Request('https://domain-worker.local/graphql', {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.id.toString(),
          'X-Auth-Service-Token': 'trusted-auth-service',
          'X-Forwarded-By': 'auth-service'
        },
        body: request.method === 'POST' ? await request.text() : undefined
      });

      console.log(`[AUTH SERVICE] Forwarding request to domain worker | Binding: ${domainWorkerName} | Headers: X-User-ID=${user.id.toString()}, X-Auth-Service-Token=trusted-auth-service, X-Forwarded-By=auth-service`);
      
      try {
        const domainWorkerResponse = await env[domainWorkerName].fetch(graphqlRequest);
        console.log(`[AUTH SERVICE] Domain worker response | Status: ${domainWorkerResponse.status} | Headers: ${JSON.stringify(Object.fromEntries(domainWorkerResponse.headers.entries()))}`);
        
        // Check if the response indicates an error
        if (domainWorkerResponse.status >= 400) {
          console.error(`[AUTH SERVICE] Domain worker returned error status: ${domainWorkerResponse.status}`);
          const errorBody = await domainWorkerResponse.text();
          console.error(`[AUTH SERVICE] Domain worker error body: ${errorBody}`);
          
          // Return the error response from the domain worker
          return new Response(errorBody, {
            status: domainWorkerResponse.status,
            statusText: domainWorkerResponse.statusText,
            headers: {
              ...Object.fromEntries(domainWorkerResponse.headers.entries()),
              ...corsHeaders
            }
          });
        }
        
        // Get the response body for debugging
        const responseBody = await domainWorkerResponse.text();
        console.log(`[AUTH SERVICE] Domain worker response body: ${responseBody.substring(0, 200)}...`);

        // Return the domain worker's response
        return new Response(responseBody, {
          status: domainWorkerResponse.status,
          statusText: domainWorkerResponse.statusText,
          headers: {
            ...Object.fromEntries(domainWorkerResponse.headers.entries()),
            ...corsHeaders
          }
        });
      } catch (fetchError: any) {
        console.error(`[AUTH SERVICE] Worker-to-worker fetch failed:`, fetchError);
        console.error(`[AUTH SERVICE] Fetch error message:`, fetchError.message);
        console.error(`[AUTH SERVICE] Fetch error stack:`, fetchError.stack);
        throw fetchError;
      }

    } catch (error: any) {
      console.error(`[AUTH SERVICE] Error in proxyGraphQL:`, error);
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Debug endpoint - checks database state and session creation
   */
  async debugDatabase(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Check database state
      const databaseState = await env.AUTH_DB_BINDING.prepare('SELECT name FROM sqlite_master WHERE type="table";').all();
      const tableNames = databaseState.results?.map((row: any) => row.name) || [];

      // Check if domain-specific tables exist
      const usersTable = `${subdomain}_users`;
      const sessionsTable = `${subdomain}_sessions`;
      
      let userCount = 0;
      let sessionCount = 0;
      
      try {
        // Check users table
        const usersResult = await env.AUTH_DB_BINDING.prepare(`SELECT COUNT(*) as count FROM ${usersTable};`).first();
        userCount = usersResult ? (usersResult as any).count : 0;
      } catch (error) {
        // Table doesn't exist
      }
      
      try {
        // Check sessions table
        const sessionsResult = await env.AUTH_DB_BINDING.prepare(`SELECT COUNT(*) as count FROM ${sessionsTable};`).first();
        sessionCount = sessionsResult ? (sessionsResult as any).count : 0;
      } catch (error) {
        // Table doesn't exist
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Database debug information',
        subdomain: subdomain,
        allTables: tableNames,
        expectedUsersTable: usersTable,
        expectedSessionsTable: sessionsTable,
        userCount: userCount,
        sessionCount: sessionCount,
        databaseBinding: env.AUTH_DB_BINDING ? 'Available' : 'Not Available'
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return createErrorResponse(`Debug error: ${error.message}`, 500, corsHeaders);
    }
  },

  /**
   * Password reset request endpoint
   */
  async requestPasswordReset(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.login.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many password reset requests. Please try again later.', 429, corsHeaders);
      }

      // Parse request body
      const body = await request.json() as PasswordResetRequest;
      const { email, csrfToken } = body;

      // Validate required fields
      if (!email) {
        return createErrorResponse('Email is required', 400, corsHeaders);
      }

      // Validate email type
      if (typeof email !== 'string') {
        return createErrorResponse('Email must be a string', 400, corsHeaders);
      }

      // CSRF token validation (if provided)
      if (csrfToken) {
        try {
          const isValidCSRF = await validateCSRFToken(env.AUTH_DB_BINDING, subdomain, csrfToken);
          if (!isValidCSRF) {
            return createErrorResponse('Invalid CSRF token - security validation failed', 403, corsHeaders);
          }
        } catch (csrfError: any) {
          return createErrorResponse('CSRF token validation error', 403, corsHeaders);
        }
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Create password reset token
      const resetToken = await createPasswordResetToken(env.AUTH_DB_BINDING, subdomain, email);
      
      // Always return success to prevent email enumeration
      // If user doesn't exist, we still return success but don't send email
      if (!resetToken) {
        console.log(`[PASSWORD RESET] Password reset requested for non-existent email: ${email}`);
        return new Response(JSON.stringify({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Get user details for email
      const user = await getUserById(env.AUTH_DB_BINDING, subdomain, resetToken.userId);
      if (!user) {
        return new Response(JSON.stringify({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Send password reset email
      let emailSent = false;
      let emailError = null;
      try {
        console.log(`[PASSWORD RESET] Sending password reset email to ${email}...`);
        const emailService = createEmailService(env);
        const fullDomain = new URL(request.url).hostname;
        await emailService.sendPasswordReset(email, user.firstName, user.lastName, fullDomain, resetToken.token);
        emailSent = true;
        console.log(`[PASSWORD RESET] ✅ Password reset email sent successfully to ${email}`);
      } catch (emailError: any) {
        console.error(`[PASSWORD RESET] ❌ Failed to send password reset email to ${email}:`, emailError.message);
        emailError = emailError.message;
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      console.error('[PASSWORD RESET] Error:', error);
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Password reset confirmation endpoint
   */
  async confirmPasswordReset(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.login.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many password reset attempts. Please try again later.', 429, corsHeaders);
      }

      // Parse request body
      const body = await request.json() as PasswordResetConfirmRequest;
      const { token, newPassword, csrfToken } = body;

      // Validate required fields
      if (!token || !newPassword) {
        return createErrorResponse('Token and newPassword are required', 400, corsHeaders);
      }

      // Validate field types
      if (typeof token !== 'string' || typeof newPassword !== 'string') {
        return createErrorResponse('Token and newPassword must be strings', 400, corsHeaders);
      }

      // CSRF token validation (if provided)
      if (csrfToken) {
        try {
          const isValidCSRF = await validateCSRFToken(env.AUTH_DB_BINDING, subdomain, csrfToken);
          if (!isValidCSRF) {
            return createErrorResponse('Invalid CSRF token - security validation failed', 403, corsHeaders);
          }
        } catch (csrfError: any) {
          return createErrorResponse('CSRF token validation error', 403, corsHeaders);
        }
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Validate reset token
      const resetToken = await validatePasswordResetToken(env.AUTH_DB_BINDING, subdomain, token);
      if (!resetToken) {
        return createErrorResponse('Invalid or expired password reset token', 400, corsHeaders);
      }

      // Update user password
      const updatedUser = await updateUserPassword(env.AUTH_DB_BINDING, subdomain, resetToken.userId, newPassword);

      // Mark token as used
      await markPasswordResetTokenAsUsed(env.AUTH_DB_BINDING, subdomain, token);

      console.log(`[PASSWORD RESET] ✅ Password successfully reset for user ${updatedUser.id}`);

      return new Response(JSON.stringify({
        success: true,
        message: 'Password has been successfully reset. You can now log in with your new password.',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          createdAt: updatedUser.createdAt
        }
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      console.error('[PASSWORD RESET CONFIRM] Error:', error);
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Email verification endpoint
   */
  async verifyEmail(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.api.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many email verification requests. Please try again later.', 429, corsHeaders);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Parse request body
      const body = await request.json() as EmailVerificationRequest;
      const { token } = body;

      // Validate required fields
      if (!token) {
        return createErrorResponse('Token is required', 400, corsHeaders);
      }

      // Validate token type
      if (typeof token !== 'string') {
        return createErrorResponse('Token must be a string', 400, corsHeaders);
      }

      // Verify user email
      const verificationResult = await verifyUserEmail(env.AUTH_DB_BINDING, subdomain, token);
      if (!verificationResult) {
        return createErrorResponse('Invalid or expired verification token', 400, corsHeaders);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Email verification successful',
        user: {
          id: verificationResult.id,
          email: verificationResult.email,
          firstName: verificationResult.firstName,
          lastName: verificationResult.lastName,
          emailVerified: verificationResult.emailVerified
        }
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Resend verification email endpoint
   */
  async resendVerification(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.api.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many resend verification requests. Please try again later.', 429, corsHeaders);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Parse request body
      const body = await request.json() as ResendVerificationRequest;
      const { email } = body;

      // Validate required fields
      if (!email) {
        return createErrorResponse('Email is required', 400, corsHeaders);
      }

      // Validate email type
      if (typeof email !== 'string') {
        return createErrorResponse('Email must be a string', 400, corsHeaders);
      }

      // Create verification token
      const verificationToken = await createEmailVerificationToken(env.AUTH_DB_BINDING, subdomain, email);
      if (!verificationToken) {
        return createErrorResponse('User not found or already verified', 404, corsHeaders);
      }

      // Get user details for email
      const user = await getUserById(env.AUTH_DB_BINDING, subdomain, verificationToken.userId);
      if (!user) {
        return createErrorResponse('User not found', 404, corsHeaders);
      }

      // Send verification email
      let emailSent = false;
      let emailError = null;
      try {
        console.log(`[RESEND VERIFICATION] Sending verification email to ${email}...`);
        const emailService = createEmailService(env);
        const fullDomain = new URL(request.url).hostname;
        await emailService.sendSignupConfirmation(email, user.firstName, user.lastName, fullDomain, verificationToken.token);
        emailSent = true;
        console.log(`[RESEND VERIFICATION] ✅ Verification email sent successfully to ${email}`);
      } catch (emailError: any) {
        console.error(`[RESEND VERIFICATION] ❌ Failed to send verification email to ${email}:`, emailError.message);
        emailError = emailError.message;
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Verification email sent successfully'
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Get user subscription status endpoint
   */
  async getSubscription(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.api.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many subscription requests. Please try again later.', 429, corsHeaders);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Get user from session
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createErrorResponse('Authentication required', 401, corsHeaders);
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const sessionValidation = await validateSessionToken(env.AUTH_DB_BINDING, subdomain, token);
      if (!sessionValidation.success || !sessionValidation.session) {
        return createErrorResponse('Authentication required', 401, corsHeaders);
      }

      const userId = sessionValidation.session.userId;

      // Get subscription status
      const subscription = await getSubscription(env.AUTH_DB_BINDING, subdomain, userId);
      
      // If no subscription exists, create a free one
      if (!subscription) {
        await createInitialSubscription(env.AUTH_DB_BINDING, subdomain, userId);
        return new Response(JSON.stringify({
          success: true,
          subscription: {
            status: 'free',
            planId: null,
            currentPeriodEnd: null
          }
        }), {
          status: 200,
          headers: corsHeaders
        });
      }

      return new Response(JSON.stringify({
        success: true,
        subscription: subscription
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Create Stripe Checkout session endpoint
   */
  async createCheckoutSession(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.api.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many checkout session requests. Please try again later.', 429, corsHeaders);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Check if Stripe is configured
      if (!env?.STRIPE_SECRET_KEY) {
        return createErrorResponse('Stripe integration not yet configured. Please set up STRIPE_SECRET_KEY environment variable.', 503, corsHeaders);
      }

      // Get user from session
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createErrorResponse('Authentication required', 401, corsHeaders);
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const sessionValidation = await validateSessionToken(env.AUTH_DB_BINDING, subdomain, token);
      if (!sessionValidation.success || !sessionValidation.session) {
        return createErrorResponse('Authentication required', 401, corsHeaders);
      }

      const userId = sessionValidation.session.userId;

      // Parse request body
      const body = await request.json() as CreateCheckoutSessionRequest;
      const { priceId, successUrl, cancelUrl, csrfToken } = body;

      // Validate required fields
      if (!priceId || !successUrl || !cancelUrl) {
        return createErrorResponse('Price ID, success URL and cancel URL are required', 400, corsHeaders);
      }

      // CSRF token validation (if provided)
      if (csrfToken) {
        const isValidCSRF = await validateCSRFToken(env.AUTH_DB_BINDING, subdomain, csrfToken);
        if (!isValidCSRF) {
          return createErrorResponse('Invalid CSRF token', 403, corsHeaders);
        }
      }

      // Get user email
      const userEmail = await getUserEmail(env.AUTH_DB_BINDING, subdomain, userId);
      if (!userEmail) {
        return createErrorResponse('User email not found', 404, corsHeaders);
      }

      // Initialize Stripe
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });

      // Create checkout session
      const checkoutUrl = await createCheckoutSession(
        env.AUTH_DB_BINDING,
        subdomain,
        userId,
        userEmail,
        { priceId, successUrl, cancelUrl },
        stripe,
        request.headers.get('host') || subdomain
      );

      return new Response(JSON.stringify({
        success: true,
        checkoutUrl: checkoutUrl
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Create customer portal session endpoint
   */
  async createPortalSession(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.api.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many portal session requests. Please try again later.', 429, corsHeaders);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Check if Stripe is configured
      if (!env?.STRIPE_SECRET_KEY) {
        return createErrorResponse('Stripe integration not yet configured. Please set up STRIPE_SECRET_KEY environment variable.', 503, corsHeaders);
      }

      // Get user from session
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return createErrorResponse('Authentication required', 401, corsHeaders);
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const sessionValidation = await validateSessionToken(env.AUTH_DB_BINDING, subdomain, token);
      if (!sessionValidation.success || !sessionValidation.session) {
        return createErrorResponse('Authentication required', 401, corsHeaders);
      }

      const userId = sessionValidation.session.userId;

      // Parse request body
      const body = await request.json() as CreatePortalSessionRequest;
      const { returnUrl, csrfToken } = body;

      // Validate required fields
      if (!returnUrl) {
        return createErrorResponse('Return URL is required', 400, corsHeaders);
      }

      // CSRF token validation (if provided)
      if (csrfToken) {
        const isValidCSRF = await validateCSRFToken(env.AUTH_DB_BINDING, subdomain, csrfToken);
        if (!isValidCSRF) {
          return createErrorResponse('Invalid CSRF token', 403, corsHeaders);
        }
      }

      // Initialize Stripe
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });

      // Create portal session
      const portalUrl = await createPortalSession(
        env.AUTH_DB_BINDING,
        subdomain,
        userId,
        { returnUrl },
        stripe
      );

      return new Response(JSON.stringify({
        success: true,
        portalUrl: portalUrl
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  },

  /**
   * Handle Stripe webhook endpoint
   */
  async handleWebhook(request: Request, subdomain: string, corsHeaders: any, env?: any): Promise<Response> {
    try {
      // Rate limiting
      const clientIP = getClientIP(request);
      const isAllowed = await rateLimiters.api.consume(env.AUTH_DB_BINDING, subdomain, clientIP);
      if (!isAllowed) {
        return createErrorResponse('Too many webhook requests. Please try again later.', 429, corsHeaders);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Check if Stripe is configured
      if (!env?.STRIPE_SECRET_KEY) {
        return createErrorResponse('Stripe integration not configured', 503, corsHeaders);
      }

      // Get webhook secret from environment variable
      const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return createErrorResponse('Stripe webhook secret not configured', 500, corsHeaders);
      }

      // Get the raw body for signature verification
      const rawBody = await request.text();
      
      // Verify webhook signature
      const signature = request.headers.get('Stripe-Signature');
      if (!signature) {
        return createErrorResponse('Stripe signature missing', 400, corsHeaders);
      }

      // Initialize Stripe for signature verification
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16',
      });

      let event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch (err: any) {
        console.error('[WEBHOOK] Signature verification failed:', err.message);
        return createErrorResponse('Invalid Stripe signature', 400, corsHeaders);
      }

      // Check if webhook has already been processed (idempotency)
      if (await isWebhookProcessed(env.AUTH_DB_BINDING, subdomain, event.id)) {
        console.log(`[WEBHOOK] Event ${event.id} already processed, skipping`);
        return new Response(JSON.stringify({
          success: true,
          message: 'Webhook already processed'
        }), {
          status: 200,
          headers: corsHeaders
        });
      }

      console.log(`[WEBHOOK] Processing event ${event.id} of type ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(env.AUTH_DB_BINDING, subdomain, event.data.object, stripe);
          break;
          
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await handleSubscriptionEvent(env.AUTH_DB_BINDING, subdomain, event.data.object);
          break;
          
        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(env.AUTH_DB_BINDING, subdomain, event.data.object);
          break;
          
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(env.AUTH_DB_BINDING, subdomain, event.data.object);
          break;
          
        default:
          console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
      }

      // Mark webhook as processed
      await markWebhookProcessed(env.AUTH_DB_BINDING, subdomain, event.id, event.type);

      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook processed successfully'
      }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (error: any) {
      console.error('[WEBHOOK] Error:', error);
      return handleApiError(error, corsHeaders);
    }
  }
};

export default {
  /**
   * Main request handler for the authentication service
   * 
   * @param request - The incoming HTTP request
   * @param env - Cloudflare Workers environment variables
   * @param ctx - Cloudflare Workers execution context
   * @returns HTTP response with authentication data or error
   */
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Extract domain from the request for table routing
    const domain = url.hostname;
    const subdomain = domain.split('.')[0];
    
    // CORS headers for cross-origin requests
    const corsHeaders = await getSecureCorsHeaders(request, env);

    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      return await handlePreflight(request, env);
    }

    try {
      // Check if endpoint exists and method is allowed
      const endpoint = ENDPOINTS[path as keyof typeof ENDPOINTS];
      if (!endpoint) {
        return createErrorResponse('Endpoint not found', 404, corsHeaders);
      }

      const handlerName = endpoint[method as keyof typeof endpoint];
      if (!handlerName) {
        return createErrorResponse('Method not allowed', 405, corsHeaders);
      }

      // Call the appropriate handler
      const handler = handlers[handlerName as keyof typeof handlers] as HandlerMethod;
      if (typeof handler !== 'function') {
        return createErrorResponse('Handler not found', 500, corsHeaders);
      }

      return await handler(request, subdomain, corsHeaders, env);

    } catch (error: any) {
      return handleApiError(error, corsHeaders);
    }
  }
};