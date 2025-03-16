#!/bin/bash

# Script to manage ngrok tunnels for Schichtplan

# Function to check if ngrok is installed
check_ngrok_installed() {
    if ! command -v ngrok &> /dev/null; then
        echo "Error: ngrok is not installed on your system."
        echo ""
        echo "Please install ngrok first:"
        echo "  1. Download from https://ngrok.com/download"
        echo "  2. Extract the archive: unzip /path/to/ngrok.zip"
        echo "  3. Move ngrok to a directory in your PATH: sudo mv ngrok /usr/local/bin"
        echo "  4. Set up your authtoken: ngrok config add-authtoken YOUR_AUTHTOKEN"
        echo ""
        echo "For more details, visit: https://ngrok.com/docs/getting-started/"
        return 1
    fi
    return 0
}

# Function to check if ngrok is already running
check_ngrok_running() {
    local port=$1
    if pgrep -f "ngrok.*$port" > /dev/null; then
        return 0 # Running
    else
        return 1 # Not running
    fi
}

# Function to start ngrok tunnel
start_ngrok_tunnel() {
    local port=$1
    local service_name=$2
    
    if check_ngrok_running $port; then
        echo "ngrok is already running for $service_name on port $port"
        show_ngrok_urls
        return
    fi
    
    echo "Starting ngrok tunnel for $service_name (port $port)..."
    ngrok http $port --log=stdout > /tmp/ngrok_${port}.log 2>&1 &
    sleep 3 # Give ngrok time to establish the tunnel
    
    if check_ngrok_running $port; then
        echo "✓ ngrok tunnel started for $service_name"
        fetch_ngrok_urls $port
    else
        echo "✗ Failed to start ngrok tunnel for $service_name"
    fi
}

# Function to stop ngrok tunnel
stop_ngrok_tunnel() {
    local port=$1
    local service_name=$2
    
    if check_ngrok_running $port; then
        echo "Stopping ngrok tunnel for $service_name (port $port)..."
        pkill -f "ngrok.*$port"
        rm -f /tmp/ngrok_${port}.log
        echo "✓ ngrok tunnel stopped for $service_name"
    else
        echo "No ngrok tunnel running for $service_name"
    fi
}

# Function to fetch and display ngrok URLs
fetch_ngrok_urls() {
    local port=$1
    local url=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'http[^"]*' | head -1)
    
    if [ -z "$url" ]; then
        echo "Error: Could not retrieve ngrok URL. Make sure ngrok is running properly."
        return 1
    fi
    
    if [ $port -eq 5000 ]; then
        echo "Backend public URL: $url"
        echo "Backend public URL: $url" > /tmp/ngrok_backend_url
    elif [ $port -eq 5173 ]; then
        echo "Frontend public URL: $url"
        echo "Frontend public URL: $url" > /tmp/ngrok_frontend_url
    fi
}

# Function to show all ngrok URLs
show_ngrok_urls() {
    echo "=== Public URLs ==="
    
    if [ -f /tmp/ngrok_backend_url ]; then
        cat /tmp/ngrok_backend_url
    else
        echo "Backend: Not running"
    fi
    
    if [ -f /tmp/ngrok_frontend_url ]; then
        cat /tmp/ngrok_frontend_url
    else
        echo "Frontend: Not running"
    fi
    echo "=================="
}

# Function to start all ngrok tunnels
start_all_ngrok() {
    start_ngrok_tunnel 5000 "backend"
    start_ngrok_tunnel 5173 "frontend"
    show_ngrok_urls
}

# Function to stop all ngrok tunnels
stop_all_ngrok() {
    stop_ngrok_tunnel 5000 "backend"
    stop_ngrok_tunnel 5173 "frontend"
    rm -f /tmp/ngrok_backend_url /tmp/ngrok_frontend_url
}

# Main function to be called from other scripts
ngrok_main() {
    if ! check_ngrok_installed; then
        return 1
    fi
    
    case "$1" in
        start)
            if [ "$2" == "backend" ]; then
                start_ngrok_tunnel 5000 "backend"
            elif [ "$2" == "frontend" ]; then
                start_ngrok_tunnel 5173 "frontend"
            else
                start_all_ngrok
            fi
            ;;
        stop)
            if [ "$2" == "backend" ]; then
                stop_ngrok_tunnel 5000 "backend"
            elif [ "$2" == "frontend" ]; then
                stop_ngrok_tunnel 5173 "frontend"
            else
                stop_all_ngrok
            fi
            ;;
        status)
            show_ngrok_urls
            ;;
        *)
            echo "Usage: $0 {start|stop|status} [backend|frontend]"
            ;;
    esac
}

# If script is run directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    ngrok_main "$@"
fi 