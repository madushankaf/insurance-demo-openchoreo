// Runtime configuration, loaded before the app bundle and never cached.
// Empty by default: src/config.ts falls back to the same-origin /api/quote and
// /api/policy prefixes that nginx proxies to the real services. Set these only
// to bypass the proxy and have the browser call a service URL directly (which
// then requires that service to be externally visible and CORS-enabled).
window.__CONFIG__ = {
  // quoteServiceUrl: "https://quote-service.example.com",
  // policyServiceUrl: "https://policy-service.example.com",
};
