#!/bin/bash
# =============================================================================
# Schichtplan MCP Server Installation Script
# =============================================================================

# Set absolute path to the project directory
PROJECT_DIR="/home/jango/Git/schichtplan"
MCP_DIR="$PROJECT_DIR/src/mcp"

echo "Installing MCP server dependencies..."

# Ensure we're in a virtual environment
if [[ -z "$VIRTUAL_ENV" ]]; then
  echo "Virtual environment not activated."
  echo "Please activate your virtual environment first:"
  echo "  source $PROJECT_DIR/.venv/bin/activate"
  exit 1
fi

# Install requirements
pip install -r "$MCP_DIR/requirements.txt"

# Ensure flask-cors is installed
pip install flask-cors

# Ensure mcp package is installed (for Claude integration)
pip install "mcp>=1.4.1"

# Ensure mcp-shifts is executable and available
chmod +x "$PROJECT_DIR/mcp-shifts"

# Check if ~/bin exists and is in PATH
if [[ ! -d "$HOME/bin" ]]; then
  mkdir -p "$HOME/bin"
  echo "Created $HOME/bin directory"
fi

if [[ ":$PATH:" != *":$HOME/bin:"* ]]; then
  echo "Adding $HOME/bin to PATH in .bashrc"
  echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.bashrc"
  echo "Please restart your shell or run: source ~/.bashrc"
fi

# Create symbolic link to mcp-shifts if it doesn't exist
if [[ ! -f "$HOME/bin/mcp-shifts" ]]; then
  ln -s "$PROJECT_DIR/mcp-shifts" "$HOME/bin/mcp-shifts"
  echo "Created symbolic link for mcp-shifts in ~/bin"
else
  echo "Symbolic link for mcp-shifts already exists"
fi

echo ""
echo "Installation complete!"
echo ""
echo "You can now run the MCP server with:"
echo "  mcp-shifts                  # Real server (direct Python execution)"
echo "  mcp-shifts --simplified     # Simplified server with mock data"
echo "  mcp-shifts --claude         # Claude-specific server"
echo ""
echo "For proper Claude integration, use the --use-mcp-cli option:"
echo "  mcp-shifts --claude --use-mcp-cli  # Required for stdio transport with Claude"
echo ""
echo "Note: The server binds to 127.0.0.1 instead of 0.0.0.0 for security."
echo "To connect to the server from Claude:"
echo "1. Ensure the server is running with the MCP CLI option (e.g., mcp-shifts --claude --use-mcp-cli)"
echo "2. In Claude Desktop, go to Settings > Integrations"
echo "3. Add a new integration with URL: http://127.0.0.1:8000 and transport type: stdio"
echo ""
echo "To test the server is running correctly (without MCP CLI):"
echo "  curl http://127.0.0.1:8000/greeting"
echo "" 