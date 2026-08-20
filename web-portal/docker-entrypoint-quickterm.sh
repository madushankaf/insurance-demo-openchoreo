#!/bin/sh
# Wires the portal to quote-service and policy-service at container start, so one
# image works in every environment. Runs before nginx boots.
#
# Contract: pass a service BASE url with no /api/v1 and no trailing slash, e.g.
#   http://quote-service:8081
#   http://development-default.openchoreoapis.localhost:19080/quote-service-quotes-api
# The /api/v1 suffix is appended here, identically in both modes below.
#
# Two modes:
#   browser-direct  PUBLIC_QUOTE_SERVICE_URL + PUBLIC_POLICY_SERVICE_URL set.
#                   The browser calls the services itself, so the urls only need
#                   to resolve from the user's machine. Use this for an external
#                   gateway address. Requires CORS on the services (they allow *).
#   reverse-proxy   QUOTE_SERVICE_URL + POLICY_SERVICE_URL set. nginx proxies
#                   /api/quote/* and /api/policy/*, so the urls must resolve
#                   from INSIDE this container -- a cluster-internal address.
set -e
ME=$(basename "$0")
log() { echo "$ME: $*"; }

CONFIG_JS=/usr/share/nginx/html/config.js
PROXY_CONF=/etc/nginx/api-proxy.conf

strip() { printf '%s' "$1" | sed 's:/*$::'; }
QUOTE=$(strip "${QUOTE_SERVICE_URL:-}")
POLICY=$(strip "${POLICY_SERVICE_URL:-}")
PUB_QUOTE=$(strip "${PUBLIC_QUOTE_SERVICE_URL:-}")
PUB_POLICY=$(strip "${PUBLIC_POLICY_SERVICE_URL:-}")

if [ -n "$PUB_QUOTE" ] && [ -n "$PUB_POLICY" ]; then
  log "browser-direct mode: the SPA will call the services directly"
  log "  quote  -> $PUB_QUOTE/api/v1"
  log "  policy -> $PUB_POLICY/api/v1"
  cat > "$CONFIG_JS" <<EOF
// Generated at container start by $ME. Do not edit.
window.__CONFIG__ = {
  quoteServiceUrl: "$PUB_QUOTE/api/v1",
  policyServiceUrl: "$PUB_POLICY/api/v1",
};
EOF
  echo "# browser-direct mode: no reverse proxy needed." > "$PROXY_CONF"
  exit 0
fi

# Reverse-proxy mode: let src/config.ts fall back to the same-origin prefixes.
echo "// Generated at container start by $ME. Reverse-proxy mode." > "$CONFIG_JS"
echo "window.__CONFIG__ = {};" >> "$CONFIG_JS"
: > "$PROXY_CONF"

# Host part of a url, minus scheme, userinfo, port and path.
host_of() {
  printf '%s' "$1" | sed -e 's|^[a-zA-Z][a-zA-Z0-9+.-]*://||' -e 's|[/?#].*$||' \
                         -e 's|^.*@||' -e 's|:[0-9]*$||' -e 's|^\[\(.*\)\]$|\1|'
}

resolves() {
  case "$1" in
    # bare IPv4/IPv6 literals need no lookup
    *[!0-9.]*) ;;
    *) return 0 ;;
  esac
  getent hosts "$1" >/dev/null 2>&1 && return 0
  nslookup "$1" >/dev/null 2>&1 && return 0
  return 1
}

# Emit one proxy location, or a self-explaining 502 stub if it cannot work.
# The stub matters: a literal hostname in proxy_pass is resolved when nginx
# parses its config, so an unresolvable name is a fatal [emerg] that puts the
# container in a restart loop. We'd rather boot, serve the SPA, and say why.
emit() {
  prefix=$1 upstream=$2 name=$3 var=$4
  if [ -z "$upstream" ]; then
    log "WARNING: neither $var nor PUBLIC_$var is set; $name calls will fail"
    stub "$prefix" "$name is not configured. Set $var (cluster-internal url) or PUBLIC_$var (browser-reachable url)."
    return
  fi
  h=$(host_of "$upstream")
  if ! resolves "$h"; then
    log "WARNING: $var host '$h' does not resolve from inside this container."
    log "         If that is an external gateway address, set PUBLIC_$var instead"
    log "         so the browser calls it directly. Serving a 502 stub for $prefix."
    stub "$prefix" "Host $h does not resolve inside the portal container. If this is an external gateway address, set PUBLIC_$var instead of $var."
    return
  fi
  log "proxying $prefix -> $upstream/api/v1/"
  cat >> "$PROXY_CONF" <<EOF
location $prefix {
  proxy_pass $upstream/api/v1/;
  proxy_http_version 1.1;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
}
EOF
}

stub() {
  # Single quotes would terminate nginx's quoted string early, so drop them.
  msg=$(printf '%s' "$2" | tr -d "'")
  cat >> "$PROXY_CONF" <<EOF
location $1 {
  default_type application/json;
  return 502 '{"error":"$msg"}';
}
EOF
}

emit /api/quote/  "$QUOTE"  "quote-service"  QUOTE_SERVICE_URL
emit /api/policy/ "$POLICY" "policy-service" POLICY_SERVICE_URL

# Last resort: never let a bad generation crash-loop the container. Serving the
# SPA with dead API routes is far easier to diagnose than CrashLoopBackOff.
if ! nginx -t >/dev/null 2>&1; then
  log "ERROR: generated $PROXY_CONF is invalid; dropping it so nginx can still start"
  nginx -t 2>&1 | sed "s/^/$ME:   /"
  echo "# dropped: generated config was invalid" > "$PROXY_CONF"
fi
