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
    tmux send-keys -t schichtplan:0.0 C-c
    sleep 1
    tmux send-keys -t schichtplan:0.0 "python3 -m src.backend.run runserver" C-m
    echo "Backend restart initiated!"
    tail -f src/logs/tmux_backend_output.log
}

# Function to restart frontend
restart_frontend() {
    echo "Restarting frontend..."
    kill_port 5173
    sleep 1
    tmux send-keys -t schichtplan:0.1 C-c
    sleep 1
    tmux send-keys -t schichtplan:0.1 "npx vite" C-m
    echo "Frontend restart initiated!"
    tail -f src/logs/tmux_frontend_output.log
}

# Function to restart both services
restart_all() {
    restart_backend
    restart_frontend
    echo "Displaying combined logs after restarting all services:"
    tail -f src/logs/tmux_backend_output.log &
    tail -f src/logs/tmux_frontend_output.log &
    echo "
Press Ctrl+C to stop tailing logs."
}

# Function to stop backend
stop_backend() {
    echo "Stopping backend..."
    tmux send-keys -t schichtplan:0.0 C-c
    echo "Backend stop signal sent via C-c."
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

# Source the ngrok manager script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
source "$SCRIPT_DIR/ngrok_manager.sh"

# Function to show the ngrok menu
show_ngrok_menu() {
    while true; do
        clear
        echo "=== Ngrok Public Access Menu ==="
        echo "1) Start Backend Public Access"
        echo "2) Start Frontend Public Access"
        echo "3) Start All Public Access"
        echo "4) Stop Backend Public Access"
        echo "5) Stop Frontend Public Access"
        echo "6) Stop All Public Access"
        echo "7) Show Public URLs"
        echo "8) Back to Main Menu"
        echo "=================================="
        
        read -n 1 -p "Select an option: " choice
        echo ""
        
        case $choice in
            1) ngrok_main start backend ;;
            2) ngrok_main start frontend ;;
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

# Function to restart MCP server
restart_mcp_server() {
    echo "Restarting MCP server..."
    kill_port 8001  # Default MCP port
    kill_port 8002  # Alternative MCP port
    sleep 1
    
    # Check if there's a tmux session with MCP server
    if tmux list-sessions 2>/dev/null | grep -q "schichtplan"; then
        # Try to find and restart MCP in tmux if it exists
        if tmux list-panes -t schichtplan -F "#{pane_current_command}" 2>/dev/null | grep -q "mcp_server"; then
            echo "Restarting MCP server in tmux..."
            # Find the MCP pane and restart
            for pane in $(tmux list-panes -t schichtplan -F "#{pane_index}"); do
                cmd=$(tmux display-message -t schichtplan:0.$pane -p "#{pane_current_command}")
                if [[ "$cmd" == *"mcp_server"* ]] || [[ "$cmd" == *"tail"* ]]; then
                    tmux send-keys -t schichtplan:0.$pane C-c
                    sleep 1
                    tmux send-keys -t schichtplan:0.$pane "cd \$(pwd)" C-m
                    tmux send-keys -t schichtplan:0.$pane "source src/backend/.venv/bin/activate" C-m
                    tmux send-keys -t schichtplan:0.$pane "python3 src/backend/mcp_server.py --transport sse --port 8001 > src/logs/tmux_mcp_output.log 2>&1 &" C-m
                    tmux send-keys -t schichtplan:0.$pane "tail -f src/logs/tmux_mcp_output.log" C-m
                    break
                fi
            done
        else
            echo "No MCP server found in tmux session."
            echo "You can start it manually: python3 src/backend/mcp_server.py --transport sse"
        fi
    else
        echo "No tmux session found. Starting standalone MCP server..."
        cd "$(dirname "$0")/../.."
        source src/backend/.venv/bin/activate
        python3 src/backend/mcp_server.py --transport sse --port 8001 &
        echo "MCP server started on port 8001"
    fi
}

