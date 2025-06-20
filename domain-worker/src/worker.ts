/// <reference types="@cloudflare/workers-types" />

export default {
  async fetch(request: Request): Promise<Response> {
    const base = "https://example.com";
    const statusCode = 301;

    const source = new URL(request.url);
    const destination = new URL(source.pathname, base);
    return Response.redirect(destination.toString(), statusCode);
  },
};