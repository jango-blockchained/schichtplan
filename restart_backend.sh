#!/bin/bash

# Kill any existing processes on port 5000
echo "Killing any processes on port 5000..."
lsof -i:5000 | grep LISTEN | awk '{print $2}' | xargs -r kill -9

# Change to backend directory
cd src/backend

# Set up environment variables
export FLASK_APP=run.py
export FLASK_ENV=development
export PYTHONPATH=/home/jango/Git/schichtplan

# Start the server
echo "Starting backend server..."
python run.py &

# Wait for server to start
sleep 2

# Check if server is running
if lsof -i:5000 | grep LISTEN > /dev/null; then
    echo "Server started successfully on port 5000"
else
    echo "Failed to start server"
fi

# Go back to original directory
cd ../.. 