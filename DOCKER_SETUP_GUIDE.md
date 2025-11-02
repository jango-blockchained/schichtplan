# Docker Deployment Guide for Schichtplan

## Overview

This guide covers the complete Docker setup for Schichtplan, including all microservices, databases, caching, and reverse proxy configuration.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Network                          │
│  schichtplan-network (bridge)                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Nginx       │  │  Frontend    │  │  Backend     │     │
│  │  (Reverse    │  │  (React +    │  │  (Flask +    │     │
│  │  Proxy)      │  │   Bun)       │  │   MCP)       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│       :80               :5173              :5000            │
│       :443                                                 │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  MCP Server  │  │  PostgreSQL  │  │  Redis       │     │
│  │  (SSE/AI)    │  │  (Database)  │  │  (Cache)     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│       :8001              :5432              :6379          │
│                                                             │
│  Optional Tools (Debug Profile):                           │
│  ┌──────────────┐  ┌──────────────┐                       │
│  │  Adminer     │  │  Redis Cmd   │                       │
│  │  (DB Admin)  │  │  (Cache Mgr) │                       │
│  └──────────────┘  └──────────────┘                       │
│       :8080               :8081                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Docker Desktop (20.10+) or Docker Engine (20.10+)
- Docker Compose (2.0+)
- 4GB RAM minimum (8GB recommended)
- 10GB free disk space

### Installation

**macOS/Windows:**

```bash
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
```

**Linux:**

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER
newgrp docker
```

## Quick Start

### 1. Initial Setup

```bash
cd schichtplan

# Copy environment files
cp .env.example .env.local
cp .env.prod.example .env.prod

# Edit environment variables
nano .env.local

# Create required directories
mkdir -p nginx/ssl instance logs scripts
```

### 2. Build and Start Services

```bash
# Build all images
docker-compose build

# Start all services in background
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 3. Initialize Database

```bash
# Run migrations
docker-compose exec backend flask db upgrade

# Generate demo data (optional)
docker-compose exec backend python -m src.backend.tools.data_generators.update_demo_data
```

### 4. Access Applications

| Service         | URL                   | Purpose                   |
| --------------- | --------------------- | ------------------------- |
| Frontend        | http://localhost:5173 | Web UI                    |
| Backend API     | http://localhost:5000 | REST API                  |
| Nginx Proxy     | http://localhost      | All services (production) |
| MCP Server      | http://localhost:8001 | AI Tools (SSE)            |
| Adminer         | http://localhost:8080 | Database UI (debug mode)  |
| Redis Commander | http://localhost:8081 | Cache UI (debug mode)     |

## Common Operations

### Start Development Environment

```bash
# With debug tools enabled
docker-compose --profile debug up -d

# With frontend hot reload
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# With timestamp
docker-compose logs -f --timestamps backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Execute Commands in Container

```bash
# Backend shell
docker-compose exec backend bash

# Backend Python shell
docker-compose exec backend python -m flask shell

# Database access
docker-compose exec postgres psql -U schichtplan_user -d schichtplan

# Redis CLI
docker-compose exec redis redis-cli -a redis_password
```

### Database Management

```bash
# Create new migration
docker-compose exec backend flask db migrate -m "Your migration description"

# Review migration
docker-compose exec backend cat instance/migrations/versions/xxxxx_your_migration.py

# Apply migration
docker-compose exec backend flask db upgrade

# Rollback migration
docker-compose exec backend flask db downgrade

# Database backup
docker-compose exec postgres pg_dump -U schichtplan_user schichtplan > backup.sql

# Database restore
docker-compose exec -T postgres psql -U schichtplan_user schichtplan < backup.sql
```

### Service Management

```bash
# Stop all services
docker-compose stop

# Start all services
docker-compose start

# Restart specific service
docker-compose restart backend

# Remove containers (keeps volumes)
docker-compose down

# Remove everything including volumes
docker-compose down -v

# Rebuild specific image
docker-compose build --no-cache backend
```

## Production Deployment

### Prerequisites for Production

- Dedicated server or cloud instance
- Domain name with DNS configured
- SSL certificate (Let's Encrypt recommended)
- Backup storage location

### Production Setup

```bash
# 1. Clone repository
git clone <repo-url> schichtplan
cd schichtplan

# 2. Setup environment
cp .env.prod.example .env.prod
# Edit with production values
nano .env.prod

# 3. Setup SSL certificates
mkdir -p nginx/ssl
# Place your cert.pem and key.pem in nginx/ssl/

# 4. Enable SSL configuration
cp nginx/conf.d/ssl.conf.example nginx/conf.d/prod.conf
# Update domain name in prod.conf

# 5. Build and start
docker-compose -f docker-compose.yml build
docker-compose -f docker-compose.yml up -d

