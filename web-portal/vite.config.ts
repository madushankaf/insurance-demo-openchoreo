import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Mirrors nginx.conf.template so the same relative /api/* paths work in dev.
// Trailing slashes are stripped for the same reason as in the container: they
// yield a `//` upstream path that Go's ServeMux answers with a 301.
const stripSlash = (u: string) => u.replace(/\/+$/, "");

const QUOTE_SERVICE_URL = stripSlash(
  process.env.QUOTE_SERVICE_URL ?? "http://localhost:8081"
);
const POLICY_SERVICE_URL = stripSlash(
  process.env.POLICY_SERVICE_URL ?? "http://localhost:8082"
);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      "/api/quote": {
        target: QUOTE_SERVICE_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/quote/, "/api/v1"),
      },
      "/api/policy": {
        target: POLICY_SERVICE_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/policy/, "/api/v1"),
      },
    },
  },
});
