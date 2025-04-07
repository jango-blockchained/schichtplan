#!/bin/bash

# Function to check if a port is in use
check_port() {
    nc -z localhost $1 >/dev/null 2>&1
}

# Function to reliably stop process in a tmux pane (without lsof)
# Usage: stop_process_in_pane <pane_id> <port_to_check> <pgrep_pattern> <working_dir>
stop_process_in_pane() {
    local pane_id="$1"
    local port="$2"
    local pattern="$3"
    local cwd="$4"
    local max_wait=5 # seconds to wait for graceful shutdown
    local count=0

    echo "Attempting to stop process in pane $pane_id (Pattern: '$pattern' in '$cwd')"

    # Send Ctrl+C first for graceful shutdown
    tmux send-keys -t "$pane_id" C-c
    sleep 0.5 # Give it a moment to react

    # Check if process terminated gracefully
    while [ $count -lt $max_wait ]; do
        # Check if process matching pattern is still running in the specific CWD
        local running_pids=$(pgrep -f "$pattern")
        local pid_in_cwd=""
        if [ -n "$running_pids" ]; then
            for pid in $running_pids; do
                if command -v pwdx &> /dev/null && [ -e "/proc/$pid" ]; then
                    if pwdx "$pid" 2>/dev/null | grep -q " $cwd\$"; then
                        pid_in_cwd=$pid
                        break
                    fi
                else
                    if pgrep -f "$pattern" > /dev/null; then
                       pid_in_cwd="unknown_pid_check_port"
                    fi
                    break
                fi
            done
        fi

        if [ -z "$pid_in_cwd" ] && ! check_port "$port"; then
             echo "Process in pane $pane_id stopped gracefully (pattern/port check)."
             return 0
        fi
        echo "Waiting for process in pane $pane_id to stop... ($count/$max_wait)"
        sleep 1
        count=$((count + 1))
    done

    echo "Graceful stop failed or timed out for pane $pane_id. Attempting force kill..."

    # Fallback: Kill by pattern
    echo "Attempting force kill by pattern '$pattern'..."
    # Check if process matching pattern exists before killing
    if pgrep -f "$pattern" > /dev/null; then
       pkill -9 -f "$pattern"
       sleep 0.5 # Give kill command time
    else
       echo "No process found matching pattern '$pattern' to kill."
    fi

    # Final check (process pattern and port)
    if ! pgrep -f "$pattern" > /dev/null && ! check_port "$port"; then
        echo "Force kill attempt finished for pane $pane_id. Process likely stopped."
        return 0
    else
        echo "Error: Failed to definitively stop process in pane $pane_id after all attempts."
        if check_port "$port"; then
           echo "Port $port is still occupied."
        fi
        if pgrep -f "$pattern" > /dev/null; then
           echo "Process matching pattern '$pattern' is still running."
        fi
        return 1
    fi
}

# Function to restart backend
restart_backend() {
    echo "Restarting backend..."
    local pane_id="schichtplan:0.0"
    local port=5001
    # Use the specific command run in start.sh
    local pattern="NODE_ENV=development bun run --watch index.ts"
    # !! Adjust this path if your workspace root is different !!
    local cwd="/home/jango/Git/schichtplan/src/bun-backend"

    # Ensure the pane is selected and clear any previous input/output
    tmux select-pane -t "$pane_id"
    # tmux send-keys -t "$pane_id" C-l # Optional: Clear screen

    if stop_process_in_pane "$pane_id" "$port" "$pattern" "$cwd"; then
        echo "Old backend process stopped. Sending restart command..."
        # Send the command to restart the backend
        tmux send-keys -t "$pane_id" "echo '--- Restarting Backend ---';" C-m # Indicate restart in pane
        tmux send-keys -t "$pane_id" "$pattern" C-m
        echo "Backend restart command sent."
    else
        echo "Error: Failed to stop the old backend process. Restart aborted."
    fi
}

# Function to restart frontend
restart_frontend() {
    echo "Restarting frontend..."
    local pane_id="schichtplan:0.1"
    local port=5173
    # Use the specific command run in start.sh
    local pattern="bun run --watch --hot --bun dev"
    # !! Adjust this path if your workspace root is different !!
    local cwd="/home/jango/Git/schichtplan/src/frontend"

    # Ensure the pane is selected
    tmux select-pane -t "$pane_id"

    if stop_process_in_pane "$pane_id" "$port" "$pattern" "$cwd"; then
        echo "Old frontend process stopped. Sending restart command..."
        # Send the command to restart the frontend
        tmux send-keys -t "$pane_id" "echo '--- Restarting Frontend ---';" C-m
        tmux send-keys -t "$pane_id" "$pattern" C-m
        echo "Frontend restart command sent."
    else
        echo "Error: Failed to stop the old frontend process. Restart aborted."
    fi
}

# Function to restart both services
restart_all() {
    echo "--- Restarting All Services ---"
    restart_backend
    sleep 1 # Optional delay between restarts
    restart_frontend
    echo "--- Restart All Complete ---"
}

