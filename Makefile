.PHONY: help build up down restart logs shell migrate backup status clean debug prod test lint

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

# Docker Compose
COMPOSE := docker-compose
DC_FILE := docker-compose.yml
BACKEND := schichtplan-backend
FRONTEND := schichtplan-frontend
DB := schichtplan-postgres
REDIS := schichtplan-redis

help:
	@echo "$(BLUE)Schichtplan Docker Makefile$(NC)"
	@echo ""
	@echo "$(GREEN)Build Commands:$(NC)"
	@echo "  make build          Build all Docker images"
	@echo "  make rebuild        Rebuild images without cache"
	@echo ""
	@echo "$(GREEN)Runtime Commands:$(NC)"
	@echo "  make up             Start all services"
	@echo "  make down           Stop all services"
	@echo "  make restart        Restart all services"
	@echo "  make restart-svc    Restart specific service (args: SVC=backend)"
	@echo "  make logs           View all service logs"
	@echo "  make logs-svc       View specific service logs (args: SVC=backend)"
	@echo "  make status         Show service status"
	@echo ""
	@echo "$(GREEN)Database Commands:$(NC)"
	@echo "  make migrate        Run database migrations"
	@echo "  make db-shell       Open database shell"
	@echo "  make backup         Backup database"
	@echo "  make restore        Restore database (args: FILE=backup.sql.gz)"
	@echo ""
	@echo "$(GREEN)Container Commands:$(NC)"
	@echo "  make shell          Enter backend shell (args: SVC=backend)"
	@echo "  make exec           Execute command (args: SVC=backend CMD='command')"
	@echo "  make redis-cli      Open Redis CLI"
	@echo ""
	@echo "$(GREEN)Development Commands:$(NC)"
	@echo "  make debug          Start with debug tools (Adminer, Redis Commander)"
	@echo "  make test           Run tests"
	@echo "  make lint           Run code linters"
	@echo "  make format         Format code"
	@echo ""
	@echo "$(GREEN)Production Commands:$(NC)"
	@echo "  make prod           Start in production mode"
	@echo "  make prod-deploy    Deploy to production"
	@echo ""
	@echo "$(GREEN)Maintenance Commands:$(NC)"
	@echo "  make clean          Remove all containers and volumes"
	@echo "  make prune          Prune Docker system"
	@echo "  make health-check   Run health checks"

build:
	@echo "$(BLUE)Building Docker images...$(NC)"
	$(COMPOSE) -f $(DC_FILE) build
	@echo "$(GREEN)✓ Build complete$(NC)"

rebuild:
	@echo "$(BLUE)Rebuilding Docker images (no cache)...$(NC)"
	$(COMPOSE) -f $(DC_FILE) build --no-cache
	@echo "$(GREEN)✓ Rebuild complete$(NC)"

up:
	@echo "$(BLUE)Starting services...$(NC)"
	$(COMPOSE) -f $(DC_FILE) up -d
	@sleep 2
	@$(MAKE) status
	@echo "$(GREEN)✓ Services started$(NC)"

down:
	@echo "$(BLUE)Stopping services...$(NC)"
	$(COMPOSE) -f $(DC_FILE) down
	@echo "$(GREEN)✓ Services stopped$(NC)"

restart:
	@echo "$(BLUE)Restarting all services...$(NC)"
	$(COMPOSE) -f $(DC_FILE) restart
	@sleep 2
	@$(MAKE) status
	@echo "$(GREEN)✓ Services restarted$(NC)"

restart-svc:
	@if [ -z "$(SVC)" ]; then \
		echo "$(RED)✗ Please specify service: make restart-svc SVC=backend$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)Restarting $(SVC)...$(NC)"
	$(COMPOSE) -f $(DC_FILE) restart $(SVC)
	@echo "$(GREEN)✓ $(SVC) restarted$(NC)"

logs:
	$(COMPOSE) -f $(DC_FILE) logs -f

logs-svc:
	@if [ -z "$(SVC)" ]; then \
		echo "$(RED)✗ Please specify service: make logs-svc SVC=backend$(NC)"; \
		exit 1; \
	fi
	$(COMPOSE) -f $(DC_FILE) logs -f $(SVC)

status:
	@echo "$(BLUE)Service Status:$(NC)"
	@$(COMPOSE) -f $(DC_FILE) ps

migrate:
	@echo "$(BLUE)Running migrations...$(NC)"
	$(COMPOSE) -f $(DC_FILE) exec backend flask db upgrade
	@echo "$(GREEN)✓ Migrations complete$(NC)"

db-shell:
	@echo "$(BLUE)Opening PostgreSQL shell...$(NC)"
	$(COMPOSE) -f $(DC_FILE) exec postgres psql -U schichtplan_user -d schichtplan

