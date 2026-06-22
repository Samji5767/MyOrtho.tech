# MyOrtho.tech — developer & operator command surface
# Run `make help` for the full list.

COMPOSE := docker compose
SHELL := /bin/bash

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---------- Setup ----------
.PHONY: setup
setup: ## First-time setup: create .env and pull/build images
	@bash scripts/setup.sh

.PHONY: env
env: ## Create .env from template if it doesn't exist
	@test -f .env || (cp .env.example .env && echo "Created .env from template — edit your secrets.")

# ---------- Lifecycle ----------
.PHONY: up
up: env ## Build and start the full stack in the background
	$(COMPOSE) up -d --build

.PHONY: down
down: ## Stop and remove all containers
	$(COMPOSE) down

.PHONY: restart
restart: down up ## Restart the full stack

.PHONY: logs
logs: ## Tail logs for all services (Ctrl-C to exit)
	$(COMPOSE) logs -f

.PHONY: ps
ps: ## Show running containers
	$(COMPOSE) ps

# ---------- Health & quality ----------
.PHONY: health
health: ## Check that every service is responding
	@bash scripts/health-check.sh

.PHONY: lint
lint: ## Lint frontend and backend
	cd frontend && npm run lint
	cd backend && npm run build --dry-run || true

.PHONY: build
build: ## Build all service images without starting them
	$(COMPOSE) build

# ---------- Database ----------
.PHONY: db-shell
db-shell: ## Open a psql shell into the database container
	$(COMPOSE) exec database psql -U $${POSTGRES_USER:-myortho_admin} -d $${POSTGRES_DB:-myortho_tech}

# ---------- Cleanup ----------
.PHONY: clean
clean: ## Stop stack and remove volumes (DESTROYS local data)
	$(COMPOSE) down -v