# 6. Initialize database
docker-compose exec backend flask db upgrade

# 7. Enable backup cron job
crontab -e
# Add: 0 2 * * * /path/to/schichtplan/scripts/backup.sh
```

### Security Checklist

- [ ] Change all default passwords
- [ ] Use strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Enable SSL/TLS
- [ ] Configure firewall rules
- [ ] Enable HTTPS redirect
- [ ] Set up regular backups
- [ ] Configure log rotation
- [ ] Monitor resource usage
- [ ] Enable audit logging
- [ ] Set up alerting

### Performance Tuning

```bash
# PostgreSQL: Adjust shared_buffers for large instances
docker-compose exec postgres psql -U schichtplan_user -d schichtplan -c "ALTER SYSTEM SET shared_buffers = '256MB';"

# Redis: Monitor memory usage
docker-compose exec redis redis-cli -a redis_password INFO memory

# Backend: Scale workers (in docker-compose.yml)
# Change: gunicorn -w 8 (for 8-core systems)

# Nginx: Monitor active connections
docker-compose exec nginx nginx -T
```

## Troubleshooting

### Services won't start

```bash
# Check service logs
docker-compose logs backend

# Check network connectivity
docker network inspect schichtplan-network

# Verify ports aren't in use
netstat -an | grep 5000
lsof -i :5000
```

### Database connection errors

```bash
# Test PostgreSQL connection
docker-compose exec postgres pg_isready -U schichtplan_user

# Check connection string
docker-compose exec backend echo $DATABASE_URL

# Test from backend container
docker-compose exec backend psql $DATABASE_URL -c "SELECT 1;"
```

### Redis connection errors

```bash
# Test Redis connection
docker-compose exec redis redis-cli -a redis_password ping

# Check Redis memory
docker-compose exec redis redis-cli -a redis_password INFO memory

# Clear Redis cache
docker-compose exec redis redis-cli -a redis_password FLUSHALL
```

### Frontend/Backend communication issues

```bash
# Test API from backend container
docker-compose exec frontend curl http://backend:5000/health

# Check network connectivity
docker-compose exec backend ping frontend

# View Nginx logs
docker-compose logs nginx

# Test through Nginx
curl http://localhost/api/health
```

## Monitoring & Maintenance

### Health Checks

Each service has a health check. Monitor with:

```bash
# View health status
docker-compose ps

# Check specific service
docker ps | grep schichtplan

# Monitor in real-time
watch docker-compose ps
```

### Logs

```bash
# Structured logging setup
docker-compose exec backend ls -la logs/

# Filter by level
docker-compose logs backend 2>&1 | grep ERROR

# Export logs
docker-compose logs > logs-dump.txt
```

### Resource Monitoring

```bash
# Docker stats
docker stats

# Specific containers
docker stats schichtplan-backend schichtplan-postgres

# Save stats to file
docker stats --no-stream > docker-stats.txt
```

### Backup & Recovery

```bash
# Database backup
docker-compose exec postgres pg_dump -U schichtplan_user schichtplan | gzip > backup-$(date +%Y%m%d).sql.gz

# Redis backup (automatic RDB)
docker-compose exec redis redis-cli -a redis_password BGSAVE

# Full backup
./scripts/backup.sh
```

## Updating Services

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker-compose build --no-cache backend

# Stop old container
docker-compose stop backend

# Start new container
docker-compose up -d backend

# Check for migrations
docker-compose exec backend flask db current
docker-compose exec backend flask db upgrade
```

## Volume Management

### Data Persistence

```bash
# List volumes
docker volume ls | grep schichtplan

# Inspect volume
docker volume inspect schichtplan_postgres_data

# Backup volume
docker run --rm -v schichtplan_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v schichtplan_postgres_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-backup.tar.gz -C /data
```

## Integration Examples

### GitHub Actions CI/CD

```yaml
# .github/workflows/docker-deploy.yml
name: Deploy to Docker

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and test
        run: docker-compose build
      - name: Push to registry
        run: docker tag schichtplan-backend myregistry/schichtplan:latest
```

### Kubernetes Deployment

See `kubernetes/` directory for Helm charts and manifests.

## Additional Resources

- Docker Compose Docs: https://docs.docker.com/compose/
- Docker Networking: https://docs.docker.com/network/
- PostgreSQL Docker: https://hub.docker.com/_/postgres
- Nginx Docker: https://hub.docker.com/_/nginx

## Support

For issues, see:

- Docker logs: `docker-compose logs`
- Service health: `docker-compose ps`
- Container shell: `docker-compose exec service bash`

---

**Last Updated:** November 2, 2025
**Docker Compose Version:** 3.9
**Services:** Backend, Frontend, PostgreSQL, Redis, MCP Server, Nginx, Adminer, Redis Commander
