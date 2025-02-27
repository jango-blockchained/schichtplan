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

# Clean up any existing log files in wrong locations
echo "Cleaning up any misplaced log files..."
find . -name "backend.log" ! -path "./src/logs/*" -delete

# Create required directories with proper structure
echo "Setting up directory structure..."
mkdir -p src/logs
mkdir -p src/instance

# Kill any existing processes
kill_port 5000  # Backend port
kill_port 5173  # Frontend port

echo "Starting application..."

# Start backend
cd src/backend
export FLASK_APP=run.py
export FLASK_ENV=development
python3 run.py &
echo "Backend starting on http://localhost:5000"

# Wait for backend to be ready
while ! check_port 5000; do
    sleep 1
done

# Start frontend
cd ../frontend
npm run dev &
echo "Frontend starting on http://localhost:5173"

# Wait for frontend to be ready
while ! check_port 5173; do
    sleep 1
done

echo "Application started successfully!"
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:5173"
echo "Logs location: src/logs/backend.log"
echo ""
echo "Press Ctrl+C to stop all processes"

# Wait for Ctrl+C
trap 'kill $(jobs -p)' INT
wait 