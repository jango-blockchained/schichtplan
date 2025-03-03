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

# Function to cleanup and validate service shutdown
cleanup() {
    echo -e "\nGracefully shutting down services..."
    
    # Kill backend (port 5000)
    if check_port 5000; then
        kill_port 5000
        sleep 1
        if ! check_port 5000; then
            echo "✓ Backend successfully stopped"
        else
            echo "! Warning: Backend may still be running"
        fi
    else
        echo "✓ Backend is not running"
    fi
    
    # Kill frontend (port 5173)
    if check_port 5173; then
        kill_port 5173
        sleep 1
        if ! check_port 5173; then
            echo "✓ Frontend successfully stopped"
        else
            echo "! Warning: Frontend may still be running"
        fi
    else
        echo "✓ Frontend is not running"
    fi
    
    # Kill tmux session
    tmux kill-session -t schichtplan 2>/dev/null
    
    echo "Shutdown complete!"
    exit 0
}

# Clean up any existing log files in wrong locations
echo "Cleaning up any misplaced log files..."
find . -name "backend.log" ! -path "./src/logs/*" -delete

# Create required directories with proper structure
echo "Setting up directory structure..."
mkdir -p src/logs
mkdir -p src/instance

# Kill any existing processes
kill_port 5000  # Backend port
kill_port 5173  # Frontend port

# Kill existing tmux session if it exists
tmux kill-session -t schichtplan 2>/dev/null

echo "Starting application in tmux..."

# Create new tmux session
tmux new-session -d -s schichtplan

# Configure first pane (Backend)
tmux send-keys -t schichtplan "cd src/backend" C-m
tmux send-keys -t schichtplan "export FLASK_APP=run.py" C-m
tmux send-keys -t schichtplan "export FLASK_ENV=development" C-m
tmux send-keys -t schichtplan "export DEBUG_MODE=1" C-m
tmux send-keys -t schichtplan "echo 'Starting Backend...'" C-m
tmux send-keys -t schichtplan "python3 run.py" C-m

# Split window vertically
tmux split-window -h

# Configure second pane (Frontend)
tmux send-keys -t schichtplan "cd src/frontend" C-m
tmux send-keys -t schichtplan "echo 'Starting Frontend...'" C-m
tmux send-keys -t schichtplan "bun run --watch --hot --bun dev" C-m

# Set window title
tmux rename-window -t schichtplan "Schichtplan Dev"

# Wait for services to be ready
echo "Waiting for services to start..."

while ! check_port 5000; do
    echo "Waiting for backend..."
    sleep 1
done

while ! check_port 5173; do
    echo "Waiting for frontend..."
    sleep 1
done

echo -e "\nApplication started successfully!"
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo "Logs location: src/logs/backend.log"
echo -e "\nTmux session 'schichtplan' created:"
echo "- Left pane: Backend"
echo "- Right pane: Frontend"
echo -e "\nTo attach to tmux session: tmux attach-session -t schichtplan"
echo "To detach from tmux: press Ctrl+B, then D"
echo "To exit completely: press Ctrl+C in this terminal"
echo ""

# Attach to tmux session
tmux attach-session -t schichtplan

# Wait for Ctrl+C
trap cleanup INT
wait 
