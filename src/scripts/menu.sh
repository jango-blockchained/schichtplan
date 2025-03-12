#!/bin/bash

# Function to check if a port is in use
check_port() {
    nc -z localhost $1 >/dev/null 2>&1
}

# Function to kill process using a port
kill_port() {
    pid=$(lsof -t -i:$1)
    if [ ! -z "$pid" ]; then
        echo "Killing process on port $1 (PID: $pid)"
        kill -9 $pid
    fi
}

# Function to restart backend
restart_backend() {
    echo "Restarting backend..."
    kill_port 5000
    sleep 1
    tmux send-keys -t schichtplan:0.0 C-c
    sleep 1
    tmux send-keys -t schichtplan:0.0 "python3 run.py" C-m
    echo "Backend restarted!"
}

# Function to restart frontend
restart_frontend() {
    echo "Restarting frontend..."
    kill_port 5173
    sleep 1
    tmux send-keys -t schichtplan:0.1 C-c
    sleep 1
    tmux send-keys -t schichtplan:0.1 "bun run --watch --hot --bun dev" C-m
    echo "Frontend restarted!"
}

# Function to restart both services
restart_all() {
    restart_backend
    restart_frontend
}

# Function to stop backend
stop_backend() {
    echo "Stopping backend..."
    kill_port 5000
    tmux send-keys -t schichtplan:0.0 C-c
    echo "Backend stopped!"
}

# Function to stop frontend
stop_frontend() {
    echo "Stopping frontend..."
    kill_port 5173
    tmux send-keys -t schichtplan:0.1 C-c
    echo "Frontend stopped!"
}

# Function to stop both services
stop_all() {
    stop_backend
    stop_frontend
}

# Function to close tmux session and stop all services
close_tmux_session() {
    echo "Stopping all services and closing tmux session..."
    
    # Stop all services first
    stop_all
    
    # Sleep to ensure services have time to stop
    sleep 2
    
    # Kill the tmux session
    echo "Closing tmux session..."
    tmux kill-session -t schichtplan 2>/dev/null
    
    # Exit the script
    echo "Session closed."
    exit 0
}

# Function to show development statistics using cloc
show_dev_stats() {
    clear
    echo "=== Schichtplan Development Statistics ==="
    echo ""
    
    # Check if cloc is installed
    if ! command -v cloc &> /dev/null; then
        echo "Error: 'cloc' is not installed on your system."
        echo ""
        echo "Please install cloc first:"
        echo "  Ubuntu/Debian: sudo apt-get install cloc"
        echo "  Mac: brew install cloc"
        echo "  Manual download: https://github.com/AlDanial/cloc"
        echo ""
        return
    fi
    
    # Get the absolute path to the project directory
    # First, get the directory where this script is located
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
    # Then determine the project root (2 levels up from scripts directory)
    PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." &> /dev/null && pwd )"
    
    echo "Project root: $PROJECT_ROOT"
    echo ""
    
    echo "Analyzing backend code..."
    echo "-------------------------------------"
    cloc "$PROJECT_ROOT/src/backend" --exclude-dir=__pycache__,instance --exclude-ext=log,pyc
    
    echo ""
    echo "Analyzing frontend code..."
    echo "-------------------------------------"
    cloc "$PROJECT_ROOT/src/frontend" --exclude-dir=node_modules,dist,build,public --exclude-ext=log
    
    echo ""
    echo "Overall project statistics (excluding common generated files)..."
    echo "-------------------------------------"
    cloc "$PROJECT_ROOT" --exclude-dir=node_modules,dist,build,__pycache__,instance,.venv,.git,.pytest_cache,.mypy_cache --exclude-ext=log,pyc
}

# Main menu loop
while true; do
    clear
    echo "=== Schichtplan Service Control ==="
    echo "1) Restart Backend"
    echo "2) Restart Frontend"
    echo "3) Restart All Services"
    echo "4) Stop Backend"
    echo "5) Stop Frontend"
    echo "6) Stop All Services"
    echo "7) Show Development Statistics"
    echo "8) Close Tmux Session (Stop All)"
    echo "q) Quit"
    echo "=================================="
    
    read -n 1 -p "Select an option: " choice
    echo ""
    
    case $choice in
        1) restart_backend ;;
        2) restart_frontend ;;
        3) restart_all ;;
        4) stop_backend ;;
        5) stop_frontend ;;
        6) stop_all ;;
        7) show_dev_stats ;;
        8) close_tmux_session ;;
        q|Q) exit 0 ;;
        *) echo "Invalid option" ;;
    esac
    
    echo ""
    read -n 1 -p "Press any key to continue..."
done 