FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine

# Service URLs are wired at container start, never baked into the bundle, so one
# image works in every environment. See docker-entrypoint-quickterm.sh for the
# two modes (reverse-proxy vs browser-direct) and which var to set for each.
ENV QUOTE_SERVICE_URL="http://quote-service:8081" \
    POLICY_SERVICE_URL="http://policy-service:8082"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint-quickterm.sh /docker-entrypoint.d/20-quickterm-config.sh
RUN chmod +x /docker-entrypoint.d/20-quickterm-config.sh \
    && touch /etc/nginx/api-proxy.conf

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
