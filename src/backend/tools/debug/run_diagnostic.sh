#!/bin/bash
# Script to run the schedule generator diagnostic tool with proper environment setup

set -e  # Exit on error

# Get the absolute path to the project root (parent of src)
PROJECT_ROOT=$(cd "$(dirname "$0")/../../../.." && pwd)
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

# Set up environment variables
export FLASK_APP=src.backend.app
export FLASK_ENV=development
export DEBUG_MODE=1
export PYTHONPATH=$PROJECT_ROOT

echo "============================================================="
echo "SCHEDULE GENERATOR DIAGNOSTIC"
echo "============================================================="
echo "Project root: $PROJECT_ROOT"
echo "Script directory: $SCRIPT_DIR"
echo "Environment:"
echo "  FLASK_APP: $FLASK_APP"
echo "  FLASK_ENV: $FLASK_ENV"
echo "  DEBUG_MODE: $DEBUG_MODE"
echo "  PYTHONPATH: $PYTHONPATH"
echo "============================================================="

# Activate virtual environment if it exists and is not already active
if [ -d "$PROJECT_ROOT/.venv" ] && [ -z "$VIRTUAL_ENV" ]; then
    echo "Activating virtual environment..."
    source "$PROJECT_ROOT/.venv/bin/activate"
fi

# Run the diagnostic tool
echo "Running simple diagnostic..."
python "$SCRIPT_DIR/simple_diagnostic.py"
SIMPLE_STATUS=$?

if [ $SIMPLE_STATUS -eq 0 ]; then
    echo "Simple diagnostic succeeded. Running full diagnostic..."
    python "$SCRIPT_DIR/schedule_generator_diagnostic.py" "$@"
    exit $?
else
    echo "Simple diagnostic failed with status $SIMPLE_STATUS. Not running full diagnostic."
    exit $SIMPLE_STATUS
fi 