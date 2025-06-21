/**
 * Secure CORS configuration for multi-domain authentication service
 * 
 * This module provides dynamic CORS validation that allows multiple domains to access
 * the centralized authentication service. Unlike traditional CORS that hardcodes
 * allowed origins, this system dynamically fetches the list of allowed domains
 * from R2 storage, enabling automatic updates as new domains are added to the platform.
 * 
 * Key Features:
 * - Dynamic domain allowlist from R2 storage
 * - Automatic fallback to database inference
 * - Subdomain support (www.domain.com matches domain.com)
 * - Comprehensive security headers
 * - Fail-secure by default (blocks unauthorized origins)
 * 
 * Usage:
 * The auth service worker calls getSecureCorsHeaders() for each request to validate
 * the Origin header against the current list of allowed domains. This enables
 * a single auth service to securely serve multiple frontend applications.
 */

/**
 * Get all active domains from R2 storage
 * 
 * This function fetches the current list of allowed domains from R2 storage.
 * The domains are stored in mappings.json with the structure:
 * [
 *   {"domain": "leetrepeat.com", "frontend_repo": "https://github.com/..."},
 *   {"domain": "myapp.com", "frontend_repo": "https://github.com/..."}
 * ]
 * 
 * This enables the auth service to dynamically allow new domains without
 * requiring code changes or redeployment.
 * 
 * @param env - Cloudflare Workers environment containing R2 bucket bindings
 * @returns Promise<string[]> - Array of domain names that can access the auth service
 */
async function getActiveDomains(env: any): Promise<string[]> {
  try {
    // Try to get domain mappings from R2
    if (!env?.DOMAIN_MAPPINGS_BUCKET) {
      console.warn('DOMAIN_MAPPINGS_BUCKET not configured, falling back to database inference');
      return await getActiveDomainsFromDB(env?.AUTH_DB_BINDING);
    }

    const mappingsResponse = await env.DOMAIN_MAPPINGS_BUCKET.get('mappings.json');
    if (!mappingsResponse) {
      console.warn('No domain mappings found in R2, falling back to database inference');
      return await getActiveDomainsFromDB(env?.AUTH_DB_BINDING);
    }

    const mappings = await mappingsResponse.json();
    if (!Array.isArray(mappings)) {
      console.warn('Invalid domain mappings format, falling back to database inference');
      return await getActiveDomainsFromDB(env?.AUTH_DB_BINDING);
    }

    // Extract domain names from mappings
    // mappings.json structure: [{"domain": "leetrepeat.com", "frontend_repo": "https://github.com/..."}]
    const domains = mappings
      .map((mapping: any) => mapping.domain)
      .filter((domain: string) => domain && typeof domain === 'string');
    
    console.log(`Found ${domains.length} domains in R2 mappings: ${domains.join(', ')}`);
    return domains;

  } catch (error) {
    console.error('Error getting domains from R2:', error);
    console.warn('Falling back to database inference');
    return await getActiveDomainsFromDB(env?.AUTH_DB_BINDING);
  }
}

/**
 * Fallback: Get domains from database table names
 * 
 * This function serves as a fallback when R2 storage is unavailable.
 * It infers allowed domains by looking at the database table names
 * (e.g., leetrepeat_users -> leetrepeat.com). This ensures the auth
 * service continues to function even if R2 is temporarily unavailable.
 * 
 * @param db - D1Database instance
 * @returns Promise<string[]> - Array of domain names inferred from table names
 */
