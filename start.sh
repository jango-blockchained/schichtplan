#!/bin/bash

# Enable command echoing for debugging
set -x 

# Function to check if a port is in use
check_port() {
    nc -z localhost $1 >/dev/null 2>&1
}

# Function to kill process using a port or command signature
kill_port() {
    local port=$1
    # Define the specific command pattern for the backend process
    # Ensure this matches the command used in the tmux pane!
    local cmd_pattern="bun run --watch index.ts"
    local pid=""

    echo "DEBUG: Trying to find PID for port $port using ss..."
    # Try ss first (fastest)
    pid=$(ss -lntp sport = :$port | grep -oP 'pid=\K\d+' | head -n 1)

    if [ ! -z "$pid" ]; then
        echo "DEBUG: Found PID $pid using ss for port $port."
        echo "Killing process on port $port (PID: $pid)"
        kill -9 "$pid"
        sleep 0.5
    else
        echo "DEBUG: ss failed or found no process for port $port. Trying pkill with pattern '$cmd_pattern'..."
        # Try pkill based on the command pattern
        # Use pgrep first to find PIDs without killing immediately, just for logging
        pgrep -f "$cmd_pattern" | while read -r p;
        do 
            echo "DEBUG: Found process matching pattern with PID: $p. Killing..."
            kill -9 "$p"
        done
        sleep 0.5 # Give time for processes to terminate
        
        echo "DEBUG: lsof check skipped."
    fi
    echo "DEBUG: Kill attempt for port $port finished."
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

# Clean up any misplaced log files
echo "Cleaning up any misplaced log files..."
find . -name "backend.log" ! -path "./src/logs/*" -delete

# Create required directories with proper structure
echo "Setting up directory structure..."
mkdir -p src/logs
mkdir -p src/instance
mkdir -p src/scripts
echo "DEBUG: Directory structure done."

# Ensure menu and ngrok scripts are executable
echo "DEBUG: Setting menu.sh executable..."
chmod +x src/scripts/menu.sh
echo "DEBUG: menu.sh chmod done."

echo "DEBUG: Checking/setting ngrok_manager.sh executable..."
if [ -f src/scripts/ngrok_manager.sh ]; then
    chmod +x src/scripts/ngrok_manager.sh
fi
echo "DEBUG: ngrok_manager.sh check/chmod done."

# Kill any existing processes
echo "DEBUG: Killing port 5001..."
kill_port 5001  # Bun Backend port
echo "DEBUG: Killing port 5173..."
kill_port 5173  # Frontend port
echo "DEBUG: Port killing done."

# Kill existing ngrok processes
echo "DEBUG: Killing ngrok processes..."
if pgrep -f "ngrok" > /dev/null; then
    echo "Stopping existing ngrok processes..."
    pkill -f "ngrok"
fi
echo "DEBUG: ngrok killing done."

# Kill existing tmux session if it exists
echo "DEBUG: Killing tmux session..."
tmux kill-session -t schichtplan 2>/dev/null
echo "DEBUG: tmux killing done."

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

# Disable command echoing after debugging section if desired
# set +x 
