# Docker Implementation Summary for Schichtplan

## Overview

Complete Docker containerization has been implemented for Schichtplan with the following components:

### Services Implemented

1. **PostgreSQL 16** - Primary database

   - Container: `schichtplan-postgres`
   - Port: 5432
   - Data Volume: `postgres_data`
   - Health Check: Active

2. **Redis 7** - Cache & Session Store

   - Container: `schichtplan-redis`
   - Port: 6379
   - Data Volume: `redis_data`
   - Persistence: AOF (Append Only File)
   - Health Check: Active

3. **Backend (Flask)** - REST API Server

   - Container: `schichtplan-backend`
   - Port: 5000
   - Built from: `Dockerfile.backend`
   - Framework: Flask 3.1.0
   - Server: Gunicorn (4 workers)
   - Health Check: Active

4. **MCP Server** - AI Tool Integration

   - Container: `schichtplan-mcp-server`
   - Port: 8001
   - Built from: `Dockerfile.mcp`
   - Transport: SSE (Server-Sent Events)
   - Health Check: Active

5. **Frontend (React + Bun)** - Web UI

   - Container: `schichtplan-frontend`
   - Port: 5173
   - Built from: `src/frontend/Dockerfile`
   - Runtime: Bun (JavaScript runtime)
   - Node Modules Volume: `frontend_node_modules`
   - Health Check: Active

6. **Nginx** - Reverse Proxy & Load Balancer

   - Container: `schichtplan-nginx`
   - Ports: 80 (HTTP), 443 (HTTPS ready)
   - Configuration: `nginx/nginx.conf` + `nginx/conf.d/`
   - Features: Gzip compression, rate limiting, SSL ready
   - Health Check: Active

7. **Adminer** - Database Management (Debug Profile)

   - Container: `schichtplan-adminer`
   - Port: 8080
   - Profile: debug (optional)

8. **Redis Commander** - Cache Management (Debug Profile)
   - Container: `schichtplan-redis-commander`
   - Port: 8081
   - Profile: debug (optional)

### Network Architecture

All services are connected via `schichtplan-network` (bridge network):

```
Client Requests
      ↓
   Nginx (Port 80/443)
      ↓
   ┌──────────────────────────┐
   │  schichtplan-network     │
   ├──────────────────────────┤
   │ ┌──────────────────────┐ │
   │ │   Frontend :5173     │ │
   │ └──────────────────────┘ │
   │ ┌──────────────────────┐ │
   │ │   Backend :5000      │ │
   │ └──────────────────────┘ │
   │ ┌──────────────────────┐ │
   │ │  MCP Server :8001    │ │
   │ └──────────────────────┘ │
   │ ┌──────────────────────┐ │
   │ │ PostgreSQL :5432     │ │
   │ └──────────────────────┘ │
   │ ┌──────────────────────┐ │
   │ │    Redis :6379       │ │
   │ └──────────────────────┘ │
   └──────────────────────────┘
```

## Files Created

### Docker Configuration Files

| File                          | Purpose                                   |
| ----------------------------- | ----------------------------------------- |
| `docker-compose.yml`          | Main orchestration file with all services |
| `docker-compose.override.yml` | Development overrides (auto-loaded)       |
| `Dockerfile.backend`          | Backend service image definition          |
| `Dockerfile.mcp`              | MCP server image definition               |
| `src/frontend/Dockerfile`     | Frontend service image definition         |
| `.dockerignore`               | Files to exclude from Docker builds       |

### Nginx Configuration

| File                            | Purpose                        |
| ------------------------------- | ------------------------------ |
| `nginx/nginx.conf`              | Main Nginx configuration       |
| `nginx/conf.d/default.conf`     | Development HTTP configuration |
| `nginx/conf.d/ssl.conf.example` | Production HTTPS template      |

### Environment & Scripts

| File                  | Purpose                              |
| --------------------- | ------------------------------------ |
| `.env.example`        | Development environment template     |
| `.env.prod.example`   | Production environment template      |
| `scripts/init-db.sql` | PostgreSQL initialization script     |
| `docker-helper.sh`    | Utility script for Docker operations |
| `Makefile`            | Make targets for common operations   |

### Documentation

| File                               | Purpose                                  |
| ---------------------------------- | ---------------------------------------- |
| `DOCKER_SETUP_GUIDE.md`            | Comprehensive Docker setup documentation |
| `DOCKER_IMPLEMENTATION_SUMMARY.md` | This file                                |

