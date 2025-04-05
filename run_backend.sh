#!/bin/bash

echo "Starting Schichtplan backend server..."

# Method 1: Run as module from project root
echo "Trying to run as module from project root..."
cd /home/jango/Git/schichtplan
python3 -m src.backend.run --auto-port

# If that fails, try method 2: Set PYTHONPATH and run from backend directory
if [ $? -ne 0 ]; then
    echo "First method failed, trying with PYTHONPATH..."
    export PYTHONPATH=/home/jango/Git/schichtplan
    cd src/backend
    python run.py --auto-port
    
    # If that fails, try method 3: Just run directly from backend directory
    if [ $? -ne 0 ]; then
        echo "Second method failed, trying direct execution..."
        python run.py --auto-port
    fi
fi 