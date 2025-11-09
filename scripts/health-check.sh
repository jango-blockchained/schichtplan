#!/bin/bash
# Production health check script for Schichtplan
# Place in /usr/local/bin/schichtplan-health-check.sh
# Make executable: chmod +x /usr/local/bin/schichtplan-health-check.sh

set -e

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:5000}"
MCP_URL="${MCP_URL:-http://localhost:8001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost}"
DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-schichtplan}"
DB_USER="${DB_USER:-schichtplan_user}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
LOG_FILE="/var/log/schichtplan/health-check.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error counter
ERRORS=0

# Check backend health
check_backend() {
    log "Checking backend health..."
    
    if curl -sf "$BACKEND_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Backend is healthy"
        log "Backend: OK"
        return 0
    else
        echo -e "${RED}✗${NC} Backend health check failed"
        log "Backend: FAILED"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Check frontend
check_frontend() {
    log "Checking frontend..."
    
    if curl -sf "$FRONTEND_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Frontend is accessible"
        log "Frontend: OK"
        return 0
    else
        echo -e "${RED}✗${NC} Frontend health check failed"
        log "Frontend: FAILED"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Check MCP server (optional)
check_mcp() {
    log "Checking MCP server..."
    
    if curl -sf "$MCP_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} MCP server is healthy"
        log "MCP: OK"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} MCP server health check failed (optional service)"
        log "MCP: WARNING"
        return 0  # Don't count as critical error
    fi
}

# Check database connection
check_database() {
    log "Checking database connection..."
    
    if command -v psql > /dev/null 2>&1; then
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Database connection OK"
            log "Database: OK"
            return 0
        else
            echo -e "${RED}✗${NC} Database connection failed"
            log "Database: FAILED"
            ERRORS=$((ERRORS + 1))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} psql not installed, skipping database check"
        log "Database: SKIPPED (psql not available)"
        return 0
    fi
}

# Check Redis
check_redis() {
    log "Checking Redis connection..."
    
    if command -v redis-cli > /dev/null 2>&1; then
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Redis connection OK"
            log "Redis: OK"
            return 0
        else
            echo -e "${RED}✗${NC} Redis connection failed"
            log "Redis: FAILED"
            ERRORS=$((ERRORS + 1))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} redis-cli not installed, skipping Redis check"
        log "Redis: SKIPPED (redis-cli not available)"
        return 0
    fi
}

# Check disk space
check_disk_space() {
    log "Checking disk space..."
    
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$DISK_USAGE" -lt 80 ]; then
        echo -e "${GREEN}✓${NC} Disk usage: ${DISK_USAGE}%"
        log "Disk space: OK (${DISK_USAGE}%)"
        return 0
    elif [ "$DISK_USAGE" -lt 90 ]; then
        echo -e "${YELLOW}⚠${NC} Disk usage: ${DISK_USAGE}% (warning)"
        log "Disk space: WARNING (${DISK_USAGE}%)"
        return 0
    else
        echo -e "${RED}✗${NC} Disk usage: ${DISK_USAGE}% (critical)"
        log "Disk space: CRITICAL (${DISK_USAGE}%)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Check memory usage
check_memory() {
    log "Checking memory usage..."
    
    MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    
    if [ "$MEM_USAGE" -lt 80 ]; then
        echo -e "${GREEN}✓${NC} Memory usage: ${MEM_USAGE}%"
        log "Memory: OK (${MEM_USAGE}%)"
        return 0
    elif [ "$MEM_USAGE" -lt 90 ]; then
        echo -e "${YELLOW}⚠${NC} Memory usage: ${MEM_USAGE}% (warning)"
        log "Memory: WARNING (${MEM_USAGE}%)"
        return 0
    else
        echo -e "${RED}✗${NC} Memory usage: ${MEM_USAGE}% (critical)"
        log "Memory: CRITICAL (${MEM_USAGE}%)"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Check SSL certificate expiry
check_ssl_certificate() {
    log "Checking SSL certificate..."
    
    if [ -f "/etc/nginx/ssl/fullchain.pem" ]; then
        EXPIRY_DATE=$(openssl x509 -enddate -noout -in /etc/nginx/ssl/fullchain.pem | cut -d= -f2)
        EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
        CURRENT_EPOCH=$(date +%s)
        DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))
        
        if [ "$DAYS_LEFT" -gt 30 ]; then
            echo -e "${GREEN}✓${NC} SSL certificate valid for $DAYS_LEFT days"
            log "SSL certificate: OK ($DAYS_LEFT days remaining)"
            return 0
        elif [ "$DAYS_LEFT" -gt 7 ]; then
            echo -e "${YELLOW}⚠${NC} SSL certificate expires in $DAYS_LEFT days"
            log "SSL certificate: WARNING ($DAYS_LEFT days remaining)"
            return 0
        else
            echo -e "${RED}✗${NC} SSL certificate expires in $DAYS_LEFT days!"
            log "SSL certificate: CRITICAL ($DAYS_LEFT days remaining)"
            ERRORS=$((ERRORS + 1))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} SSL certificate not found"
        log "SSL certificate: NOT FOUND"
        return 0
    fi
}

# Main health check
main() {
    echo "=================================="
    echo "Schichtplan Health Check"
    echo "$(date +'%Y-%m-%d %H:%M:%S')"
    echo "=================================="
    echo ""
    
    log "Starting health check..."
    
    # Run all checks
    check_backend
    check_frontend
    check_mcp
    check_database
    check_redis
    check_disk_space
    check_memory
    check_ssl_certificate
    
    echo ""
    echo "=================================="
    
    if [ $ERRORS -eq 0 ]; then
        echo -e "${GREEN}All health checks passed!${NC}"
        log "Health check completed: ALL OK"
        exit 0
    else
        echo -e "${RED}Health check failed with $ERRORS error(s)${NC}"
        log "Health check completed: $ERRORS ERRORS"
        
        # Optionally send alert
        if [ -n "$ALERT_EMAIL" ]; then
            echo "Health check failed with $ERRORS error(s)" | \
                mail -s "Schichtplan Health Check Alert" "$ALERT_EMAIL"
        fi
        
        exit 1
    fi
}

# Run main function
main "$@"
