#!/bin/bash
# Run the Flask diagnostic command

set -e  # Exit immediately if a command exits with a non-zero status.

# Get the absolute paths
PROJECT_ROOT=$(cd "$(dirname "$0")/../../../../" && pwd)
echo "Project root: $PROJECT_ROOT"

# Create a diagnostics log directory if it doesn't exist
DIAG_DIR="$PROJECT_ROOT/logs/diagnostics"
mkdir -p "$DIAG_DIR"
LOG_FILE="$DIAG_DIR/flask_diagnostic_$(date +%Y%m%d_%H%M%S).log"

# Start logging
exec > >(tee "$LOG_FILE")
exec 2>&1

# Print header
echo "===================================================================="
echo "SCHICHTPLAN FLASK DIAGNOSTIC TOOL"
echo "===================================================================="
echo "Date: $(date)"
echo "Running diagnostics from: $(pwd)"
echo "Log file: $LOG_FILE"
echo "Project root: $PROJECT_ROOT"
echo "===================================================================="

# Set up environment
export PYTHONPATH="$PROJECT_ROOT"
export FLASK_APP="src.backend.app"
export FLASK_ENV="development"
export DEBUG_MODE="1"

echo "Environment variables:"
echo "  PYTHONPATH: $PYTHONPATH"
echo "  FLASK_APP: $FLASK_APP"
echo "  FLASK_ENV: $FLASK_ENV"
echo "  DEBUG_MODE: $DEBUG_MODE"

# Activate virtual environment if it exists
if [ -d "$PROJECT_ROOT/.venv" ]; then
    echo "Activating virtual environment..."
    source "$PROJECT_ROOT/.venv/bin/activate"
fi

# Run the Flask diagnostic command
echo -e "\nRunning Flask diagnostic command..."
cd "$PROJECT_ROOT"
flask run-diagnostic

# Check if the command succeeded
if [ $? -eq 0 ]; then
    echo -e "\n===================================================================="
    echo "DIAGNOSTIC COMPLETED SUCCESSFULLY"
    echo "All tests passed. See log file for details: $LOG_FILE"
    echo "===================================================================="
else
    echo -e "\n===================================================================="
    echo "DIAGNOSTIC FAILED"
    echo "See log file for details: $LOG_FILE"
    echo "===================================================================="
    exit 1
fi 