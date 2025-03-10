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
        q|Q) exit 0 ;;
        *) echo "Invalid option" ;;
    esac
    
    echo ""
    read -n 1 -p "Press any key to continue..."
done 