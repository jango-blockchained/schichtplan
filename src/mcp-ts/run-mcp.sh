#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Shift-MCP Server ===${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js (v18 or higher) before continuing."
    exit 1
fi

# Check if the server file exists
if [ ! -f "mcp-server.js" ]; then
    echo -e "${YELLOW}Warning: mcp-server.js not found. Building the server...${NC}"
    npm run build
    
    if [ ! -f "mcp-server.js" ]; then
        echo -e "${RED}Error: Failed to build the server.${NC}"
        exit 1
    fi
fi

# Make sure the server is executable
chmod +x mcp-server.js

# Run the server
echo -e "${GREEN}Running Shift-MCP Server...${NC}"
node mcp-server.js

exit 0 