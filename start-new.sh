#!/bin/bash

# Determine script's absolute directory and cd into it
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd "$SCRIPT_DIR" || { echo "ERROR: Failed to cd to script directory '$SCRIPT_DIR'"; exit 1; }

# Set strict error handling
set -euo pipefail

# Configuration
VENV_PATH="src/backend/.venv"
LOG_DIR="src/logs"

# Command line options
USE_LEGACY_TMUX=false
START_MCP_SERVER=false
START_CONVERSATIONAL_AI=true
AUTO_START_SERVICES=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --legacy|--tmux)
            USE_LEGACY_TMUX=true
            shift
            ;;
        --with-mcp|--mcp)
            START_MCP_SERVER=true
            shift
            ;;
        --with-conversational-ai|--conversational-ai)
            START_CONVERSATIONAL_AI=true
            shift
            ;;
        --no-conversational-ai)
            START_CONVERSATIONAL_AI=false
            shift
            ;;
        --no-auto-start)
            AUTO_START_SERVICES=false
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --legacy, --tmux                          Use legacy tmux interface (not recommended)"
            echo "  --with-mcp, --mcp                         Enable MCP server"
            echo "  --with-conversational-ai                  Enable conversational AI (default)"
            echo "  --no-conversational-ai                    Disable conversational AI"
            echo "  --no-auto-start                           Don't auto-start services in TUI"
            echo "  --help, -h                                Show this help message"
            echo ""
            echo "New Modern TUI Features:"
            echo "  - Real-time service status monitoring"
            echo "  - Live log streaming with filtering"
            echo "  - CPU and memory usage tracking"
            echo "  - Health check dashboard"
            echo "  - Interactive service controls"
            echo "  - Keyboard shortcuts (q:quit, r:restart all, s:stop all)"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Logging function
log() {
    local level=$1
    shift
    local message=$*
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} $timestamp - $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $timestamp - $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $timestamp - $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $timestamp - $message"
            ;;
    esac
}

# Check for required dependencies
check_dependencies() {
    log "INFO" "Checking dependencies..."
    local missing_deps=()
    
    # Required commands
    local deps=("python3" "bun")
    for cmd in "${deps[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
    # Check for Redis if conversational AI is enabled
    if [ "$START_CONVERSATIONAL_AI" = true ]; then
        if ! command -v "redis-server" &> /dev/null; then
            missing_deps+=("redis-server")
        fi
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log "ERROR" "Missing required dependencies: ${missing_deps[*]}"
        log "ERROR" "Please install the missing dependencies and try again"
        exit 1
    fi
    
    # Check Python version
    if ! python3 -c "import sys; assert sys.version_info >= (3, 8), 'Python 3.8+ required'" 2>/dev/null; then
        log "ERROR" "Python 3.8 or higher is required"
        exit 1
    fi
    
    log "INFO" "All dependencies are satisfied"
}

# Create and setup virtual environment
setup_venv() {
    if [ -d "$VENV_PATH" ]; then
        log "INFO" "Virtual environment found at $VENV_PATH"
    else
        log "INFO" "Creating virtual environment at $VENV_PATH..."
        python3 -m venv "$VENV_PATH" || {
            log "ERROR" "Failed to create virtual environment"
            exit 1
        }
        
        # Install backend requirements
        log "INFO" "Installing backend dependencies..."
        "$VENV_PATH/bin/pip" install -r src/backend/requirements.txt || {
            log "ERROR" "Failed to install backend dependencies"
            exit 1
        }
    fi
    
    # Check if TUI dependencies are installed
    if ! "$VENV_PATH/bin/python" -c "import textual" 2>/dev/null; then
        log "INFO" "Installing TUI dependencies..."
        "$VENV_PATH/bin/pip" install -r requirements-tui.txt || {
            log "ERROR" "Failed to install TUI dependencies"
            exit 1
        }
    fi
}

# Create required directories
create_directories() {
    log "INFO" "Setting up directory structure..."
    local dirs=("$LOG_DIR" "$LOG_DIR/diagnostics" "$LOG_DIR/sessions" "src/instance")
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir" || {
                log "ERROR" "Failed to create directory: $dir"
                exit 1
            }
            log "INFO" "Created directory: $dir"
        fi
    done
}

# Check and start Redis server if conversational AI is enabled
check_and_start_redis() {
    if [ "$START_CONVERSATIONAL_AI" = true ]; then
        log "INFO" "Checking Redis server status..."
        
        if pgrep -x "redis-server" > /dev/null; then
            log "INFO" "Redis server is already running"
        else
            log "INFO" "Starting Redis server..."
            redis-server --daemonize yes --port 6379
            sleep 2
            
            if python3 -c "import redis; r = redis.Redis(host='localhost', port=6379, db=0); r.ping()" 2>/dev/null; then
                log "SUCCESS" "Redis server started successfully"
            else
                log "ERROR" "Failed to start Redis server"
                exit 1
            fi
        fi
    fi
}

# Function to remove __pycache__ folders
remove_pycache_folders() {
    log "INFO" "Cleaning __pycache__ folders..."
    find . -maxdepth 6 -path './.launchpadlib' -prune -o -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    log "INFO" "__pycache__ folders cleaned"
}

# Main function
main() {
    log "INFO" "Starting Schichtplan Development Environment"
    
    if [ "$USE_LEGACY_TMUX" = true ]; then
        log "WARN" "Using legacy tmux interface (consider upgrading to new TUI)"
        exec bash "$SCRIPT_DIR/start-legacy.sh" "$@"
        exit 0
    fi
    
    log "INFO" "Using modern Textual TUI interface"
    
    remove_pycache_folders
    check_dependencies
    create_directories
    setup_venv
    check_and_start_redis
    
    # Export configuration for TUI
    export SCHICHTPLAN_MCP_ENABLED="$START_MCP_SERVER"
    export SCHICHTPLAN_CONVERSATIONAL_AI_ENABLED="$START_CONVERSATIONAL_AI"
    export SCHICHTPLAN_AUTO_START="$AUTO_START_SERVICES"
    
    log "SUCCESS" "Environment ready. Launching Development Manager TUI..."
    echo ""
    echo "================================================================"
    echo "  Schichtplan Development Manager - Professional TUI"
    echo "================================================================"
    echo ""
    echo "  Keyboard Shortcuts:"
    echo "    q          - Quit and stop all services"
    echo "    r          - Restart all services"
    echo "    s          - Stop all services"
    echo "    l          - Show logs tab"
    echo "    h          - Show health tab"
    echo "    Ctrl+C     - Force quit"
    echo ""
    echo "  Features:"
    echo "    ✓ Real-time service monitoring"
    echo "    ✓ Live log streaming"
    echo "    ✓ CPU/Memory tracking"
    echo "    ✓ Interactive controls"
    echo ""
    echo "================================================================"
    echo ""
    sleep 2
    
    # Launch TUI
    "$VENV_PATH/bin/python" dev_manager.py
}

# Trap for cleanup
trap 'log "INFO" "Exiting..."; exit 0' INT TERM

# Run main function
main
