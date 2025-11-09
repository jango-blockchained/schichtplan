# Production Deployment Guide for Schichtplan

## Overview

This guide covers the complete production deployment process for Schichtplan, including security hardening, monitoring, and best practices.

## Pre-Deployment Checklist

### ✅ Required Steps

- [ ] **Security Configuration**
  - [ ] Generate strong SECRET_KEY and JWT_SECRET_KEY
  - [ ] Configure SSL/TLS certificates
  - [ ] Set up WebAuthn with production domain
  - [ ] Review and restrict CORS origins
  - [ ] Enable security headers
  - [ ] Configure firewall rules

- [ ] **Database Setup**
  - [ ] Choose production database (PostgreSQL recommended)
  - [ ] Configure database backups
  - [ ] Set up database connection pooling
  - [ ] Run database migrations
  - [ ] Test database failover (if applicable)

- [ ] **Application Configuration**
  - [ ] Set FLASK_ENV=production
  - [ ] Configure production logging
  - [ ] Set up error tracking (Sentry, etc.)
  - [ ] Configure email service
  - [ ] Set proper timezone

- [ ] **Infrastructure**
  - [ ] Set up reverse proxy (nginx)
  - [ ] Configure load balancer (if needed)
  - [ ] Set up CDN (optional)
  - [ ] Configure health checks
  - [ ] Set up monitoring

- [ ] **Testing**
  - [ ] Run full E2E test suite
  - [ ] Perform load testing
  - [ ] Test backup/restore procedures
  - [ ] Verify WebAuthn works on production domain
  - [ ] Test all integrations (AI, Telegram, etc.)

## Deployment Options

### Option 1: Docker Deployment (Recommended)

#### Quick Start

```bash
# Clone repository
git clone https://github.com/jango-blockchained/schichtplan.git
cd schichtplan

# Copy production environment template
cp .env.prod.example .env.prod

# Edit configuration
nano .env.prod

# Build and start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

#### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: schichtplan-postgres
    environment:
      POSTGRES_DB: schichtplan
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - schichtplan-network
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: schichtplan-redis
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - schichtplan-network
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: schichtplan-backend
    environment:
      FLASK_ENV: production
      SECRET_KEY: ${SECRET_KEY}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/schichtplan
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./instance:/app/instance
      - ./logs:/app/logs
    networks:
      - schichtplan-network
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"

  frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile
      args:
        - NODE_ENV=production
    container_name: schichtplan-frontend
    depends_on:
      - backend
    networks:
      - schichtplan-network
    restart: always

  nginx:
    image: nginx:alpine
    container_name: schichtplan-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/cache:/var/cache/nginx
    depends_on:
      - backend
      - frontend
    networks:
      - schichtplan-network
    restart: always
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  redis_data:

networks:
  schichtplan-network:
    driver: bridge
```

### Option 2: Manual Deployment

#### Prerequisites

- Ubuntu 22.04 LTS or similar
- Python 3.12+
- Node.js 20+ / Bun 1.0+
- PostgreSQL 14+
- Redis 7+
- Nginx

#### Step-by-Step Installation

1. **System Setup**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3.12 python3.12-venv python3-pip \
  postgresql postgresql-contrib redis-server nginx \
  git curl build-essential libpq-dev

# Install Bun
curl -fsSL https://bun.sh/install | bash
```

2. **Database Setup**

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE schichtplan;
CREATE USER schichtplan_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE schichtplan TO schichtplan_user;
\q
EOF
```

3. **Application Setup**

```bash
# Clone repository
cd /opt
sudo git clone https://github.com/jango-blockchained/schichtplan.git
cd schichtplan
sudo chown -R $USER:$USER .

# Backend setup
python3.12 -m venv src/backend/.venv
source src/backend/.venv/bin/activate
pip install -r requirements.txt

# Frontend setup
cd src/frontend
bun install
bun run build
cd ../..

# Environment configuration
cp .env.prod.example .env.prod
nano .env.prod  # Edit configuration

# Database migrations
source src/backend/.venv/bin/activate
flask db upgrade
```

4. **Systemd Services**

Create `/etc/systemd/system/schichtplan-backend.service`:

```ini
[Unit]
Description=Schichtplan Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=schichtplan
WorkingDirectory=/opt/schichtplan
Environment="PATH=/opt/schichtplan/src/backend/.venv/bin"
EnvironmentFile=/opt/schichtplan/.env.prod
ExecStart=/opt/schichtplan/src/backend/.venv/bin/gunicorn \
  -w 4 \
  -b 0.0.0.0:5000 \
  --timeout 120 \
  --access-logfile /var/log/schichtplan/access.log \
  --error-logfile /var/log/schichtplan/error.log \
  'src.backend.app:create_app()'
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable schichtplan-backend
sudo systemctl start schichtplan-backend
sudo systemctl status schichtplan-backend
```

5. **Nginx Configuration**

Create `/etc/nginx/sites-available/schichtplan`:

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;

