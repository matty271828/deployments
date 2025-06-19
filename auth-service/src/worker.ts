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
 */

import { createUser } from './users';
import { createSession, deleteSession, validateSessionToken } from './sessions';
import { SignupRequest, LoginRequest } from './types';
import { rateLimiters, getClientIP } from './rate-limiter';
import { performCleanup, shouldRunCleanup } from './cleanup';

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
      const { email, password, firstName, lastName } = body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        return createErrorResponse('Email, password, firstName, and lastName are required', 400, corsHeaders);
      }

      // Validate email and password types
      if (typeof email !== 'string' || typeof password !== 'string' || 
          typeof firstName !== 'string' || typeof lastName !== 'string') {
        return createErrorResponse('All fields must be strings', 400, corsHeaders);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Create user
      const user = await createUser(env.AUTH_DB_BINDING, subdomain, email, password, firstName, lastName);

      // Create session for the new user
      const session = await createSession(env.AUTH_DB_BINDING, subdomain, user.id);

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
        }
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
      const { email, password } = body;

      // Validate required fields
      if (!email || !password) {
        return createErrorResponse('Email and password are required', 400, corsHeaders);
      }

      // Validate email and password types
      if (typeof email !== 'string' || typeof password !== 'string') {
        return createErrorResponse('Email and password must be strings', 400, corsHeaders);
      }

      // Ensure we have database access
      if (!env?.AUTH_DB_BINDING) {
        return createErrorResponse('Database not available', 500, corsHeaders);
      }

      // Import validateCredentials function
      const { validateCredentials } = await import('./users');

      // Validate credentials
      const user = await validateCredentials(env.AUTH_DB_BINDING, subdomain, email, password);
      if (!user) {
        return createErrorResponse('Invalid email or password', 401, corsHeaders);
      }

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

      // Validate the session token
      const session = await validateSessionToken(env.AUTH_DB_BINDING, subdomain, token);
      if (!session) {
        return createErrorResponse('Invalid or expired session', 401, corsHeaders);
      }

      // Import getUserById function
      const { getUserById } = await import('./users');

      // Get user information
      const user = await getUserById(env.AUTH_DB_BINDING, subdomain, session.userId);
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
          id: session.id,
          createdAt: session.createdAt,
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
        return createErrorResponse('Invalid session token format', 400, corsHeaders);
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
      const currentSession = await validateSessionToken(env.AUTH_DB_BINDING, subdomain, token);
      if (!currentSession) {
        return createErrorResponse('Invalid or expired session', 401, corsHeaders);
      }

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
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight requests
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Run automated cleanup in the background (non-blocking)
    if (env?.AUTH_DB_BINDING) {
      ctx.waitUntil(
        (async () => {
          try {
            const shouldRun = await shouldRunCleanup(env.AUTH_DB_BINDING);
            if (shouldRun) {
              await performCleanup(env.AUTH_DB_BINDING);
            }
          } catch (error) {
            console.error('Background cleanup error:', error);
          }
        })()
      );
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