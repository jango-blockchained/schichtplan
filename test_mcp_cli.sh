#!/bin/bash
# =============================================================================
# MCP CLI Test Script for Schichtplan
# =============================================================================

# Set absolute path to the project directory
PROJECT_DIR="/home/jango/Git/schichtplan"
cd "$PROJECT_DIR"

# Enable error reporting and verbosity
set -e

# Set environment variables as early as possible to disable any debug output
export FLASK_DEBUG=0
export WERKZEUG_RUN_MAIN=true
export PYTHONUNBUFFERED=1
export PYTHONIOENCODING=utf-8

# Direct all non-JSON output to stderr
exec 3>&1  # Save original stdout to fd 3
echo "=== Testing Schichtplan MCP Server with MCP CLI ===" >&2
echo "This script helps diagnose issues with MCP CLI integration." >&2
echo "" >&2

# Activate the virtual environment
source "$PROJECT_DIR/.venv/bin/activate"

# Set environment variables
export PYTHONPATH="$PROJECT_DIR:$PYTHONPATH"
export MCP_CLI=1  # This is crucial for telling the server we're using MCP CLI
export MCP_BACKEND_URL="http://127.0.0.1:5000"

# Step 1: Check MCP version
echo "=== Step 1: Checking MCP Version ===" >&2
echo "Executing: mcp version" >&2
mcp version >&2
echo "" >&2

# Step 2: Test direct MCP CLI JSON output with STRICT verification
echo "=== Step 2: Testing direct MCP CLI JSON output (STRICT MODE) ===" >&2
echo "Executing: mcp run src/mcp/claude_server.py" >&2
echo "Expected output: EXACTLY one line with a valid JSON message with 'type':'init'" >&2
echo "" >&2

# Run the server and capture FULL output with no filtering
echo "Capturing full output..." >&2
OUTPUT_FILE=$(mktemp)
timeout 2 mcp run src/mcp/claude_server.py > "$OUTPUT_FILE" 2>/dev/null || true

# Check the output file's line count and content
LINE_COUNT=$(wc -l < "$OUTPUT_FILE")
echo "Output has $LINE_COUNT lines (should be EXACTLY 1)" >&2

# Print all lines for verification
cat "$OUTPUT_FILE" >&2
echo "" >&2

# Verify it's a valid JSON message with type:init and NOTHING else
if [ "$LINE_COUNT" -eq 1 ] && grep -q '"type":"init"' "$OUTPUT_FILE"; then
    echo "SUCCESS: Server outputs EXACTLY one JSON initialization message with no other text" >&2
else
    echo "FAILURE: Server output is not clean - either multiple lines or invalid JSON" >&2
    echo "Check debug messages in the output above" >&2
fi
echo "" >&2

# Step 3: Test mcp-shifts script JSON output with STRICT verification
echo "=== Step 3: Testing mcp-shifts script JSON output (STRICT MODE) ===" >&2
echo "Executing: ./mcp-shifts --claude --use-mcp-cli" >&2
echo "Expected output: EXACTLY one line with a valid JSON message with 'type':'init'" >&2
echo "" >&2

# Run the script and capture FULL output with no filtering
echo "Capturing full output..." >&2
OUTPUT_FILE=$(mktemp)
timeout 2 ./mcp-shifts --claude --use-mcp-cli > "$OUTPUT_FILE" 2>/dev/null || true

# Check the output file's line count and content
LINE_COUNT=$(wc -l < "$OUTPUT_FILE")
echo "Output has $LINE_COUNT lines (should be EXACTLY 1)" >&2

# Print all lines for verification
cat "$OUTPUT_FILE" >&2
echo "" >&2

# Verify it's a valid JSON message with type:init and NOTHING else
if [ "$LINE_COUNT" -eq 1 ] && grep -q '"type":"init"' "$OUTPUT_FILE"; then
    echo "SUCCESS: mcp-shifts outputs EXACTLY one JSON initialization message with no other text" >&2
else
    echo "FAILURE: mcp-shifts output is not clean - either multiple lines or invalid JSON" >&2
    echo "Check debug messages in the output above" >&2
fi
echo "" >&2

# Step 4: Check if log files were created
echo "=== Step 4: Checking log files ===" >&2
echo "The server should log to files instead of stdout when using MCP CLI." >&2
if [ -f "src/mcp/claude_server.log" ]; then
    echo "SUCCESS: Log file 'claude_server.log' exists" >&2
    echo "Last few lines of the log:" >&2
    tail -n 5 "src/mcp/claude_server.log" >&2
else
    echo "WARNING: Log file 'claude_server.log' doesn't exist" >&2
    echo "This is OK if we've disabled all logging for maximum compatibility" >&2
fi
echo "" >&2

# Step 5: Test direct connection to backend
echo "=== Step 5: Testing direct connection to backend ===" >&2
echo "Checking if the backend is running on port 5000..." >&2
if curl -s -f http://127.0.0.1:5000/greeting > /dev/null; then
    echo "SUCCESS: Backend is running on port 5000" >&2
else
    echo "WARNING: Backend is not running on port 5000" >&2
    echo "You may need to start your backend separately before running the MCP server." >&2
fi
echo "" >&2

# Step 6: JSON validity check
echo "=== Step 6: Testing JSON validity of the output ===" >&2
echo "Running the server and verifying the JSON output is valid..." >&2

# Run server briefly and capture JSON output
OUTPUT_FILE=$(mktemp)
timeout 2 ./mcp-shifts --claude --use-mcp-cli > "$OUTPUT_FILE" 2>/dev/null || true

# Use Python to validate the JSON
echo "Validating JSON with Python..." >&2
if python -c "import json, sys; json.load(open('$OUTPUT_FILE')); print('JSON is valid')" 2>/dev/null; then
    echo "SUCCESS: Output is valid JSON" >&2
else
    echo "FAILURE: Output is not valid JSON" >&2
    echo "Content:" >&2
    cat "$OUTPUT_FILE" >&2
    echo "" >&2
fi
echo "" >&2

echo "=== Test complete ===" >&2
echo "" >&2
echo "If all steps completed successfully, your MCP server should work correctly with Claude." >&2
echo "" >&2
echo "To use with Claude Desktop:" >&2
echo "1. Configure a new integration:" >&2
echo "   - Server Type: Command" >&2
echo "   - Transport Type: stdio" >&2
echo "   - Command: mcp-shifts --claude --use-mcp-cli" >&2
echo "   - Working Directory: $PROJECT_DIR" >&2
echo "" >&2
echo "2. Note: The server has been configured to be completely silent except for the" >&2
echo "   required JSON initialization message. This is required for Claude integration." >&2
echo "" >&2 