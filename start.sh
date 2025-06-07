#!/bin/bash

# Determine script's absolute directory and cd into it
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd "$SCRIPT_DIR" || { echo "ERROR: Failed to cd to script directory '$SCRIPT_DIR'"; exit 1; }

# Set strict error handling
set -euo pipefail

# Configuration
BACKEND_PORT_MIN=5000
BACKEND_PORT_MAX=5000
FRONTEND_PORT=5173
TMUX_SESSION="schichtplan"
VENV_PATH="src/backend/.venv"
LOG_DIR="src/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
        "DEBUG")
            echo -e "${YELLOW}[DEBUG]${NC} $timestamp - $message"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $timestamp - $message"
            ;;
    esac
}

# Function to check if a port is in use
check_port() {
    nc -z localhost "$1" >/dev/null 2>&1
}

# Function to kill process using a port
kill_port() {
    local port=$1
    
    if check_port "$port"; then
        log "INFO" "Found process(es) on port $port, killing with npx kill-port"
        if sudo npx kill-port "$port" 2>/dev/null; then
            log "INFO" "Successfully killed process(es) on port $port"
            sleep 1
            # Verify port is actually free
            if check_port "$port"; then
                log "ERROR" "Port $port is still in use after killing processes"
                return 1
            else
                log "INFO" "Successfully freed port $port"
            fi
        else
            log "ERROR" "Failed to kill process(es) on port $port using npx kill-port"
            return 1
        fi
    else
        log "INFO" "No processes found using port $port"
    fi
}

# Check for required dependencies
check_dependencies() {
    log "INFO" "Checking dependencies..."
    local missing_deps=()
    
    # Required commands
    local deps=("python3" "bun" "tmux" "nc" "curl")
    for cmd in "${deps[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_deps+=("$cmd")
        fi
    done
    
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
    local venv_exists=false
    if [ -d "$VENV_PATH" ]; then
        log "INFO" "Virtual environment found at $VENV_PATH"
        venv_exists=true
    else
        log "INFO" "Creating virtual environment at $VENV_PATH..."
        python3 -m venv "$VENV_PATH" || {
            log "ERROR" "Failed to create virtual environment"
            exit 1
        }
    fi
    
    # Activate virtual environment
    log "INFO" "Activating virtual environment..."
    source "$VENV_PATH/bin/activate" || {
        log "ERROR" "Failed to activate virtual environment"
        exit 1
    }
    
    # Install requirements ONLY if venv was just created
    if [ "$venv_exists" = false ]; then
        log "INFO" "Installing Python dependencies..."
        pip install -r requirements.txt || {
            log "ERROR" "Failed to install Python dependencies"
            exit 1
        }
        log "INFO" "Python dependencies installed."
    else
        log "INFO" "Skipping dependency installation (venv already exists)."
    fi
}

# Create required directories
create_directories() {
    log "INFO" "Setting up directory structure..."
    local dirs=("$LOG_DIR" "$LOG_DIR/diagnostics" "$LOG_DIR/sessions" "src/instance" "src/scripts")
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir" || {
                log "ERROR" "Failed to create directory: $dir"
                exit 1
            }
            log "INFO" "Created directory: $dir"
        fi
    done
    
    # Ensure the logs directory is writable
    chmod -R 755 "$LOG_DIR" || log "WARN" "Failed to set permissions for $LOG_DIR"
}

# Check and set script permissions
check_permissions() {
    log "INFO" "Checking script permissions..."
    local scripts=("src/scripts/menu.sh" "src/scripts/ngrok_manager.sh")
    for script in "${scripts[@]}"; do
        if [ -f "$script" ]; then
            chmod +x "$script" || {
                log "WARN" "Failed to set permissions for $script"
            }
        else
            log "WARN" "$script not found"
        fi
    done
}

# Check backend health
check_backend_health() {
    local port=$1
    local max_retries=5
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if curl -s "http://localhost:$port/api/health" 2>&1 | grep -q "ok"; then
            return 0
        fi
        sleep 2
        retry=$((retry + 1))
    done
    return 1
}