# Function to stop backend (using new helper)
stop_backend() {
    echo "Stopping backend..."
    local pane_id="schichtplan:0.0"
    local port=5001
    local pattern="NODE_ENV=development bun run --watch index.ts"
    local cwd="/home/jango/Git/schichtplan/src/bun-backend"
    if stop_process_in_pane "$pane_id" "$port" "$pattern" "$cwd"; then
        echo "Backend stopped successfully."
    else
        echo "Failed to stop backend."
    fi
}

# Function to stop frontend (using new helper)
stop_frontend() {
    echo "Stopping frontend..."
    local pane_id="schichtplan:0.1"
    local port=5173
    local pattern="bun run --watch --hot --bun dev"
    local cwd="/home/jango/Git/schichtplan/src/frontend"
    if stop_process_in_pane "$pane_id" "$port" "$pattern" "$cwd"; then
        echo "Frontend stopped successfully."
    else
        echo "Failed to stop frontend."
    fi
}

# Function to stop both services
stop_all() {
    echo "--- Stopping All Services ---"
    stop_backend
    stop_frontend
    echo "--- Stop All Complete ---"
}

# Function to close tmux session and stop all services
# (Calls the updated stop_all)
close_tmux_session() {
    echo "Stopping all services and closing tmux session..."

    # Stop all services first
    stop_all

    # Sleep to ensure services have time to stop gracefully if possible
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
    echo "=== Schichtplan Development Statistics ===="
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
    # Adjust path relative to project root
    cloc "$PROJECT_ROOT/src/bun-backend" --exclude-dir=node_modules,db,migrations --exclude-ext=log,lockb,json,env
    # cloc "$PROJECT_ROOT/src/backend" --exclude-dir=__pycache__,instance --exclude-ext=log,pyc # Old Flask backend example

    echo ""
    echo "Analyzing frontend code..."
    echo "-------------------------------------"
    cloc "$PROJECT_ROOT/src/frontend" --exclude-dir=node_modules,dist,build,public --exclude-ext=log,lockb,json,env

    echo ""
    echo "Overall project statistics (excluding common generated files)..."
    echo "-------------------------------------"
    cloc "$PROJECT_ROOT" --exclude-dir=node_modules,dist,build,__pycache__,instance,.venv,.git,.pytest_cache,.mypy_cache,logs,.vscode,.cursor --exclude-ext=log,pyc,lockb,env,mdc,db
}

# Source the ngrok manager script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Check if ngrok_manager.sh exists before sourcing
if [ -f "$SCRIPT_DIR/ngrok_manager.sh" ]; then
    source "$SCRIPT_DIR/ngrok_manager.sh"
else
    echo "Warning: ngrok_manager.sh not found. Ngrok functionality will be unavailable."
    # Define dummy functions if ngrok_manager is missing to avoid errors
    ngrok_main() { echo "Ngrok manager script not found."; }
fi

# Function to show the ngrok menu
show_ngrok_menu() {
    # Check if the main ngrok function exists (from sourced script)
    if ! command -v ngrok_main &> /dev/null; then
         echo "Ngrok manager script not found or failed to source. Cannot show menu."
         sleep 2
         return
    fi

    while true; do
        clear
        echo "=== Ngrok Public Access Menu ==="
        echo "1) Start Backend Public Access (Port 5001)"
        echo "2) Start Frontend Public Access (Port 5173)"
        echo "3) Start All Public Access"
        echo "4) Stop Backend Public Access"
        echo "5) Stop Frontend Public Access"
        echo "6) Stop All Public Access"
        echo "7) Show Public URLs/Status"
        echo "8) Back to Main Menu"
        echo "=================================="

        read -n 1 -p "Select an option: " choice
        echo "" # Newline after input

        case $choice in
            1) ngrok_main start backend 5001 ;; # Pass port explicitly if needed by ngrok_main
            2) ngrok_main start frontend 5173 ;; # Pass port explicitly
            3) ngrok_main start ;;
            4) ngrok_main stop backend ;;
            5) ngrok_main stop frontend ;;
            6) ngrok_main stop ;;
            7) ngrok_main status ;;
            8) return ;;
            *) echo "Invalid option" ;;
        esac

        echo ""
        read -n 1 -p "Press any key to continue..."
    done
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
    echo "8) Public Access (Ngrok)"
    echo "9) Close Tmux Session (Stop All)"
    echo "q) Quit Menu Script"
    echo "=================================="

    read -n 1 -p "Select an option: " choice
    echo "" # Newline after input

    case $choice in
        1) restart_backend ;;
        2) restart_frontend ;;
        3) restart_all ;;
        4) stop_backend ;;
        5) stop_frontend ;;
        6) stop_all ;;
        7) show_dev_stats ;;
        8) show_ngrok_menu ;;
        9) close_tmux_session ;; # This function now exits the script
        q|Q) echo "Exiting menu script."; exit 0 ;; # Allow quitting the menu script itself
        *) echo "Invalid option" ;;
    esac

    # Only prompt to continue if not exiting
    if [[ ! "$choice" =~ ^[qQ9]$ ]]; then
        echo ""
        read -n 1 -p "Press any key to continue..."
    fi
done 