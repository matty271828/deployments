addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // Health check endpoint
  if (url.pathname === '/auth/health') {
    return new Response('Auth Service is Healthy!', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }

  // Handle unknown routes
  return new Response('Auth-Service: Route Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
} 