# Setup tmux session
setup_tmux_session() {
    log "INFO" "Setting up tmux session..."
    
    # Create new tmux session
    tmux new-session -d -s "$TMUX_SESSION" || {
        log "ERROR" "Failed to create tmux session"
        exit 1
    }
    
    # Configure backend pane - start the backend service in background and show tail
    tmux send-keys -t "$TMUX_SESSION" "source $VENV_PATH/bin/activate" C-m
    tmux send-keys -t "$TMUX_SESSION" "export FLASK_APP=src.backend.run" C-m
    tmux send-keys -t "$TMUX_SESSION" "export FLASK_ENV=development" C-m
    tmux send-keys -t "$TMUX_SESSION" "export DEBUG_MODE=1" C-m
    tmux send-keys -t "$TMUX_SESSION" "echo 'Starting Backend in background...'" C-m
    tmux send-keys -t "$TMUX_SESSION" "python3 -m src.backend.run runserver > src/logs/tmux_backend_output.log 2>&1 &" C-m
    tmux send-keys -t "$TMUX_SESSION" "echo 'Backend started. Showing output log:'" C-m
    tmux send-keys -t "$TMUX_SESSION" "tail -f src/logs/tmux_backend_output.log" C-m
    
    # Split window for frontend
    tmux split-window -h
    
    # Configure frontend pane - start the frontend service in background and show tail
    if [ -f "src/frontend/package.json" ]; then
        tmux send-keys -t "$TMUX_SESSION" "cd src/frontend" C-m
        tmux send-keys -t "$TMUX_SESSION" "echo 'Installing frontend dependencies...'" C-m
        tmux send-keys -t "$TMUX_SESSION" "bun install" C-m
        tmux send-keys -t "$TMUX_SESSION" "echo 'Starting Frontend in background...'" C-m
        tmux send-keys -t "$TMUX_SESSION" "npx vite > \"$SCRIPT_DIR/$LOG_DIR/tmux_frontend_output.log\" 2>&1 &" C-m
        tmux send-keys -t "$TMUX_SESSION" "echo 'Frontend started. Showing output log:'" C-m
        tmux send-keys -t "$TMUX_SESSION" "tail -f \"$SCRIPT_DIR/$LOG_DIR/tmux_frontend_output.log\"" C-m
    else
        log "ERROR" "Frontend package.json not found"
        cleanup
        exit 1
    fi
    
    # Split horizontally for menu
    tmux split-window -v -l 10
    
    # Configure menu pane
    tmux send-keys -t "$TMUX_SESSION" "cd $(pwd)" C-m
    tmux send-keys -t "$TMUX_SESSION" "src/scripts/menu.sh" C-m
    
    # Set window title
    tmux rename-window -t "$TMUX_SESSION" "Schichtplan Dev"
}

# Wait for services to start
wait_for_services() {
    log "INFO" "Waiting for services to start..."
    local max_attempts=30
    local attempt=0
    local backend_ready=false
    local backend_port=""
    
    # Add a small delay before starting checks and ensure log files exist
    log "INFO" "Allowing 3 seconds for services to initialize and create log files..."
    sleep 3
    
    # Ensure log files exist for tail -f
    touch "$SCRIPT_DIR/$LOG_DIR/tmux_backend_output.log"
    touch "$SCRIPT_DIR/$LOG_DIR/tmux_frontend_output.log"
    
    # Wait for backend
    while [ $attempt -lt $max_attempts ] && [ "$backend_ready" = false ]; do
        for port in $(seq $BACKEND_PORT_MIN $BACKEND_PORT_MAX); do
            # Check if port is listening first (quicker check)
            if check_port "$port"; then
                # Try to connect to health endpoint and check HTTP status
                http_status=$(curl -o /dev/null -s -w "%{http_code}" "http://localhost:$port/api/v2/health")
                if [ "$http_status" -eq 200 ]; then
                    backend_ready=true
                    backend_port=$port
                    log "INFO" "Backend health check successful on port $port"
                    break
                else
                    log "DEBUG" "Port $port is listening but health check failed (HTTP status: $http_status)"
                fi
            fi
        done
        
        if [ "$backend_ready" = false ]; then
            log "INFO" "Waiting for backend... (attempt $((attempt + 1))/$max_attempts)"
            sleep 2
            attempt=$((attempt + 1))
        fi
    done
    
    if [ "$backend_ready" = false ]; then
        log "ERROR" "Backend did not start successfully within the timeout period."
        log "ERROR" "Check the backend logs at $LOG_DIR/tmux_backend_output.log or in the tmux pane for errors."
        cleanup
        exit 1
    fi
    
    log "INFO" "Backend started successfully on port $backend_port"
    
    # Wait for frontend (add initial delay too)
    log "INFO" "Allowing 5 seconds for frontend to initialize..."
    sleep 5
    attempt=0
    local frontend_ready=false
    
    while [ $attempt -lt $max_attempts ] && [ "$frontend_ready" = false ]; do
        # Check if frontend port is in use - more reliable than HTTP check for Vite
        if check_port "$FRONTEND_PORT"; then
            # Additional check to look for Vite output in the log file
            if grep -q "VITE .* ready" "$SCRIPT_DIR/$LOG_DIR/tmux_frontend_output.log" 2>/dev/null; then
                frontend_ready=true
                log "INFO" "Frontend is running on port $FRONTEND_PORT"
            else
                log "INFO" "Frontend port $FRONTEND_PORT is active but Vite may still be initializing"
            fi
        fi
        
        if [ "$frontend_ready" = false ]; then
            log "INFO" "Waiting for frontend... (attempt $((attempt + 1))/$max_attempts)"
            sleep 2
            attempt=$((attempt + 1))
        fi
    done
    
    if [ "$frontend_ready" = false ]; then
        log "WARN" "Frontend may not have started properly within the timeout period."
        log "WARN" "You may need to start the frontend manually with 'cd src/frontend && bun run dev'"
        log "INFO" "However, continuing startup as the frontend might still be initializing..."
        # Don't exit here, allow the script to continue
    else
        log "INFO" "Frontend started successfully on port $FRONTEND_PORT"
    fi
    
    # Final status message
    log "SUCCESS" "All services started successfully!"
    echo -e "\nAccess URLs:"
    echo "Backend: http://localhost:$backend_port"
    echo "Frontend: http://localhost:$FRONTEND_PORT"
    echo "Logs location: $LOG_DIR/tmux_backend_output.log and $LOG_DIR/tmux_frontend_output.log"
    echo -e "\nTmux session '$TMUX_SESSION' created:"
    echo "- Left pane: Backend (tail -f backend log)"
    echo "- Right pane: Frontend (tail -f frontend log)"
    echo "- Bottom pane: Service Control Menu"
    echo -e "\nTo attach to tmux session: tmux attach-session -t $TMUX_SESSION"
    echo "To detach from tmux: press Ctrl+B, then D"
    echo "To exit completely: press Ctrl+C in this terminal"
    echo -e "\nFor public access via ngrok, use option 8 in the Service Control Menu"
    echo ""
}

