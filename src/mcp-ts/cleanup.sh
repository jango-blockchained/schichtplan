#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Cleaning up Shift-MCP Server ===${NC}"
echo "This script will remove all unnecessary files from the project."

# Files to keep
KEEP_FILES=(
  "mcp-server.ts"
  "mcp-server.js"
  "mcp-server.d.ts"
  "package.json"
  "tsconfig.json"
  "README.md"
  "install.sh"
  "run-mcp.sh"
  "run-with-npx.sh"
  "cleanup.sh"
)

# Function to check if a file should be kept
should_keep() {
  local file="$1"
  for keep in "${KEEP_FILES[@]}"; do
    if [[ "$file" == "$keep" ]]; then
      return 0
    fi
  done
  return 1
}

# Remove all files except those in KEEP_FILES
echo -e "${YELLOW}Removing unnecessary files...${NC}"
for file in *; do
  if [[ -f "$file" ]] && ! should_keep "$file"; then
    echo "Removing file: $file"
    rm -f "$file"
  fi
done

# Remove directories
echo -e "${YELLOW}Removing unnecessary directories...${NC}"
if [[ -d "src" ]]; then
  echo "Removing directory: src"
  rm -rf src
fi

if [[ -d "dist" ]]; then
  echo "Removing directory: dist"
  rm -rf dist
fi

# Keep node_modules for now, but give option to remove
echo -e "${YELLOW}Do you want to remove node_modules? (y/n)${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
  echo "Removing directory: node_modules"
  rm -rf node_modules
else
  echo "Keeping node_modules directory."
fi

echo -e "${GREEN}Cleanup complete!${NC}"
echo "The following files have been kept:"
for keep in "${KEEP_FILES[@]}"; do
  if [[ -f "$keep" ]]; then
    echo "- $keep"
  fi
done

exit 0 