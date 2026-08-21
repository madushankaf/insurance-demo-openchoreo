FROM golang:1.22-alpine AS build
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o /quote-service .

FROM alpine:3.20
COPY --from=build /quote-service /quote-service
# Descriptors shipped alongside the binary for inspection at runtime.
COPY --from=build /app/openapi.yaml /app/workload.yaml /
EXPOSE 8081
ENTRYPOINT ["/quote-service"]
