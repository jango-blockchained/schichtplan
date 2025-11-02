#!/bin/bash
# Helper script for Docker Compose operations

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env.local"

# Show usage
usage() {
    cat << EOF
Schichtplan Docker Compose Helper

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    build           Build all Docker images
    up              Start all services
    down            Stop all services
    restart [svc]   Restart services (all or specific)
    logs [svc]      View service logs
    shell [svc]     Enter service shell
    exec [svc] cmd  Execute command in service
    migrate         Run database migrations
    backup          Backup database
    restore FILE    Restore database from backup
    status          Show service status
    clean           Remove all containers and volumes
    debug           Start with debug tools enabled
    prod            Start in production mode
    help            Show this help message

Options:
    -h, --help      Show this help message
    -v, --verbose   Verbose output
    -p, --profile   Load specific profile

Examples:
    $0 up                    # Start all services
    $0 logs backend          # View backend logs
    $0 shell backend         # Enter backend container shell
    $0 exec backend migrate  # Run migrations
    $0 backup                # Backup database
    $0 debug                 # Start with Adminer and Redis Commander

EOF
    exit 0
}

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    echo -e "${GREEN}✓${NC} $*"
}

log_error() {
    echo -e "${RED}✗${NC} $*" >&2
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $*"
}

# Check prerequisites
check_prerequisites() {
    local missing=0
    
    if ! command -v docker &>/dev/null; then
        log_error "Docker is not installed"
        missing=1
    fi
    
    if ! command -v docker-compose &>/dev/null; then
        log_error "Docker Compose is not installed"
        missing=1
    fi
    
    if [ $missing -eq 1 ]; then
        log_error "Please install missing dependencies"
        exit 1
    fi
    
    if [ ! -f "$ENV_FILE" ]; then
        log_warn "Environment file not found: $ENV_FILE"
        log_info "Creating from example..."
        cp .env.example "$ENV_FILE"
        log_info "Please edit $ENV_FILE with your configuration"
    fi
}

# Main commands
cmd_build() {
    log_info "Building Docker images..."
    docker-compose -f "$COMPOSE_FILE" build "$@"
    log_success "Images built successfully"
}

cmd_up() {
    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d "$@"
    log_success "Services started"
    sleep 2
    cmd_status
}

cmd_down() {
    log_info "Stopping services..."
    docker-compose -f "$COMPOSE_FILE" down "$@"
    log_success "Services stopped"
}

cmd_restart() {
    local service=${1:-}
    if [ -z "$service" ]; then
        log_info "Restarting all services..."
        docker-compose -f "$COMPOSE_FILE" restart
    else
        log_info "Restarting service: $service"
        docker-compose -f "$COMPOSE_FILE" restart "$service"
    fi
    log_success "Services restarted"
}

cmd_logs() {
    local service=${1:-}
    if [ -z "$service" ]; then
        docker-compose -f "$COMPOSE_FILE" logs -f
    else
        docker-compose -f "$COMPOSE_FILE" logs -f "$service"
    fi
}

cmd_shell() {
    local service=${1:-backend}
    log_info "Entering $service shell..."
    docker-compose -f "$COMPOSE_FILE" exec "$service" bash
}

cmd_exec() {
    local service=$1
    shift
    docker-compose -f "$COMPOSE_FILE" exec "$service" "$@"
}

cmd_migrate() {
    log_info "Running database migrations..."
    docker-compose -f "$COMPOSE_FILE" exec backend flask db upgrade
    log_success "Migrations complete"
}

cmd_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="backup_${timestamp}.sql.gz"
    
    log_info "Creating database backup: $backup_file"
    docker-compose -f "$COMPOSE_FILE" exec postgres pg_dump -U schichtplan_user schichtplan | gzip > "$backup_file"
    log_success "Backup created: $backup_file"
}

cmd_restore() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warn "This will overwrite the database. Continue? (y/N)"
    read -r response
    if [ "$response" != "y" ]; then
        log_info "Restore cancelled"
        return
    fi
    
    log_info "Restoring database from: $backup_file"
    zcat "$backup_file" | docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U schichtplan_user schichtplan
    log_success "Database restored"
}

cmd_status() {
    log_info "Service status:"
    docker-compose -f "$COMPOSE_FILE" ps
}

cmd_clean() {
    log_warn "This will remove all containers and volumes. Continue? (y/N)"
    read -r response
    if [ "$response" != "y" ]; then
        log_info "Clean cancelled"
        return
    fi
    
    log_info "Removing containers and volumes..."
    docker-compose -f "$COMPOSE_FILE" down -v
    log_success "Cleanup complete"
}

cmd_debug() {
    log_info "Starting with debug tools enabled..."
    docker-compose -f "$COMPOSE_FILE" --profile debug up -d
    log_success "Debug services started"
    log_info "Available tools:"
    log_info "  - Adminer (DB): http://localhost:8080"
    log_info "  - Redis Commander: http://localhost:8081"
    sleep 2
    cmd_status
}

cmd_prod() {
    log_info "Starting in production mode..."
    ENV_FILE=".env.prod" docker-compose -f "$COMPOSE_FILE" up -d
    log_success "Production services started"
    sleep 2
    cmd_status
}

# Main script
main() {
    check_prerequisites
    
    local command=${1:-help}
    shift || true
    
    case "$command" in
        build)
            cmd_build "$@"
            ;;
        up)
            cmd_up "$@"
            ;;
        down)
            cmd_down "$@"
            ;;
        restart)
            cmd_restart "$@"
            ;;
        logs)
            cmd_logs "$@"
            ;;
        shell)
            cmd_shell "$@"
            ;;
        exec)
            cmd_exec "$@"
            ;;
        migrate)
            cmd_migrate
            ;;
        backup)
            cmd_backup
            ;;
        restore)
            cmd_restore "$@"
            ;;
        status)
            cmd_status
            ;;
        clean)
            cmd_clean
            ;;
        debug)
            cmd_debug
            ;;
        prod)
            cmd_prod
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            usage
            ;;
    esac
}

main "$@"
