#!/bin/bash

# Default backend type
DEFAULT_BACKEND="python" # Options: python, localStorage

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

# Process command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --backend=*)
      BACKEND="${1#*=}"
      shift
      ;;
    --python)
      BACKEND="python"
      shift
      ;;
    --localStorage)
      BACKEND="localStorage"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./start.sh [--backend=python|localStorage] [--python] [--localStorage]"
      exit 1
      ;;
  esac
done

# Set backend type to default if not specified
BACKEND=${BACKEND:-$DEFAULT_BACKEND}

echo "Using backend: $BACKEND"

# Clean up any existing log files in wrong locations
echo "Cleaning up any misplaced log files..."
find . -name "backend.log" ! -path "./src/logs/*" -delete

# Create required directories with proper structure
echo "Setting up directory structure..."
mkdir -p src/logs
mkdir -p src/instance
mkdir -p src/scripts
mkdir -p src/localStorage/data

# Ensure menu and ngrok scripts are executable
chmod +x src/scripts/menu.sh
if [ -f src/scripts/ngrok_manager.sh ]; then
    chmod +x src/scripts/ngrok_manager.sh
fi

# Kill any existing processes
kill_port 5000  # Backend port
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

# Configure first pane based on selected backend
if [ "$BACKEND" = "localStorage" ]; then
    # Start localStorage backend
    tmux send-keys -t schichtplan "cd src/localStorage" C-m
    tmux send-keys -t schichtplan "echo 'Starting localStorage Backend...'" C-m
    tmux send-keys -t schichtplan "bun run dev" C-m
else
    # Start Python backend
    tmux send-keys -t schichtplan "cd src/backend" C-m
    tmux send-keys -t schichtplan "export FLASK_APP=run.py" C-m
    tmux send-keys -t schichtplan "export FLASK_ENV=development" C-m
    tmux send-keys -t schichtplan "export DEBUG_MODE=1" C-m
    tmux send-keys -t schichtplan "echo 'Starting Python Backend...'" C-m
    # Use --auto-port and --kill options to handle port conflicts automatically
    tmux send-keys -t schichtplan "python3 run.py --auto-port --kill" C-m
fi

# Split window vertically for frontend
tmux split-window -h

# Configure second pane (Frontend)
tmux send-keys -t schichtplan "cd src/frontend" C-m

# Set environment variable for frontend based on backend selection
if [ "$BACKEND" = "localStorage" ]; then
    tmux send-keys -t schichtplan "echo 'VITE_BACKEND_TYPE=localStorage' > .env.local" C-m
else
    tmux send-keys -t schichtplan "echo 'VITE_BACKEND_TYPE=python' > .env.local" C-m
fi

tmux send-keys -t schichtplan "echo 'Starting Frontend...'" C-m
tmux send-keys -t schichtplan "bun run --watch --hot --bun dev" C-m

# Split horizontally for menu pane with specific size
tmux split-window -v -l 10

# Configure third pane (Menu)
tmux send-keys -t schichtplan "cd $(pwd)" C-m
tmux send-keys -t schichtplan "BACKEND=$BACKEND src/scripts/menu.sh" C-m

# Set window title
tmux rename-window -t schichtplan "Schichtplan Dev ($BACKEND)"

# Wait for the backend to be ready (on any port)
echo "Waiting for services to start..."
max_attempts=30
attempt=0
backend_ready=false

while [ $attempt -lt $max_attempts ] && [ "$backend_ready" = false ]; do
    # Check if backend is running
    if curl -s http://localhost:5000/api/health >/dev/null 2>&1; then
        backend_ready=true
        backend_port=5000
    else
        # Check other potential ports if 5000 isn't available
        for port in {5001..5020}; do
            if curl -s http://localhost:$port/api/health >/dev/null 2>&1; then
                backend_ready=true
                backend_port=$port
                break
            fi
        done
    fi
    
    if [ "$backend_ready" = false ]; then
        echo "Waiting for backend..."
        sleep 1
        attempt=$((attempt + 1))
    fi
done

if [ "$backend_ready" = false ]; then
    echo "Backend did not start within the timeout period."
    echo "Check the backend logs for errors."
else
    echo "Backend started on port $backend_port"
fi

# Wait for frontend to be ready
attempt=0
frontend_ready=false

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
else
    echo "Frontend started on port 5173"
fi

echo -e "\nApplication started successfully!"
echo "Backend: http://localhost:${backend_port:-5000} (${BACKEND})"
echo "Frontend: http://localhost:5173"

if [ "$BACKEND" = "localStorage" ]; then
    echo "Data location: src/localStorage/data"
else
    echo "Logs location: src/logs/backend.log"
fi

echo -e "\nTmux session 'schichtplan' created:"
echo "- Left pane: Backend ($BACKEND)"
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
