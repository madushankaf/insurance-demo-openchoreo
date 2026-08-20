// Placeholder only. At container start, /docker-entrypoint.d/20-quickterm-config.sh
// overwrites this file with the runtime values (see docker-entrypoint-quickterm.sh).
// An empty object makes src/config.ts fall back to the same-origin /api/quote and
// /api/policy prefixes that nginx reverse-proxies.
window.__CONFIG__ = {};
