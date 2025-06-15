export default {
  fetch(request: Request) {
    const url = new URL(request.url);
    
    // Check if this is a health check request
    if (url.pathname === '/auth/health') {
      return new Response('OK', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // For all other paths, redirect to leetrepeat.com
    const base = "https://leetrepeat.com/auth";
    const statusCode = 301;
    const destination = new URL(url.pathname, base);
    return Response.redirect(destination.toString(), statusCode);
  },
};