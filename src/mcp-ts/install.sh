#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Shift-MCP Server Installation ===${NC}"
echo "This script will install the Shift-MCP server for use with Cursor IDE."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js (v18 or higher) before continuing."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d '.' -f 1)
if [ $NODE_MAJOR -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js version $NODE_VERSION detected.${NC}"
    echo "It's recommended to use Node.js v18 or higher."
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Build the server
echo -e "${GREEN}Building the server...${NC}"
npm run build

# Make the server executable
echo -e "${GREEN}Making the server executable...${NC}"
chmod +x mcp-server.js

echo -e "${GREEN}Installation complete!${NC}"
echo "You can now run the server with: npm start"
echo "Or directly with: node mcp-server.js"

exit 0 