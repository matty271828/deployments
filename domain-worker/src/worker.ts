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
    
    // Handle OPTIONS for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    // Example of how to use the database binding:
    // if (env?.DOMAIN_DB) {
    //   const result = await env.DOMAIN_DB.prepare('SELECT * FROM your_table').all();
    //   // Process the result...
    // }
    
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