shell:
	@SVC=$${SVC:-backend}; \
	echo "$(BLUE)Opening $$SVC shell...$(NC)"; \
	$(COMPOSE) -f $(DC_FILE) exec $$SVC bash

exec:
	@if [ -z "$(SVC)" ] || [ -z "$(CMD)" ]; then \
		echo "$(RED)✗ Usage: make exec SVC=backend CMD='command'$(NC)"; \
		exit 1; \
	fi
	$(COMPOSE) -f $(DC_FILE) exec $(SVC) $(CMD)

redis-cli:
	@echo "$(BLUE)Opening Redis CLI...$(NC)"
	$(COMPOSE) -f $(DC_FILE) exec redis redis-cli -a redis_password

backup:
	@echo "$(BLUE)Backing up database...$(NC)"
	@$(eval BACKUP_FILE := backup_$(shell date +%Y%m%d_%H%M%S).sql.gz)
	$(COMPOSE) -f $(DC_FILE) exec postgres pg_dump -U schichtplan_user schichtplan | gzip > $(BACKUP_FILE)
	@echo "$(GREEN)✓ Backup created: $(BACKUP_FILE)$(NC)"

restore:
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)✗ Usage: make restore FILE=backup.sql.gz$(NC)"; \
		exit 1; \
	fi
	@if [ ! -f "$(FILE)" ]; then \
		echo "$(RED)✗ File not found: $(FILE)$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)⚠ This will overwrite the database!$(NC)"
	@read -p "Continue? (y/N) " response; \
	if [ "$$response" = "y" ]; then \
		echo "$(BLUE)Restoring database...$(NC)"; \
		zcat $(FILE) | $(COMPOSE) -f $(DC_FILE) exec -T postgres psql -U schichtplan_user schichtplan; \
		echo "$(GREEN)✓ Database restored$(NC)"; \
	else \
		echo "$(BLUE)Restore cancelled$(NC)"; \
	fi

debug:
	@echo "$(BLUE)Starting with debug tools...$(NC)"
	$(COMPOSE) -f $(DC_FILE) --profile debug up -d
	@sleep 2
	@$(MAKE) status
	@echo "$(GREEN)✓ Available tools:$(NC)"
	@echo "  - Adminer (DB): http://localhost:8080"
	@echo "  - Redis Commander: http://localhost:8081"

test:
	@echo "$(BLUE)Running tests...$(NC)"
	$(COMPOSE) -f $(DC_FILE) exec backend pytest -v
	@echo "$(GREEN)✓ Tests complete$(NC)"

lint:
	@echo "$(BLUE)Running linters...$(NC)"
	$(COMPOSE) -f $(DC_FILE) exec backend ruff check .
	@echo "$(GREEN)✓ Linting complete$(NC)"

format:
	@echo "$(BLUE)Formatting code...$(NC)"
	$(COMPOSE) -f $(DC_FILE) exec backend ruff format .
	@echo "$(GREEN)✓ Formatting complete$(NC)"

prod:
	@echo "$(BLUE)Starting in production mode...$(NC)"
	ENV_FILE=.env.prod $(COMPOSE) -f $(DC_FILE) up -d
	@sleep 2
	@$(MAKE) status
	@echo "$(GREEN)✓ Production services started$(NC)"

prod-deploy: rebuild prod migrate
	@echo "$(GREEN)✓ Production deployment complete$(NC)"

clean:
	@echo "$(YELLOW)⚠ This will remove all containers and volumes!$(NC)"
	@read -p "Continue? (y/N) " response; \
	if [ "$$response" = "y" ]; then \
		echo "$(BLUE)Cleaning up...$(NC)"; \
		$(COMPOSE) -f $(DC_FILE) down -v; \
		echo "$(GREEN)✓ Cleanup complete$(NC)"; \
	else \
		echo "$(BLUE)Cleanup cancelled$(NC)"; \
	fi

prune:
	@echo "$(BLUE)Pruning Docker system...$(NC)"
	docker system prune -f --volumes
	@echo "$(GREEN)✓ Prune complete$(NC)"

health-check:
	@echo "$(BLUE)Running health checks...$(NC)"
	@echo "Backend:" && curl -s http://localhost:5000/health || echo "$(RED)✗ Not responding$(NC)"
	@echo "Frontend:" && curl -s http://localhost:5173 > /dev/null && echo "$(GREEN)✓ OK$(NC)" || echo "$(RED)✗ Not responding$(NC)"
	@echo "Database:" && $(COMPOSE) -f $(DC_FILE) exec postgres pg_isready -U schichtplan_user || echo "$(RED)✗ Not responding$(NC)"
	@echo "Redis:" && $(COMPOSE) -f $(DC_FILE) exec redis redis-cli -a redis_password ping || echo "$(RED)✗ Not responding$(NC)"

.DEFAULT_GOAL := help
