/// <reference types="@cloudflare/workers-types" />

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle health check endpoint
    if (url.pathname === '/backend/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        domain: request.headers.get('host'),
        worker: 'domain-worker',
        // Example of how to access the bindings:
        // database_available: !!env?.DOMAIN_DB,
        // auth_service_available: !!env?.AUTH_SERVICE
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // Handle GraphQL endpoint - ONLY from auth service
    if (url.pathname === '/graphql') {
      console.log(`[DOMAIN WORKER DEBUG] GraphQL request received`);
      
      // Check if this request is coming from the auth service
      // We can check the request headers or use a secret token
      const authHeader = request.headers.get('X-Auth-Service-Token');
      const forwardedBy = request.headers.get('X-Forwarded-By');
      const userId = request.headers.get('X-User-ID');
      
      console.log(`[DOMAIN WORKER DEBUG] Headers received:`, {
        'X-Auth-Service-Token': authHeader,
        'X-Forwarded-By': forwardedBy,
        'X-User-ID': userId
      });
      
      const isFromAuthService = authHeader === 'trusted-auth-service' || 
                               forwardedBy === 'auth-service';
      
      console.log(`[DOMAIN WORKER DEBUG] Is from auth service: ${isFromAuthService}`);
      
      if (!isFromAuthService) {
        console.log(`[DOMAIN WORKER DEBUG] Unauthorized - not from auth service`);
        return new Response(JSON.stringify({ 
          error: 'Unauthorized - GraphQL endpoint only accessible via auth service' 
        }), { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      try {
        console.log(`[DOMAIN WORKER DEBUG] Creating GraphQL context with user_id: ${userId}`);
        
        // Dynamic imports to handle missing dependencies gracefully
        const { createYoga } = await import('graphql-yoga');
        const { schema, createContext } = await import('./generated-graphql');
        
        const yoga = createYoga({ 
          schema,
          context: () => createContext(request, env),
          graphiql: false, // Disable GraphQL Playground for security
          landingPage: false
        });
        
        console.log(`[DOMAIN WORKER DEBUG] GraphQL yoga created, processing request`);
        return yoga(request);
      } catch (error: any) {
        console.error(`[DOMAIN WORKER DEBUG] GraphQL error:`, error);
        return new Response(JSON.stringify({ 
          error: 'GraphQL not available', 
          details: error.message 
        }), { 
          status: 503, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
    }
    
    // Handle OPTIONS for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-User-ID, X-Auth-Service-Token'
        }
      });
    }
    
    // Example of how to use the auth service binding:
    // if (env?.AUTH_SERVICE) {
    //   const authResponse = await env.AUTH_SERVICE.fetch('https://auth-service.your-domain.com/auth/validate', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ token: 'user-token' })
    //   });
    //   // Process the auth response...
    // }
    
    // Default behavior: redirect to base URL
    const base = "https://example.com";
    const statusCode = 301;

    const source = new URL(request.url);
    const destination = new URL(source.pathname, base);
    return Response.redirect(destination.toString(), statusCode);
  },
};