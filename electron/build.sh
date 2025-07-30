#!/bin/bash
# Build script for the Electron desktop app

set -e

echo "Building Schichtplan Desktop Application..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "This script must be run from the electron directory"
    exit 1
fi

# Check prerequisites
print_status "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed"
    exit 1
fi

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

# Build frontend
print_status "Building frontend..."
cd ../src/frontend
npm install --legacy-peer-deps
npm run build
cd ../../electron

# Copy frontend build to resources
print_status "Copying frontend build..."
mkdir -p resources/frontend
cp -r ../src/frontend/dist/* resources/frontend/

# Build backend with PyInstaller
print_status "Building backend with PyInstaller..."
pip install pyinstaller
cd ../src/backend

# Create requirements.txt if it doesn't exist
if [ ! -f "requirements.txt" ]; then
    print_status "Creating requirements.txt..."
    pip freeze > requirements.txt
fi

# Install backend dependencies
print_status "Installing backend dependencies..."
pip install -r requirements.txt

# Build backend executable
print_status "Creating backend executable..."
# Clean up any existing build artifacts first
rm -rf ../../electron/build/backend_temp
rm -rf ../../electron/resources/backend/*
mkdir -p ../../electron/build/backend_temp
mkdir -p ../../electron/resources/backend

pyinstaller --onefile \
    --name schichtplan-backend \
    --distpath ../../electron/resources/backend \
    --workpath ../../electron/build/backend_temp \
    --specpath ../../electron/build/backend_temp \
    --add-data ".:backend" \
    --hidden-import flask \
    --hidden-import flask_sqlalchemy \
    --hidden-import flask_migrate \
    --hidden-import flask_cors \
    --hidden-import sqlalchemy \
    --hidden-import alembic \
    --hidden-import reportlab \
    --hidden-import pillow \
    --hidden-import click \
    --hidden-import email_validator \
    --hidden-import python_dateutil \
    --hidden-import pydantic \
    --hidden-import fastmcp \
    --hidden-import uvicorn \
    --collect-all flask \
    --collect-all flask_sqlalchemy \
    --collect-all sqlalchemy \
    --collect-all alembic \
    ../../electron/src/desktop_server.py

cd ../../electron

# Build Electron app
print_status "Building Electron application..."
npm run build

print_status "Build completed successfully!"
print_status "Built applications can be found in the dist/ directory"

# Show build artifacts
if [ -d "dist" ]; then
    print_status "Build artifacts:"
    ls -la dist/
fi
