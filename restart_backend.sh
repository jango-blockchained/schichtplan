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

# Target port and tmux details
BUN_BACKEND_PORT=5001
TMUX_SESSION="schichtplan"
TMUX_PANE="${TMUX_SESSION}:0.0" # Assuming backend is in the first pane (index 0) of the first window (index 0)

# Check if the tmux session exists
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    echo "Tmux session '$TMUX_SESSION' found. Restarting backend in pane $TMUX_PANE..."
    
    # Optional: Kill process by port first, as a safety measure 
    #           in case something is lingering outside the expected pane.
    kill_port ${BUN_BACKEND_PORT}
    sleep 0.5 

    # Send Ctrl+C to the target pane to stop the current process
    tmux send-keys -t "$TMUX_PANE" C-c
    sleep 1 # Give it a moment to stop

    # Clear the pane before sending the new command (optional, for cleanliness)
    # tmux send-keys -t "$TMUX_PANE" C-l 
    
    # Send the command to start the Bun backend again in the same pane
    # Important: Ensure the pane is in the correct directory. 
    # The start.sh script should have already CD'd into src/bun-backend.
    tmux send-keys -t "$TMUX_PANE" "bun run --watch index.ts" C-m
    
    echo "Restart command sent to tmux pane $TMUX_PANE."
    echo "Check the tmux session to monitor the backend status."
    
    # Note: We can't easily wait and check the status *inside* tmux from here.
    # The user needs to check the tmux pane.

else
    echo "Tmux session '$TMUX_SESSION' not found."
    echo "Please start the application using './start.sh' first."
    # Decide if you want to fall back to the old behavior or just exit.
    # For now, let's just exit.
    exit 1
    
    # --- OLD BEHAVIOR (kept for reference, but commented out) ---
    # echo "Attempting to kill existing bun backend process on port ${BUN_BACKEND_PORT}..."
    # kill_port ${BUN_BACKEND_PORT}
    # echo "Starting bun backend server as a background process..."
    # (cd src/bun-backend && bun run --watch index.ts &)
    # bun_backend_pid=$! 
    # echo "Waiting for bun backend to start on port ${BUN_BACKEND_PORT}..."
    # ... (rest of the old waiting logic) ...
fi

exit 0 