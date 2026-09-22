.DEFAULT_GOAL := help

.PHONY: help setup up down restart logs ps migrate seed test test-backend test-frontend lint typecheck build verify

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*##"; printf "Farah.event commands:\n"} /^[a-zA-Z_-]+:.*?##/ {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Create .env from .env.example when it does not exist
	@test -f .env || cp .env.example .env

up: ## Build and start all services
	docker compose up --build -d

down: ## Stop services without deleting persistent data
	docker compose down

restart: ## Restart application services
	docker compose restart backend frontend

logs: ## Follow application logs
	docker compose logs -f backend frontend

ps: ## Show service and health status
	docker compose ps

migrate: ## Apply Alembic migrations
	docker compose exec backend alembic upgrade head

seed: ## Load development-only sample data
	docker compose exec backend python -m app.database.seed

test: test-backend test-frontend lint typecheck ## Run the automated checks

test-backend: ## Run backend tests
	docker compose exec backend pytest

test-frontend: ## Run frontend tests
	docker compose exec frontend npm test

lint: ## Run frontend lint
	docker compose exec frontend npm run lint

typecheck: ## Run TypeScript type checking
	docker compose exec frontend npm run typecheck

build: ## Build production images
	docker compose build --no-cache backend frontend

verify: migrate test build ## Run migrations, tests, and production builds
