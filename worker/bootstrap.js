// Public-only bridge from Cloudflare static assets to a script-backed Worker.
// Authentication and personal-data routes are intentionally disabled until the
// audited owner-only application replaces this bootstrap.
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/") || pathname.startsWith("/auth/") || pathname === "/app" || pathname.startsWith("/app/")) {
      return new Response("Not found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
    return env.ASSETS.fetch(request);
  }
};
