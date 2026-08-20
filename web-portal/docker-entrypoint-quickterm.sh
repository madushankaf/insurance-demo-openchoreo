#!/bin/sh
# Wires the portal to quote-service and policy-service at container start, so one
# image works in every environment. Runs before nginx boots.
#
# Contract: pass a service BASE url, no /api/v1 and no trailing slash, e.g.
#   http://quote-service:8081
#   http://development-default.openchoreoapis.localhost:19080/quote-service-quotes-api
# The /api/v1 suffix is appended here, identically in both modes below.
#
# Each service is wired independently, by this order of preference:
#   1. PUBLIC_<X>_SERVICE_URL set  -> browser-direct: the browser calls the
#      service itself. The url only has to resolve from the user's machine.
#   2. <X>_SERVICE_URL resolves in this container -> reverse-proxy through nginx.
#   3. <X>_SERVICE_URL does NOT resolve here -> browser-direct with that same
#      url. An address this container cannot resolve but that was handed to us
#      on purpose is almost always an external gateway url, which is precisely
#      what the browser can reach. Proxying it would be a guaranteed 502.
#   4. nothing set -> a 502 stub that says so.
#
# Browser-direct needs CORS on the service; both allow * (see cors() in main.go).
set -e
ME=$(basename "$0")
# stderr, so it never pollutes the base url that wire() echoes on stdout.
log() { echo "$ME: $*" >&2; }

CONFIG_JS=/usr/share/nginx/html/config.js
PROXY_CONF=/etc/nginx/api-proxy.conf

strip() { printf '%s' "$1" | sed 's:/*$::'; }

# Host part of a url, minus scheme, userinfo, port and path.
host_of() {
  printf '%s' "$1" | sed -e 's|^[a-zA-Z][a-zA-Z0-9+.-]*://||' -e 's|[/?#].*$||' \
                         -e 's|^.*@||' -e 's|:[0-9]*$||' -e 's|^\[\(.*\)\]$|\1|'
}

resolves() {
  case "$1" in
    *[!0-9.]*) ;;      # not a bare IPv4 literal, so look it up
    *) return 0 ;;
  esac
  getent hosts "$1" >/dev/null 2>&1 && return 0
  nslookup "$1" >/dev/null 2>&1 && return 0
  return 1
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

# wire <prefix> <name> <var> ; echoes the browser-facing base url, or nothing
# when the service is reverse-proxied (the SPA then uses <prefix> same-origin).
wire() {
  prefix=$1 name=$2 var=$3
  internal=$(strip "$(eval "printf '%s' \"\${$var:-}\"")")
  public=$(strip "$(eval "printf '%s' \"\${PUBLIC_$var:-}\"")")

  if [ -n "$public" ]; then
    log "$name: browser-direct via PUBLIC_$var -> $public/api/v1"
    printf '%s' "$public/api/v1"
    return
  fi

  if [ -z "$internal" ]; then
    log "WARNING: $name has neither $var nor PUBLIC_$var set"
    stub "$prefix" "$name is not configured. Set $var (reachable from the portal container) or PUBLIC_$var (reachable from the browser)."
    return
  fi

  h=$(host_of "$internal")
  if resolves "$h"; then
    log "$name: reverse-proxy $prefix -> $internal/api/v1/"
    cat >> "$PROXY_CONF" <<EOF
location $prefix {
  proxy_pass $internal/api/v1/;
  proxy_http_version 1.1;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
}
EOF
    return
  fi

  log "$name: host $h does not resolve in this container, so it cannot be"
  log "  proxied. Treating $var as a browser-reachable address instead."
  log "  $name: browser-direct -> $internal/api/v1"
  printf '%s' "$internal/api/v1"
}

: > "$PROXY_CONF"
QUOTE_BASE=$(wire /api/quote/  quote-service  QUOTE_SERVICE_URL)
POLICY_BASE=$(wire /api/policy/ policy-service POLICY_SERVICE_URL)

# Empty base -> src/config.ts falls back to the same-origin proxy prefix.
{
  echo "// Generated at container start by $ME. Do not edit."
  echo "window.__CONFIG__ = {"
  [ -n "$QUOTE_BASE" ]  && echo "  quoteServiceUrl: \"$QUOTE_BASE\","
  [ -n "$POLICY_BASE" ] && echo "  policyServiceUrl: \"$POLICY_BASE\","
  echo "};"
} > "$CONFIG_JS"

# Last resort: never let a bad generation crash-loop the container. Serving the
# SPA with dead API routes is far easier to diagnose than CrashLoopBackOff.
if ! nginx -t >/dev/null 2>&1; then
  log "ERROR: generated $PROXY_CONF is invalid; dropping it so nginx can still start"
  nginx -t 2>&1 | sed "s/^/$ME:   /"
  echo "# dropped: generated config was invalid" > "$PROXY_CONF"
fi
