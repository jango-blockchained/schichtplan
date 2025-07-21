#!/bin/bash
# Fix dependency conflicts for Electron desktop app

set -e

echo "Fixing dependency conflicts for Schichtplan Desktop App..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Please run this script from the electron directory"
    exit 1
fi

print_status "Clearing npm and node_modules caches..."

# Clean frontend dependencies
print_status "Cleaning frontend dependencies..."
cd ../src/frontend
rm -rf node_modules package-lock.json
cd ../../electron

# Clean electron dependencies  
print_status "Cleaning electron dependencies..."
rm -rf node_modules package-lock.json

# Install electron dependencies
print_status "Installing Electron dependencies..."
npm install

# Install frontend dependencies with legacy peer deps
print_status "Installing frontend dependencies with legacy peer deps..."
cd ../src/frontend
npm install --legacy-peer-deps
cd ../../electron

print_status "Dependencies fixed! You can now run:"
echo "  npm run dev     # for development"
echo "  ./build.sh      # for production build"
