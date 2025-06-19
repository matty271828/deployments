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
 */

// Type for handler methods
type HandlerMethod = (request: Request, env: any, subdomain: string, corsHeaders: any) => Promise<Response>;

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
function createErrorResponse(error: string, code: string, status: number, corsHeaders: any): Response {
  return new Response(JSON.stringify({ 
    success: false, 
    error: error,
    code: code
  }), {
    status: status,
    headers: corsHeaders
  });
}

// Handler implementations
const handlers = {
  /**
   * Health check endpoint - returns service status and domain info
   */
  async healthCheck(request: Request, env: any, subdomain: string, corsHeaders: any): Promise<Response> {
    return new Response(JSON.stringify({ 
      status: 'OK', 
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
  async signup(request: Request, env: any, subdomain: string, corsHeaders: any): Promise<Response> {
    // TODO: Implement user signup with email/password validation
    return createErrorResponse('Not implemented yet', 'NOT_IMPLEMENTED', 501, corsHeaders);
  },

  /**
   * User authentication endpoint
   */
  async login(request: Request, env: any, subdomain: string, corsHeaders: any): Promise<Response> {
    // TODO: Implement user login with credential validation
    return createErrorResponse('Not implemented yet', 'NOT_IMPLEMENTED', 501, corsHeaders);
  },

  /**
   * Session validation endpoint
   */
  async validateSession(request: Request, env: any, subdomain: string, corsHeaders: any): Promise<Response> {
    // TODO: Implement session validation using Authorization header
    return createErrorResponse('Not implemented yet', 'NOT_IMPLEMENTED', 501, corsHeaders);
  },

  /**
   * Session termination endpoint
   */
  async logout(request: Request, env: any, subdomain: string, corsHeaders: any): Promise<Response> {
    // TODO: Implement session invalidation
    return createErrorResponse('Not implemented yet', 'NOT_IMPLEMENTED', 501, corsHeaders);
  },

  /**
   * Session refresh endpoint
   */
  async refreshSession(request: Request, env: any, subdomain: string, corsHeaders: any): Promise<Response> {
    // TODO: Implement session token refresh
    return createErrorResponse('Not implemented yet', 'NOT_IMPLEMENTED', 501, corsHeaders);
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

    try {
      // Check if endpoint exists and method is allowed
      const endpoint = ENDPOINTS[path as keyof typeof ENDPOINTS];
      if (!endpoint) {
        return createErrorResponse('Endpoint not found', 'NOT_FOUND', 404, corsHeaders);
      }

      const handlerName = endpoint[method as keyof typeof endpoint];
      if (!handlerName) {
        return createErrorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405, corsHeaders);
      }

      // Call the appropriate handler
      const handler = handlers[handlerName as keyof typeof handlers] as HandlerMethod;
      if (typeof handler !== 'function') {
        return createErrorResponse('Handler not found', 'INTERNAL_ERROR', 500, corsHeaders);
      }

      return await handler(request, env, subdomain, corsHeaders);

    } catch (error: any) {
      return createErrorResponse('Internal server error', 'INTERNAL_ERROR', 500, corsHeaders);
    }
  }
};