SHELL := /bin/bash

GO ?= go
BIN := bin/ingestion
PKG := ./...

.PHONY: build test lint vet run docker clean tidy

build:
	$(GO) build -o $(BIN) ./cmd/ingestion

test:
	$(GO) test -race -count=1 -coverprofile=coverage.out $(PKG)

lint:
	$(GO) vet $(PKG)

vet: lint

run:
	$(GO) run ./cmd/ingestion

tidy:
	$(GO) mod tidy

docker:
	docker build -t app-bus/ingestion:dev .

clean:
	rm -rf bin coverage.out
