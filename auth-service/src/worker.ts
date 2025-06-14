interface Env {
  // We'll add environment variables here later
}

addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  
  // Health check endpoint
  if (url.pathname === '/health') {
    return new Response('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }

  // Handle unknown routes
  return new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
} 