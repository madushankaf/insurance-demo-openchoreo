interface RuntimeConfig {
  quoteServiceUrl: string;
  policyServiceUrl: string;
}

declare global {
  interface Window {
    __CONFIG__?: Partial<RuntimeConfig>;
  }
}

const cfg = window.__CONFIG__ ?? {};

// Same-origin paths by default: nginx (prod) and the Vite dev server both
// reverse-proxy these prefixes to the real services, so the browser never
// needs to know a service hostname and no CORS preflight is involved.
// Override via window.__CONFIG__ in /config.js to call a service directly.
export const QUOTE_SERVICE_URL = cfg.quoteServiceUrl ?? "/api/quote";
export const POLICY_SERVICE_URL = cfg.policyServiceUrl ?? "/api/policy";
