/// <reference types="@cloudflare/workers-types" />

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        domain: request.headers.get('host'),
        worker: 'domain-worker'
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
    
    // Default behavior: redirect to base URL
    const base = "https://example.com";
    const statusCode = 301;

    const source = new URL(request.url);
    const destination = new URL(source.pathname, base);
    return Response.redirect(destination.toString(), statusCode);
  },
};