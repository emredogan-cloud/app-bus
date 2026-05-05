# syntax=docker/dockerfile:1.7
# ---- Builder ---------------------------------------------------------------
FROM golang:1.23-bookworm AS builder
WORKDIR /src

ENV CGO_ENABLED=0 \
    GOOS=linux

COPY go.mod ./
RUN go mod download

COPY . .

ARG VERSION=dev
RUN go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" \
    -o /out/ingestion ./cmd/ingestion

# ---- Runtime ---------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /

COPY --from=builder /out/ingestion /ingestion

USER nonroot:nonroot
EXPOSE 8080 9090
ENTRYPOINT ["/ingestion"]
