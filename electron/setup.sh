#!/bin/bash
# Quick setup script for Schichtplan Desktop App

echo "Setting up Schichtplan Desktop App..."

# Check if we're in the right directory
if [ ! -f "../src/frontend/package.json" ]; then
    echo "Error: Please run this script from the electron directory"
    exit 1
fi

# Install electron dependencies
echo "Installing Electron dependencies..."
npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../src/frontend
npm install --legacy-peer-deps

# Build frontend for desktop
echo "Building frontend..."
npm run build

# Go back to electron directory
cd ../../electron

# Copy frontend build
echo "Copying frontend build..."
mkdir -p resources/frontend
cp -r ../src/frontend/dist/* resources/frontend/

# Install Python dependencies
echo "Installing Python dependencies..."
cd ../src/backend
pip install -r requirements.txt

# Go back to electron directory
cd ../../electron

echo "Setup complete!"
echo ""
echo "To run the desktop app in development mode:"
echo "  npm run dev"
echo ""
echo "To build for production:"
echo "  ./build.sh"