# Function to stop MCP server
stop_mcp_server() {
    echo "Stopping MCP server..."
    kill_port 8001
    kill_port 8002
    
    # Also try to stop it in tmux if running there
    if tmux list-sessions 2>/dev/null | grep -q "schichtplan"; then
        for pane in $(tmux list-panes -t schichtplan -F "#{pane_index}"); do
            cmd=$(tmux display-message -t schichtplan:0.$pane -p "#{pane_current_command}")
            if [[ "$cmd" == *"mcp_server"* ]] || [[ "$cmd" == *"tail"* ]]; then
                tmux send-keys -t schichtplan:0.$pane C-c
                break
            fi
        done
    fi
    
    echo "MCP server stopped."
}

# Function to show MCP server status
show_mcp_status() {
    echo "=== MCP Server Status ==="
    echo ""
    
    # Check if MCP server is running on common ports
    for port in 8001 8002; do
        if check_port $port; then
            echo "✓ MCP server running on port $port"
            echo "  - SSE endpoint: http://localhost:$port/sse"
            echo "  - HTTP endpoint: http://localhost:$port/mcp"
        else
            echo "✗ No MCP server on port $port"
        fi
    done
    
    echo ""
    echo "Available MCP transports:"
    echo "  - stdio: python3 src/backend/mcp_server.py"
    echo "  - SSE: python3 src/backend/mcp_server.py --transport sse --port 8001"
    echo "  - HTTP: python3 src/backend/mcp_server.py --transport http --port 8002"
    echo ""
    echo "For external AI tools, use:"
    echo "  - Connect via stdio for direct communication"
    echo "  - Connect via SSE/HTTP for network access"
}

# Function to show MCP server menu
show_mcp_menu() {
    while true; do
        clear
        echo "=== MCP Server Control ==="
        echo "1) Start MCP Server (SSE mode)"
        echo "2) Start MCP Server (HTTP mode)"
        echo "3) Start MCP Server (stdio mode)"
        echo "4) Restart MCP Server"
        echo "5) Stop MCP Server"
        echo "6) Show MCP Status"
        echo "7) Test MCP Connection"
        echo "8) Back to Main Menu"
        echo "=========================="
        
        read -n 1 -p "Select an option: " choice
        echo ""
        
        case $choice in
            1)
                echo "Starting MCP Server in SSE mode on port 8001..."
                cd "$(dirname "$0")/../.."
                source src/backend/.venv/bin/activate
                python3 src/backend/mcp_server.py --transport sse --port 8001 &
                echo "MCP Server started. Connect at: http://localhost:8001/sse"
                ;;
            2)
                echo "Starting MCP Server in HTTP mode on port 8002..."
                cd "$(dirname "$0")/../.."
                source src/backend/.venv/bin/activate
                python3 src/backend/mcp_server.py --transport http --port 8002 &
                echo "MCP Server started. Connect at: http://localhost:8002/mcp"
                ;;
            3)
                echo "Starting MCP Server in stdio mode..."
                echo "Note: This will start an interactive stdio session."
                echo "Press Ctrl+C to return to menu."
                cd "$(dirname "$0")/../.."
                source src/backend/.venv/bin/activate
                python3 src/backend/mcp_server.py
                ;;
            4) restart_mcp_server ;;
            5) stop_mcp_server ;;
            6) show_mcp_status ;;
            7)
                echo "Testing MCP server connection..."
                if check_port 8001; then
                    echo "Testing SSE endpoint..."
                    curl -s "http://localhost:8001/sse" || echo "SSE endpoint test failed"
                elif check_port 8002; then
                    echo "Testing HTTP endpoint..."
                    curl -s "http://localhost:8002/mcp" || echo "HTTP endpoint test failed"
                else
                    echo "No MCP server detected running"
                fi
                ;;
            8) break ;;
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
    echo "9) MCP Server Control"
    echo "10) Close Tmux Session (Stop All)"
    echo "q) Quit"
    echo "==================================="
    
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
        8) show_ngrok_menu ;;
        9) show_mcp_menu ;;
        10) close_tmux_session ;;
        q|Q) exit 0 ;;
        *) echo "Invalid option" ;;
    esac
    
    echo ""
    read -n 1 -p "Press any key to continue..."
done