## Quick Start

### Prerequisites

```bash
# Install Docker Desktop or Docker Engine
# Verify installation
docker --version
docker-compose --version
```

### Initial Setup

```bash
# Navigate to project
cd schichtplan

# Copy environment file
cp .env.example .env.local

# Edit configuration if needed
nano .env.local

# Build images
docker-compose build

# Start services
docker-compose up -d

# Apply migrations
docker-compose exec backend flask db upgrade

# View services
docker-compose ps
```

### Access Services

- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **MCP Server**: http://localhost:8001
- **Nginx Proxy**: http://localhost (production only)
- **Adminer (DB)**: http://localhost:8080 (debug profile)
- **Redis Commander**: http://localhost:8081 (debug profile)

## Usage Examples

### Using Make Commands

```bash
# Start services
make up

# View logs
make logs
make logs-svc SVC=backend

# Run migrations
make migrate

# Backup database
make backup

# Debug mode with tools
make debug

# Production deployment
make prod
```

### Using Docker Helper Script

```bash
# Get help
./docker-helper.sh help

# Start services
./docker-helper.sh up

# View logs
./docker-helper.sh logs backend

# Enter shell
./docker-helper.sh shell backend

# Execute command
./docker-helper.sh exec backend "flask shell"

# Backup database
./docker-helper.sh backup
```

### Manual Docker Compose

```bash
# Start all services
docker-compose up -d

# View status
docker-compose ps

# View logs
docker-compose logs -f backend

# Execute command
docker-compose exec backend flask db upgrade

# Stop services
docker-compose down
```

## Database Management

### Initialize Database

```bash
# Apply all migrations
docker-compose exec backend flask db upgrade

# Check current revision
docker-compose exec backend flask db current

# Create new migration
docker-compose exec backend flask db migrate -m "Description"
```

### Backup & Restore

```bash
# Backup
docker-compose exec postgres pg_dump -U schichtplan_user schichtplan | gzip > backup.sql.gz

# Restore
zcat backup.sql.gz | docker-compose exec -T postgres psql -U schichtplan_user schichtplan
```

### Direct Database Access

```bash
# PostgreSQL shell
docker-compose exec postgres psql -U schichtplan_user -d schichtplan

# Redis CLI
docker-compose exec redis redis-cli -a redis_password

# List databases
docker-compose exec postgres psql -U schichtplan_user -l
```

## Development Workflow

### Development Setup

```bash
# Start with debug tools
make debug

# Or manually
docker-compose --profile debug up -d

# View debug tools
# - Adminer: http://localhost:8080
# - Redis Commander: http://localhost:8081
```

### Code Changes

```bash
# Backend changes auto-reload with:
docker-compose exec backend flask run --host=0.0.0.0

# Frontend hot reload with:
docker-compose exec frontend bun run dev

# Or use override file:
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

### Testing

```bash
# Run tests
make test

# Or manually
docker-compose exec backend pytest -v

# Run specific test
docker-compose exec backend pytest tests/backend/test_scheduler.py -v
```

## Production Deployment

### Pre-deployment Checklist

- [ ] Update `.env.prod` with secure values
- [ ] Generate strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Configure SSL certificates in `nginx/ssl/`
- [ ] Enable SSL configuration in Nginx
- [ ] Set CORS_ORIGINS to production domain
- [ ] Disable Flask debug mode
- [ ] Set LOG_LEVEL to INFO
- [ ] Configure email service
- [ ] Setup backup strategy

### Production Start

```bash
# Using make
make prod-deploy

# Or manually
ENV_FILE=.env.prod docker-compose -f docker-compose.yml build
ENV_FILE=.env.prod docker-compose -f docker-compose.yml up -d
docker-compose exec backend flask db upgrade
```

### Production Monitoring

```bash
# View real-time stats
docker stats

# Check service health
docker-compose ps

# View error logs
docker-compose logs --tail=100 backend | grep ERROR

# Monitor disk usage
docker system df
```

### Scaling for Production

```bash
# In docker-compose.yml, adjust:
# 1. Gunicorn workers: -w 8 (for 8-core CPU)
# 2. PostgreSQL connections: SQLALCHEMY_POOL_SIZE=20
# 3. Redis memory: Configure in redis image
# 4. Nginx worker_processes: auto (in nginx.conf)
```

## Performance Optimization

### Database Optimization

```bash
# Monitor queries
docker-compose exec backend \
  SQLALCHEMY_ECHO=1 python -m flask shell

