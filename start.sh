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
        # Add a small delay to allow the port to free up
        sleep 0.5
    fi
}

# Function to cleanup and validate service shutdown
cleanup() {
    echo -e "\nGracefully shutting down services..."
    
    # Kill Bun Backend (port 5001)
    if check_port 5001; then
        kill_port 5001
        sleep 1 # Give time for port to release
        if ! check_port 5001; then
            echo "✓ Bun Backend successfully stopped"
        else
            echo "! Warning: Bun Backend may still be running (port 5001)"
        fi
    else
        echo "✓ Bun Backend is not running"
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
    
    # Kill ngrok if running
    if pgrep -f "ngrok" > /dev/null; then
        echo "Stopping ngrok tunnels..."
        pkill -f "ngrok"
        echo "✓ Ngrok tunnels stopped"
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
mkdir -p src/scripts

# Ensure menu and ngrok scripts are executable
chmod +x src/scripts/menu.sh
if [ -f src/scripts/ngrok_manager.sh ]; then
    chmod +x src/scripts/ngrok_manager.sh
fi

# Kill any existing processes
kill_port 5001  # Bun Backend port
kill_port 5173  # Frontend port

# Kill existing ngrok processes
if pgrep -f "ngrok" > /dev/null; then
    echo "Stopping existing ngrok processes..."
    pkill -f "ngrok"
fi

# Kill existing tmux session if it exists
tmux kill-session -t schichtplan 2>/dev/null

echo "Starting application in tmux..."

# Create new tmux session
tmux new-session -d -s schichtplan

# Configure first pane (Bun Backend)
tmux send-keys -t schichtplan "cd src/bun-backend" C-m
tmux send-keys -t schichtplan "echo 'Starting Bun Backend... (NODE_ENV=development)'" C-m
tmux send-keys -t schichtplan "NODE_ENV=development bun run --watch index.ts" C-m

# Split window vertically for frontend
tmux split-window -h

# Configure second pane (Frontend)
tmux send-keys -t schichtplan "cd src/frontend" C-m
tmux send-keys -t schichtplan "echo 'Starting Frontend...'" C-m
tmux send-keys -t schichtplan "bun run --watch --hot --bun dev" C-m

# Split horizontally for menu pane with specific size
tmux split-window -v -l 10

# Configure third pane (Menu)
tmux send-keys -t schichtplan "cd $(pwd)" C-m
tmux send-keys -t schichtplan "src/scripts/menu.sh" C-m

# Set window title
tmux rename-window -t schichtplan "Schichtplan Dev"

# Wait for the backend to be ready (on any port)
echo "Waiting for services to start..."
max_attempts=30
attempt=0
backend_ready=false
backend_port=5001 # Default bun backend port

while [ $attempt -lt $max_attempts ] && [ "$backend_ready" = false ]; do
    # Check if bun backend is running on port 5001
    # Use curl's --fail to return non-zero on HTTP errors, check for expected status
    if curl -sf http://localhost:${backend_port}/ | grep -q '"status":"Bun backend running"'; then
        backend_ready=true
    else
        # Bun backend doesn't auto-select ports like Flask was configured to.
        # If we needed to check other ports, logic would go here.
        # For now, we just wait for 5001.
        echo "Waiting for bun backend on port ${backend_port}..."
        sleep 1
        attempt=$((attempt + 1))
    fi
done

if [ "$backend_ready" = false ]; then
    echo "Bun Backend did not start within the timeout period on port ${backend_port}."
    echo "Check the bun backend logs/output for errors."
    # Exit if backend failed
    tmux kill-session -t schichtplan 2>/dev/null # Clean up tmux session
    exit 1
else
    echo "✓ Bun Backend started successfully on port $backend_port"
fi

# Wait for frontend to be ready
attempt=0
frontend_ready=false
max_attempts=30 # Reset max attempts for frontend check

while [ $attempt -lt $max_attempts ] && [ "$frontend_ready" = false ]; do
    if check_port 5173; then
        frontend_ready=true
    else
        echo "Waiting for frontend..."
        sleep 1
        attempt=$((attempt + 1))
    fi
done

if [ "$frontend_ready" = false ]; then
    echo "Frontend did not start within the timeout period."
    echo "Check the frontend logs for errors."
    # Exit if frontend failed
    tmux kill-session -t schichtplan 2>/dev/null # Clean up tmux session
    exit 1
else
    echo "✓ Frontend started successfully on port 5173"
fi

echo -e "\nApplication started successfully!"
echo "Bun Backend: http://localhost:$backend_port"
echo "Frontend: http://localhost:5173"
# Note: Bun backend might log to stdout/stderr in tmux pane, not a file by default.
echo "Logs location: Check tmux panes"
echo -e "\nTmux session 'schichtplan' created:"
echo "- Left pane: Bun Backend"
echo "- Right pane: Frontend"
echo "- Bottom pane: Service Control Menu"
echo -e "\nTo attach to tmux session: tmux attach-session -t schichtplan"
echo "To detach from tmux: press Ctrl+B, then D"
echo "To exit completely: press Ctrl+C in this terminal"
echo -e "\nFor public access via ngrok, use option 8 in the Service Control Menu"
echo ""

# Attach to tmux session
tmux attach-session -t schichtplan

# Wait for Ctrl+C
trap cleanup INT
wait 
