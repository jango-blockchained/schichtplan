#!/bin/bash
# Quick Reference - Schichtplan Docker Commands

cat << 'EOF'

╔════════════════════════════════════════════════════════════════════════════╗
║                   SCHICHTPLAN DOCKER QUICK REFERENCE                      ║
╚════════════════════════════════════════════════════════════════════════════╝

┌─ QUICK START ─────────────────────────────────────────────────────────────┐
│ make up                    Start all services                            │
│ make down                  Stop all services                             │
│ make restart               Restart all services                          │
│ make status                View service status                           │
│ make logs                  View all service logs                         │
│ make debug                 Start with debug tools (Adminer, Redis Cmd)   │
└──────────────────────────────────────────────────────────────────────────┘

┌─ SERVICE ACCESS ──────────────────────────────────────────────────────────┐
│ Frontend UI:          http://localhost:5173                             │
│ Backend API:          http://localhost:5000                             │
│ MCP Server:           http://localhost:8001                             │
│ Nginx Proxy:          http://localhost                                  │
│ Database Admin:       http://localhost:8080 (debug mode)                │
│ Redis Manager:        http://localhost:8081 (debug mode)                │
└──────────────────────────────────────────────────────────────────────────┘

┌─ DATABASE COMMANDS ───────────────────────────────────────────────────────┐
│ make migrate               Run database migrations                        │
│ make backup                Backup database (creates backup_*.sql.gz)     │
│ make restore FILE=x.gz     Restore database from backup file             │
│ make db-shell              Open PostgreSQL shell                         │
│ make redis-cli             Open Redis CLI                                │
└──────────────────────────────────────────────────────────────────────────┘

┌─ CONTAINER COMMANDS ──────────────────────────────────────────────────────┐
│ make shell SVC=backend     Enter container shell                          │
│ make logs-svc SVC=backend  View specific service logs                     │
│ make exec SVC=backend CMD='...'  Execute command in container            │
│ make test                  Run tests                                      │
│ make lint                  Run code linters                               │
│ make format                Format code                                    │
└──────────────────────────────────────────────────────────────────────────┘

┌─ BUILD & DEPLOYMENT ──────────────────────────────────────────────────────┐
│ make build                 Build all Docker images                        │
│ make rebuild               Rebuild without cache                         │
│ make prod                  Start in production mode                       │
│ make prod-deploy           Full production deployment                     │
│ make clean                 Remove all containers and volumes             │
│ make prune                 Clean up unused Docker objects                 │
│ make health-check          Run all health checks                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─ SERVICE STATUS ──────────────────────────────────────────────────────────┐
│ Service              Port    Status Check                                │
│ ─────────────────────────────────────────────────────────────────────   │
│ Frontend            5173    http://localhost:5173                       │
│ Backend API         5000    http://localhost:5000/health                │
│ MCP Server          8001    http://localhost:8001                       │
│ PostgreSQL          5432    docker-compose exec postgres pg_isready    │
│ Redis               6379    docker-compose exec redis redis-cli ping   │
│ Nginx               80/443  http://localhost/health                     │
│ Adminer (debug)     8080    http://localhost:8080                       │
│ Redis Cmd (debug)   8081    http://localhost:8081                       │
└──────────────────────────────────────────────────────────────────────────┘

┌─ ENVIRONMENT FILES ───────────────────────────────────────────────────────┐
│ .env.local          Development configuration (auto-created from .example)
│ .env.prod           Production configuration (copy from .prod.example)   │
│ .env.example        Development template (DO NOT EDIT)                   │
│ .env.prod.example   Production template (DO NOT EDIT)                    │
└──────────────────────────────────────────────────────────────────────────┘

┌─ DOCKER VOLUMES ──────────────────────────────────────────────────────────┐
│ postgres_data              Database storage                               │
│ redis_data                 Cache storage                                  │
│ frontend_node_modules      Frontend dependencies (node_modules)           │
│ nginx_cache                Nginx cache                                    │
└──────────────────────────────────────────────────────────────────────────┘

┌─ TROUBLESHOOTING ─────────────────────────────────────────────────────────┐
│ Service won't start:       make logs-svc SVC=<service>                   │
│ Database connection error: docker-compose exec backend psql $DATABASE_URL │
│ Redis connection error:    docker-compose exec redis redis-cli -a ...   │
│ High memory usage:         docker stats                                   │
│ Slow requests:             docker-compose logs backend | grep ERROR       │
│ Check all health:          make health-check                              │
└──────────────────────────────────────────────────────────────────────────┘

┌─ USEFUL COMMANDS ─────────────────────────────────────────────────────────┐
│ View service logs:         docker-compose logs -f backend                │
│ Enter service shell:       docker-compose exec backend bash               │
│ Run test suite:            docker-compose exec backend pytest -v         │
│ Run migrations:            docker-compose exec backend flask db upgrade  │
│ Open Python shell:         docker-compose exec backend flask shell       │
│ Check running containers:  docker ps                                      │
│ View resource usage:       docker stats                                   │
│ Clean all images:          docker system prune -a                         │
└──────────────────────────────────────────────────────────────────────────┘

┌─ DEVELOPMENT WORKFLOW ────────────────────────────────────────────────────┐
│ 1. make up                 Start all services                             │
│ 2. make migrate            Initialize database                            │
│ 3. make logs               Monitor services                               │
│ 4. make debug              Enable debug tools                             │
│ 5. Edit code & save        Changes auto-reload (with proper config)       │
│ 6. make test               Run tests                                      │
│ 7. make backup             Backup before major changes                    │
└──────────────────────────────────────────────────────────────────────────┘

┌─ PRODUCTION WORKFLOW ─────────────────────────────────────────────────────┐
│ 1. cp .env.prod.example .env.prod                                        │
│ 2. Edit .env.prod with secure values                                     │
│ 3. Setup nginx/ssl certificates                                          │
│ 4. make prod-deploy        Full production deployment                     │
│ 5. make health-check       Verify all services                            │
│ 6. Schedule backups        Use cron for regular backups                   │
│ 7. Monitor services        Use docker stats & logs                        │
└──────────────────────────────────────────────────────────────────────────┘

┌─ NETWORK ARCHITECTURE ────────────────────────────────────────────────────┐
│                                                                           │
│  Client (Port 80/443)                                                    │
│         ↓                                                                 │
│    Nginx Reverse Proxy                                                   │
│         ↓                                                                 │
│  ┌──────┴──────┬──────────┬──────────┐                                  │
│  ↓             ↓          ↓          ↓                                   │
│ Frontend    Backend     MCP Server  Admin Tools                          │
│ :5173       :5000       :8001       :8080,:8081                         │
│  │             │          │          │                                   │
│  └──────┬──────┴──────────┴──────────┘                                  │
│         ↓                                                                 │
│  ┌──────┴──────┬──────────┐                                             │
│  ↓             ↓          ↓                                              │
│ PostgreSQL   Redis     Cache                                             │
│ :5432        :6379     (RDB/AOF)                                        │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘

╔════════════════════════════════════════════════════════════════════════════╗
║ For full documentation, see DOCKER_SETUP_GUIDE.md                         ║
║ For implementation details, see DOCKER_IMPLEMENTATION_SUMMARY.md           ║
╚════════════════════════════════════════════════════════════════════════════╝

EOF
