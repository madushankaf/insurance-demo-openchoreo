FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine

# Upstreams are resolved at container start, not at build time, so one image
# works in every environment. Only these two names are substituted into the
# template; nginx's own $uri/$host/$scheme variables are left intact.
ENV NGINX_ENVSUBST_FILTER="^(QUOTE|POLICY)_SERVICE_URL$" \
    QUOTE_SERVICE_URL="http://quote-service:8081" \
    POLICY_SERVICE_URL="http://policy-service:8082"

# Runs before the template substitution and tolerates a trailing slash on either URL.
COPY docker-entrypoint-normalize-urls.envsh /docker-entrypoint.d/05-normalize-urls.envsh
RUN chmod +x /docker-entrypoint.d/05-normalize-urls.envsh

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