# Function to stop existing services without exiting
stop_existing_services() {
    log "INFO" "Stopping any pre-existing services..."
    
    # Kill processes on all potential backend ports
    for port in $(seq $BACKEND_PORT_MIN $BACKEND_PORT_MAX); do
        if check_port "$port"; then
            kill_port "$port"
        fi
    done
    
    # Kill frontend
    if check_port $FRONTEND_PORT; then
        kill_port $FRONTEND_PORT
    fi
    
    # Kill ngrok if running
    if pgrep -f "ngrok" > /dev/null; then
        log "INFO" "Stopping existing ngrok tunnels..."
        pkill -f "ngrok"
        sleep 1
        if pgrep -f "ngrok" > /dev/null; then
            log "WARN" "Existing ngrok processes still running, forcing kill..."
            pkill -9 -f "ngrok"
        fi
    fi
    
    # Kill tmux session if it exists
    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        log "INFO" "Killing existing tmux session $TMUX_SESSION"
        tmux kill-session -t "$TMUX_SESSION"
    fi
    log "INFO" "Pre-existing services stopped."
}

# Function to cleanup and validate service shutdown (called by trap)
cleanup() {
    log "INFO" "Gracefully shutting down services (cleanup trap)..."
    
    # Deactivate virtual environment if active
    if [ -n "${VIRTUAL_ENV:-}" ]; then
        deactivate || log "WARN" "Failed to deactivate virtual environment"
    fi
    
    # Stop services using the dedicated function
    stop_existing_services
    
    log "INFO" "Cleanup complete. Exiting."
    exit 0 # Exit only when called by trap
}

# Function to remove __pycache__ folders
remove_pycache_folders() {
    log "INFO" "Searching for and removing __pycache__ folders (max depth 6)..."
    local found_count=$(find . -maxdepth 6 -type d -name "__pycache__" -print | wc -l)
    
    if [ "$found_count" -gt 0 ]; then
        log "INFO" "Found $found_count __pycache__ folder(s). Removing..."
        # Use -execdir to be slightly safer, operating within the parent directory
        # Exclude .launchpadlib to prevent permission errors
        find . -maxdepth 6 -path './.launchpadlib' -prune -o -type d -name "__pycache__" -exec rm -rf {} + || {
            log "WARN" "Some __pycache__ folders might not have been removed."
            return 1
        }
        log "INFO" "__pycache__ folders removed."
    else
        log "INFO" "No __pycache__ folders found within the specified depth."
    fi
}

# Main function
main() {
    remove_pycache_folders
    check_dependencies
    create_directories
    check_permissions
    setup_venv
    
    # Create or clear log files
    log "INFO" "Preparing log files..."
    : > "$SCRIPT_DIR/$LOG_DIR/tmux_backend_output.log"
    : > "$SCRIPT_DIR/$LOG_DIR/tmux_frontend_output.log"
    
    # Clean up ONLY existing processes before starting new ones
    stop_existing_services
    
    # Start services
    setup_tmux_session
    
    # Wait for services
    wait_for_services
    
    # Attach to tmux session
    tmux attach-session -t "$TMUX_SESSION"
}

# Improve trap handling
trap 'cleanup' INT TERM
trap 'log "ERROR" "An error occurred. Exiting." >&2; cleanup' ERR

# Run main function
main 

# End of script
