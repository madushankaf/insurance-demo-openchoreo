FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o /policy-service .

FROM alpine:3.20
COPY --from=build /policy-service /policy-service
EXPOSE 8082
ENTRYPOINT ["/policy-service"]