# Analyze query performance
docker-compose exec postgres \
  psql -U schichtplan_user -d schichtplan -c "EXPLAIN ANALYZE SELECT ..."

# Check index usage
docker-compose exec postgres \
  psql -U schichtplan_user -d schichtplan \
  -c "SELECT * FROM pg_stat_user_indexes;"
```

### Redis Optimization

```bash
# Monitor memory
docker-compose exec redis redis-cli -a redis_password INFO memory

# Check key distribution
docker-compose exec redis redis-cli -a redis_password INFO keyspace

# Set max memory policy
docker-compose exec redis redis-cli -a redis_password CONFIG SET maxmemory-policy allkeys-lru
```

### Nginx Optimization

```bash
# Test Nginx configuration
docker-compose exec nginx nginx -t

# View current connections
docker-compose exec nginx sh -c 'netstat -an | grep ESTABLISHED | wc -l'

# Monitor response times
docker-compose logs nginx | grep -oP 'upstream_response_time \K[0-9.]+'
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs backend

# Check resource constraints
docker stats

# Verify network
docker network inspect schichtplan-network
```

### Database Connection Issues

```bash
# Test connection
docker-compose exec backend psql $DATABASE_URL -c "SELECT 1;"

# Check credentials
docker-compose exec postgres psql -U schichtplan_user -l

# Verify network connectivity
docker-compose exec backend ping postgres
```

### High Memory Usage

```bash
# Check PostgreSQL memory
docker-compose exec postgres psql -U schichtplan_user -c "SELECT * FROM pg_stat_statements ORDER BY memory DESC LIMIT 10;"

# Check Redis memory
docker-compose exec redis redis-cli -a redis_password INFO memory

# Clear caches
docker-compose exec redis redis-cli -a redis_password FLUSHALL
```

### Slow Requests

```bash
# Check slow queries (PostgreSQL)
docker-compose exec postgres psql -U schichtplan_user -d schichtplan \
  -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check Nginx access logs
docker-compose logs nginx | grep -E "[0-9]{4}ms"

# Profile Flask app
docker-compose exec backend PROFILER=cprofile flask run
```

## Maintenance

### Regular Tasks

```bash
# Daily: Check service health
make health-check

# Weekly: Backup database
make backup

# Monthly: Update images
docker-compose pull
docker-compose up -d

# Quarterly: Clean up old images/volumes
docker system prune -f --volumes
```

### Security Updates

```bash
# Check for base image updates
docker-compose build --pull --no-cache

# Update dependencies
docker-compose exec backend pip install --upgrade -r requirements.txt
```

## Volumes

Three Docker volumes persist data:

| Volume                  | Service    | Purpose                 |
| ----------------------- | ---------- | ----------------------- |
| `postgres_data`         | PostgreSQL | Database persistence    |
| `redis_data`            | Redis      | Cache persistence (RDB) |
| `frontend_node_modules` | Frontend   | Cached dependencies     |

### Backup Volumes

```bash
# Backup PostgreSQL volume
docker run --rm -v postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz -C /data .

# Backup Redis volume
docker run --rm -v redis_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/redis-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v postgres_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-backup.tar.gz -C /data
```

## Additional Resources

- Docker Documentation: https://docs.docker.com/
- Docker Compose Documentation: https://docs.docker.com/compose/
- PostgreSQL Docker Image: https://hub.docker.com/_/postgres
- Redis Docker Image: https://hub.docker.com/_/redis
- Nginx Docker Image: https://hub.docker.com/_/nginx

## Next Steps

1. **Configure environment**: Edit `.env.local` with your settings
2. **Build images**: Run `docker-compose build`
3. **Start services**: Run `docker-compose up -d`
4. **Initialize database**: Run `docker-compose exec backend flask db upgrade`
5. **Access frontend**: Open http://localhost:5173

## Support

For issues:

- Check Docker logs: `docker-compose logs -f [service]`
- Check service health: `docker-compose ps`
- Review this guide: See "Troubleshooting" section
- Contact: See project repository

---

**Document Version:** 1.0
**Last Updated:** November 2, 2025
**Docker Compose Version:** 3.9
**Status:** Production Ready
