FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o /quote-service .

FROM alpine:3.20
COPY --from=build /quote-service /quote-service
EXPOSE 8081
ENTRYPOINT ["/quote-service"]
