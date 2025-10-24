#!/bin/bash
# Quick test script for the new TUI

echo "=== Testing Schichtplan Development Manager TUI ==="
echo ""

# Check if virtual environment exists
if [ ! -d "src/backend/.venv" ]; then
    echo "❌ Virtual environment not found. Run: python3 -m venv src/backend/.venv"
    exit 1
fi

echo "✓ Virtual environment found"

# Check if TUI dependencies are installed
if ! ./src/backend/.venv/bin/python -c "import textual" 2>/dev/null; then
    echo "⚠️  Textual not installed. Installing TUI dependencies..."
    ./src/backend/.venv/bin/pip install -r requirements-tui.txt
    echo "✓ TUI dependencies installed"
else
    echo "✓ Textual already installed"
fi

# Check Python version
PYTHON_VERSION=$(./src/backend/.venv/bin/python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✓ Python version: $PYTHON_VERSION"

# Check if Bun is installed
if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    echo "✓ Bun version: $BUN_VERSION"
else
    echo "⚠️  Bun not found - frontend won't start"
fi

# Check if dev_manager.py exists
if [ -f "dev_manager.py" ]; then
    echo "✓ dev_manager.py found"
else
    echo "❌ dev_manager.py not found"
    exit 1
fi

# Check if dev_manager.py has any syntax errors
if ./src/backend/.venv/bin/python -m py_compile dev_manager.py 2>/dev/null; then
    echo "✓ dev_manager.py syntax is valid"
else
    echo "❌ dev_manager.py has syntax errors"
    exit 1
fi

echo ""
echo "=== All checks passed! ==="
echo ""
echo "You can now run the TUI with:"
echo "  ./start.sh"
echo ""
echo "Or test directly:"
echo "  ./src/backend/.venv/bin/python dev_manager.py"
echo ""
echo "For help:"
echo "  ./start.sh --help"
echo ""
