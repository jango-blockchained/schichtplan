#!/bin/bash

# FastMCP Server Startup Script for Schichtplan
# This script provides convenient commands to start the MCP server in different modes

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SERVER="$PROJECT_ROOT/src/backend/mcp_server.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    echo -e "${BLUE}FastMCP Server for Schichtplan${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  stdio                 Start MCP server in stdio mode (default)"
    echo "  sse [PORT]           Start MCP server in SSE mode (default port: 8001)"
    echo "  http [PORT]          Start MCP server in streamable HTTP mode (default port: 8002)"
    echo "  test                 Run the MCP client example"
    echo "  status               Check MCP integration status"
    echo "  install              Install FastMCP dependencies"
    echo "  help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 stdio            # Start in stdio mode"
    echo "  $0 sse              # Start SSE server on port 8001"
    echo "  $0 sse 8003         # Start SSE server on port 8003"
    echo "  $0 http             # Start HTTP server on port 8002"
    echo "  $0 test             # Run client examples"
    echo ""
}

check_dependencies() {
    echo -e "${YELLOW}Checking dependencies...${NC}"
    
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: Python 3 is required but not installed.${NC}"
        exit 1
    fi
    
    if ! python3 -c "import fastmcp" &> /dev/null; then
        echo -e "${RED}Error: FastMCP is not installed.${NC}"
        echo -e "${YELLOW}Run: $0 install${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Dependencies OK${NC}"
}

install_dependencies() {
    echo -e "${YELLOW}Installing FastMCP dependencies...${NC}"
    
    if [ -f "$PROJECT_ROOT/src/backend/requirements.txt" ]; then
        pip install -r "$PROJECT_ROOT/src/backend/requirements.txt"
        echo -e "${GREEN}✓ Dependencies installed${NC}"
    else
        echo -e "${RED}Error: requirements.txt not found${NC}"
        exit 1
    fi
}

check_database() {
    echo -e "${YELLOW}Checking database connection...${NC}"
    
    cd "$PROJECT_ROOT"
    if python3 -c "
import sys
sys.path.insert(0, '.')
from src.backend.app import create_app
try:
    app = create_app()
    with app.app_context():
        from src.backend.models import Employee
        Employee.query.count()
    print('Database connection OK')
except Exception as e:
    print(f'Database error: {e}')
    sys.exit(1)
" &> /dev/null; then
        echo -e "${GREEN}✓ Database connection OK${NC}"
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        echo -e "${YELLOW}Make sure the main application database is set up correctly${NC}"
        exit 1
    fi
}

start_stdio() {
    echo -e "${GREEN}Starting MCP server in STDIO mode...${NC}"
    echo -e "${YELLOW}The server will communicate via standard input/output${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    
    cd "$PROJECT_ROOT"
    export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"
    python3 "$MCP_SERVER"
}

start_sse() {
    local port=${1:-8001}
    echo -e "${GREEN}Starting MCP server in SSE mode on port $port...${NC}"
    echo -e "${YELLOW}Connect via: http://localhost:$port/sse${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    
    cd "$PROJECT_ROOT"
    export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"
    python3 "$MCP_SERVER" --transport sse --port "$port"
}

start_http() {
    local port=${1:-8002}
    echo -e "${GREEN}Starting MCP server in Streamable HTTP mode on port $port...${NC}"
    echo -e "${YELLOW}Connect via: http://localhost:$port/mcp${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    
    cd "$PROJECT_ROOT"
    export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"
    python3 "$MCP_SERVER" --transport http --port "$port"
}

run_test() {
    echo -e "${GREEN}Running MCP client examples...${NC}"
    echo ""
    
    cd "$PROJECT_ROOT"
    export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"
    python3 "$PROJECT_ROOT/src/backend/examples/mcp_client_example.py"
}

check_status() {
    echo -e "${BLUE}MCP Integration Status${NC}"
    echo "========================"
    
    check_dependencies
    check_database
    
    echo ""
    echo -e "${GREEN}MCP Server Status:${NC}"
    echo "  Script location: $MCP_SERVER"
    
    if [ -f "$MCP_SERVER" ]; then
        echo -e "${GREEN}  ✓ Server script exists${NC}"
    else
        echo -e "${RED}  ✗ Server script missing${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}Available transports:${NC}"
    echo "  • STDIO (default)"
    echo "  • SSE (Server-Sent Events)"
    echo "  • Streamable HTTP"
    
    echo ""
    echo -e "${GREEN}Integration files:${NC}"
    echo "  • Service: src/backend/services/mcp_service.py"
    echo "  • Routes: src/backend/routes/mcp_routes.py"
    echo "  • Examples: src/backend/examples/mcp_client_example.py"
    echo "  • Documentation: src/backend/MCP_INTEGRATION.md"
}

# Main script logic
case "${1:-stdio}" in
    "stdio")
        check_dependencies
        check_database
        start_stdio
        ;;
    "sse")
        check_dependencies
        check_database
        start_sse "$2"
        ;;
    "http")
        check_dependencies
        check_database
        start_http "$2"
        ;;
    "test")
        check_dependencies
        check_database
        run_test
        ;;
    "status")
        check_status
        ;;
    "install")
        install_dependencies
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac