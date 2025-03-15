# MCP Server for Schichtplan

This document explains how to use the MCP (Model-Claude-Protocol) server for the Schichtplan application.

## Prerequisites

- Python 3.x
- Virtual environment (venv or conda)

## Setup Instructions

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone [repository-url]
   cd schichtplan
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r src/mcp/requirements.txt
   ```

## Running the MCP Server

### Option 1: Using the wrapper script (recommended)

We've created a wrapper script that makes it easy to start the MCP server:

```bash
# Start in development mode with hot-reloading
./mcp-shifts

# Start in regular production mode
./mcp-shifts run
```

### Option 2: Using the MCP CLI directly

If you prefer to use the MCP CLI directly:

```bash
# Activate virtual environment
source .venv/bin/activate

# Start in development mode with hot-reloading
mcp dev src/mcp/server.py

# Start in regular mode
mcp run src/mcp/server.py
```

### Option 3: Global access

If you've set up the symbolic link as instructed:

```bash
# From anywhere
mcp-shifts

# Or in production mode
mcp-shifts run
```

## Using the MCP Server

Once the server is running, it will be available at:
- Development mode: http://localhost:8000 (with MCP Inspector UI)
- Regular mode: http://localhost:8000 (API only)

### Available Endpoints

- Resources (GET requests):
  - `/greeting`: Welcome message
  - `/employees`: List all employees
  - `/employees/{employee_id}`: Get employee details
  - `/shifts`: List all shifts
  - `/schedules`: List all schedules
  - `/settings`: Get application settings

- Tools (POST requests):
  - Create, update, delete employees
  - Create, update, delete shifts
  - Generate and publish schedules
  - Export schedules to PDF

## Integration with Claude Desktop

To integrate with Claude Desktop, configure the Claude Desktop settings to point to your MCP server URL (typically `http://localhost:8000` when running in development mode).

## Troubleshooting

- **Port already in use**: If port 8000 is already in use, you can modify the server port in the server.py file.
- **Missing dependencies**: Make sure all packages in requirements.txt are installed.
- **Backend API connection issues**: Ensure the Schichtplan backend server is running and accessible. 