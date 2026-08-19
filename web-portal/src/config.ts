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

export const QUOTE_SERVICE_URL =
  cfg.quoteServiceUrl ?? "http://localhost:8081";
export const POLICY_SERVICE_URL =
  cfg.policyServiceUrl ?? "http://localhost:8082";
