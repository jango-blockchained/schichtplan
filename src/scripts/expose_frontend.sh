#!/bin/bash

# Script to directly expose the frontend (port 5173) to the public via ngrok
# This is a simpler alternative to using the menu system for quick frontend sharing

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Source the ngrok manager to use its functions
source "$SCRIPT_DIR/ngrok_manager.sh"

# Function to display usage
show_usage() {
    echo "Schichtplan Frontend Exposer"
    echo "============================"
    echo "This script exposes the frontend server (port 5173) to the public via ngrok."
    echo ""
    echo "Usage:"
    echo "  $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h       Show this help message and exit"
    echo "  --stop, -s       Stop the ngrok tunnel (if running)"
    echo "  --status, -c     Check the status of the ngrok tunnel"
    echo "  --browser, -b    Open the public URL in the default browser after starting"
    echo ""
    echo "Examples:"
    echo "  $0               Start the ngrok tunnel"
    echo "  $0 --stop        Stop the ngrok tunnel"
    echo "  $0 --status      Check the status of the ngrok tunnel"
    echo "  $0 --browser     Start the ngrok tunnel and open in browser"
    echo ""
}

# Function to open URL in browser
open_in_browser() {
    local url=$1
    echo "Opening $url in browser..."
    
    if command -v xdg-open &> /dev/null; then
        xdg-open "$url" &> /dev/null &
    elif command -v open &> /dev/null; then
        open "$url" &> /dev/null &
    else
        echo "Could not open browser automatically. Please open this URL manually:"
        echo "$url"
    fi
}

# Parse command line options
OPEN_BROWSER=false
ACTION="start"

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_usage
            exit 0
            ;;
        --stop|-s)
            ACTION="stop"
            shift
            ;;
        --status|-c)
            ACTION="status"
            shift
            ;;
        --browser|-b)
            OPEN_BROWSER=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check if ngrok is installed
if ! check_ngrok_installed; then
    exit 1
fi

# Perform the requested action
case $ACTION in
    start)
        # Check if the frontend server is running
        if ! nc -z localhost 5173 &> /dev/null; then
            echo "Error: Frontend server does not appear to be running on port 5173."
            echo "Please make sure the Schichtplan frontend server is running before exposing it."
            exit 1
        fi
        
        # Ensure Vite config allows ngrok hosts
        ensure_vite_config
        
        # Start the ngrok tunnel
        start_ngrok_tunnel 5173 "frontend"
        
        # Extract the URL for browser opening
        if [ "$OPEN_BROWSER" = true ] && [ -f /tmp/ngrok_frontend_url ]; then
            # Get just the URL without the prefix text
            URL=$(grep -o 'https\?://[^ ]*' /tmp/ngrok_frontend_url)
            if [ ! -z "$URL" ]; then
                open_in_browser "$URL"
            fi
        fi
        ;;
    stop)
        stop_ngrok_tunnel 5173 "frontend"
        ;;
    status)
        if check_ngrok_running 5173; then
            echo "Frontend ngrok tunnel is running."
            fetch_ngrok_urls 5173
        else
            echo "Frontend ngrok tunnel is not running."
        fi
        ;;
esac

exit 0 