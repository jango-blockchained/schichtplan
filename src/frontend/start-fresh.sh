#!/bin/bash

# Frontend development server startup script
# This script handles port conflicts and starts the dev server cleanly

PORT=${1:-5173}

echo "🚀 Starting Schichtplan Frontend Development Server..."

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port $PORT is already in use."
    echo "🔄 Attempting to free up the port..."
    
    # Get process IDs using the port
    PIDS=$(lsof -ti:$PORT)
    
    if [ ! -z "$PIDS" ]; then
        echo "📋 Found processes: $PIDS"
        echo "⚡ Killing existing processes..."
        
        # Kill the processes
        echo $PIDS | xargs kill -9
        
        # Wait a moment for processes to clean up
        sleep 2
        
        # Check if port is still in use
        if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
            echo "❌ Port $PORT is still in use. Trying alternative port..."
            PORT=$((PORT + 1))
        else
            echo "✅ Port $PORT is now available."
        fi
    fi
fi

echo "🎯 Starting development server on port $PORT..."

# Start the development server
cd "$(dirname "$0")"
npm run dev -- --port $PORT --host 0.0.0.0

echo "🏁 Development server stopped." 