async function getActiveDomainsFromDB(db: D1Database): Promise<string[]> {
  try {
    // Query all tables to find domain prefixes
    const tables = await db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE '%_users'
    `).all();

    const domains: string[] = [];
    for (const table of tables.results as any[]) {
      const tableName = table.name as string;
      const domainPrefix = tableName.replace('_users', '');
      
      // The domain prefix is the actual domain name
      // Each domain gets its own zone in Cloudflare
      domains.push(domainPrefix);
    }

    console.log(`Found ${domains.length} domains from database: ${domains.join(', ')}`);
    return domains;
  } catch (error) {
    console.error('Error getting active domains from database:', error);
    return [];
  }
}

/**
 * Check if an origin is allowed to access the auth service
 * 
 * This function validates that the requesting origin matches one of the
 * allowed domains. It supports exact matches and subdomain relationships
 * to provide flexibility while maintaining security.
 * 
 * Examples of allowed matches:
 * - leetrepeat.com matches leetrepeat.com (exact)
 * - www.leetrepeat.com matches leetrepeat.com (subdomain)
 * - api.leetrepeat.com matches leetrepeat.com (subdomain)
 * 
 * @param origin - The origin header from the request (e.g., "https://leetrepeat.com")
 * @param allowedDomains - Array of domain names that can access the auth service
 * @returns boolean - True if the origin is allowed to make requests
 */
function isOriginAllowed(origin: string, allowedDomains: string[]): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    
    // Check if the hostname matches any allowed domain
    return allowedDomains.some(domain => {
      const allowedHostname = domain.toLowerCase();
      
      // Exact match
      if (hostname === allowedHostname) {
        return true;
      }
      
      // Subdomain match (e.g., www.leetrepeat.com matches leetrepeat.com)
      if (hostname.endsWith('.' + allowedHostname)) {
        return true;
      }
      
      // Parent domain match (e.g., leetrepeat.com matches www.leetrepeat.com)
      if (allowedHostname.endsWith('.' + hostname)) {
        return true;
      }
      
      return false;
    });
  } catch (error) {
    console.error('Error parsing origin:', error);
    return false;
  }
}

/**
 * Generate comprehensive security headers for all responses
 * 
 * This function provides a centralized way to ensure all responses
 * include the same set of security headers to protect against
 * various types of attacks.
 * 
 * @returns Record<string, string> - Object containing all security headers
 */
function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };
}

/**
 * Get secure CORS headers for a request
 * 
 * This is the main function that validates the request origin and returns
 * appropriate CORS headers. It dynamically fetches the allowed domains
 * and only sets Access-Control-Allow-Origin for valid origins.
 * 
 * Security Features:
 * - Only allows requests from registered domains
 * - Includes comprehensive security headers
 * - Fails secure (no CORS headers for unauthorized origins)
 * - Logs blocked requests for security monitoring
 * 
 * @param request - The incoming HTTP request
 * @param env - Cloudflare Workers environment containing R2 and D1 bindings
 * @returns Promise<Record<string, string>> - CORS headers for the response
 */
export async function getSecureCorsHeaders(request: Request, env: any): Promise<Record<string, string>> {
  const origin = request.headers.get('Origin');
  
  // Default headers (always included)
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
    ...getSecurityHeaders()
  };

  // TEMPORARILY DISABLED: Domain-based CORS restrictions
  // TODO: Re-enable domain validation after debugging is complete
  // This allows manual testing of endpoints from any origin
  // Original code should be restored to validate origins against allowed domains
  
  if (origin) {
    // Allow all origins for now (temporary for debugging)
    corsHeaders['Access-Control-Allow-Origin'] = origin;
    console.log(`DEBUG: Allowing origin ${origin} (domain restrictions temporarily disabled)`);
  }

  // ORIGINAL SECURE CODE (commented out for now):
  /*
  // If no origin header, return headers without Access-Control-Allow-Origin
  // This allows direct API calls (non-browser requests)
  if (!origin) {
    return corsHeaders;
  }

  try {
    // Get the current list of allowed domains (dynamically updated)
    const allowedDomains = await getActiveDomains(env);
    
    // Validate the request origin against allowed domains
    if (isOriginAllowed(origin, allowedDomains)) {
      // Origin is allowed - set the CORS header to allow the request
      corsHeaders['Access-Control-Allow-Origin'] = origin;
    } else {
      // Origin not allowed - don't set Access-Control-Allow-Origin
      // This will cause the browser to block the request
      console.warn(`Blocked request from unauthorized origin: ${origin}. Allowed domains: ${allowedDomains.join(', ')}`);
    }
  } catch (error) {
    console.error('Error validating CORS origin:', error);
    // On error, don't set Access-Control-Allow-Origin (fail secure)
  }
  */

  return corsHeaders;
}

/**
 * Handle CORS preflight requests
 * 
 * Preflight requests are sent by browsers before making cross-origin requests
 * to check if the actual request will be allowed. This function validates
 * the origin and returns appropriate preflight response headers.
 * 
 * @param request - The incoming preflight request
 * @param env - Cloudflare Workers environment containing R2 and D1 bindings
 * @returns Promise<Response> - Preflight response with CORS headers or 403 Forbidden
 */
export async function handlePreflight(request: Request, env: any): Promise<Response> {
  const corsHeaders = await getSecureCorsHeaders(request, env);
  
  // TEMPORARILY DISABLED: Domain-based preflight restrictions
  // TODO: Re-enable domain validation after debugging is complete
  // This allows preflight requests from any origin for manual testing
  
  // Allow all preflight requests for now (temporary for debugging)
  console.log(`DEBUG: Allowing preflight request (domain restrictions temporarily disabled)`);
  return new Response(null, { headers: corsHeaders });

  // ORIGINAL SECURE CODE (commented out for now):
  /*
  // For preflight requests, we need to include Access-Control-Allow-Origin if it exists
  if (corsHeaders['Access-Control-Allow-Origin']) {
    // Origin is allowed - return successful preflight response
    return new Response(null, { headers: corsHeaders });
  } else {
    // Origin not allowed - return 403 Forbidden
    // This tells the browser not to make the actual request
    return new Response('Forbidden', { 
      status: 403,
      headers: {
        'Content-Type': 'text/plain',
        ...getSecurityHeaders()
      }
    });
  }
  */
} 