# Upstream backends
upstream backend {
    server localhost:5000;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;

    # Logging
    access_log /var/log/nginx/schichtplan_access.log;
    error_log /var/log/nginx/schichtplan_error.log;

    # Client body size
    client_max_body_size 10M;

    # Frontend (built React app)
    root /opt/schichtplan/src/frontend/dist;
    index index.html;

    # API Proxy
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # WebSocket support for MCP/AI features
    location /ws/ {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static files with caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Frontend routing (React Router)
    location / {
        limit_req zone=general_limit burst=50 nodelay;
        try_files $uri $uri/ /index.html;
        
        # Cache HTML files for short time
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/schichtplan /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL/TLS Setup with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is configured automatically
sudo systemctl status certbot.timer
```

## Security Hardening

### 1. Generate Secure Keys

```bash
# Generate SECRET_KEY
python3 -c "import secrets; print(secrets.token_hex(32))"

# Generate JWT_SECRET_KEY
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Firewall Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### 3. Fail2Ban Setup

```bash
# Install Fail2Ban
sudo apt install fail2ban

# Configure for nginx
sudo cat > /etc/fail2ban/jail.local << EOF
[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true

[nginx-badbots]
enabled = true

[nginx-noproxy]
enabled = true
EOF

sudo systemctl restart fail2ban
```

## Monitoring & Logging

### 1. Application Monitoring

Install monitoring tools:

```bash
# Prometheus + Grafana for metrics
docker run -d --name prometheus -p 9090:9090 prom/prometheus
docker run -d --name grafana -p 3000:3000 grafana/grafana
```

### 2. Log Aggregation

```bash
# Centralized logging with rsyslog or ELK stack
sudo apt install rsyslog-elasticsearch
```

### 3. Health Checks

Create `/usr/local/bin/schichtplan-health.sh`:

```bash
#!/bin/bash

# Check backend health
if ! curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo "Backend health check failed"
    systemctl restart schichtplan-backend
fi

# Check database connection
if ! PGPASSWORD=$DB_PASSWORD psql -h localhost -U schichtplan_user -d schichtplan -c "SELECT 1" > /dev/null 2>&1; then
    echo "Database connection failed"
fi

# Check Redis
if ! redis-cli ping > /dev/null 2>&1; then
    echo "Redis health check failed"
    systemctl restart redis
fi
```

Add to crontab:

```bash
*/5 * * * * /usr/local/bin/schichtplan-health.sh
```

## Backup Strategy

### Automated Backups

Create `/usr/local/bin/schichtplan-backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backups/schichtplan"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
PGPASSWORD=$DB_PASSWORD pg_dump -h localhost -U schichtplan_user schichtplan | \
    gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Backup application files
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /opt/schichtplan/instance

# Keep only last 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Schedule daily backups:

```bash
0 2 * * * /usr/local/bin/schichtplan-backup.sh
```

## Performance Optimization

### 1. Database Tuning

```sql
-- PostgreSQL configuration adjustments
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET work_mem = '16MB';

SELECT pg_reload_conf();
```

### 2. Redis Configuration

Edit `/etc/redis/redis.conf`:

```
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
```

### 3. Application Caching

Ensure proper cache headers and enable compression in nginx.

## Disaster Recovery

### Recovery Procedures

1. **Database Restore**

```bash
# Stop application
sudo systemctl stop schichtplan-backend

# Restore database
gunzip < /backups/schichtplan/db_backup_YYYYMMDD.sql.gz | \
    PGPASSWORD=$DB_PASSWORD psql -h localhost -U schichtplan_user schichtplan

# Start application
sudo systemctl start schichtplan-backend
```

2. **Application Files Restore**

```bash
cd /opt
sudo tar -xzf /backups/schichtplan/app_backup_YYYYMMDD.tar.gz
```

## Troubleshooting

### Common Issues

1. **Backend won't start**
   - Check logs: `sudo journalctl -u schichtplan-backend -f`
   - Verify database connection
   - Check environment variables

2. **502 Bad Gateway**
   - Verify backend is running: `sudo systemctl status schichtplan-backend`
   - Check nginx config: `sudo nginx -t`
   - Review nginx error log: `sudo tail -f /var/log/nginx/error.log`

3. **Database connection errors**
   - Verify PostgreSQL is running
   - Check connection string in `.env.prod`
   - Verify user permissions

## Production Checklist

- [ ] All tests passing (unit, integration, E2E)
- [ ] SSL certificate configured and valid
- [ ] Firewall rules in place
- [ ] Monitoring and alerting configured
- [ ] Backup system tested
- [ ] Disaster recovery plan documented
- [ ] WebAuthn configured for production domain
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Performance testing completed
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Rollback plan prepared

## Support & Maintenance

### Regular Maintenance Tasks

- **Daily**: Check logs for errors
- **Weekly**: Review backup integrity
- **Monthly**: Update dependencies
- **Quarterly**: Security audit
- **Annually**: SSL certificate renewal (automated with Let's Encrypt)

### Getting Help

- 📖 [Documentation](https://jango-blockchained.github.io/schichtplan)
- 💬 [GitHub Discussions](https://github.com/jango-blockchained/schichtplan/discussions)
- 🐛 [Issue Tracker](https://github.com/jango-blockchained/schichtplan/issues)

---

**Last Updated**: 2024-11-09  
**Version**: 1.0.0
