.PHONY: help install install-browsers dev build start lint lint-fix format format-check typecheck test test-watch test-coverage test-e2e test-e2e-ui ci db-migrate db-seed ingest-fred ingest-imf ingest-markets setup

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install npm dependencies
	npm install

install-browsers: ## Download Playwright Chromium (required once for e2e)
	npm run playwright:install

dev: ## Start Next.js dev server
	npm run dev

build: ## Production build
	npm run build

start: ## Start production server
	npm run start

lint: ## Run ESLint
	npm run lint

lint-fix: ## Auto-fix ESLint issues
	npm run lint:fix

format: ## Format code with Prettier
	npm run format

format-check: ## Check Prettier formatting
	npm run format:check

typecheck: ## TypeScript typecheck
	npm run typecheck

test: ## Run unit tests
	npm run test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage
	npm run test:coverage

test-e2e: ## Run Playwright e2e tests
	npm run test:e2e

test-e2e-ui: ## Open Playwright UI mode
	npm run test:e2e:ui

ci: ## Full local CI (lint, format, types, unit, build, e2e)
	npm run ci

db-migrate: ## Apply Turso schema
	npm run db:migrate

db-seed: ## Seed countries, indicators, assets
	npm run db:seed

ingest-fred: ## Fetch US macro series from FRED into Turso
	npm run ingest:fred

ingest-imf: ## Fetch cross-country macro from IMF into Turso
	npm run ingest:imf

ingest-markets: ## Fetch daily asset prices from Yahoo Finance into Turso
	npm run ingest:markets

setup: install install-browsers db-migrate db-seed ## Install deps + browsers + migrate + seed
