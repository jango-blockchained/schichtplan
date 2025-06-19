# Connecting to Schichtplan MCP Server via VS Code

## Prerequisites

1. **Install MCP-compatible VS Code extension** (one of):
   - Continue Dev (recommended for MCP)
   - Cursor 
   - Claude Dev
   - Any AI coding assistant that supports MCP

2. **Install FastMCP dependencies**:
   ```bash
   cd /home/jango/Git/maike2/schichtplan
   ./start_mcp_server.sh install
   ```

## Connection Methods

### Method 1: Direct Server Connection (Recommended)

1. **Start the MCP server**:
   ```bash
   # SSE mode (best for VS Code web-based tools)
   ./start_mcp_server.sh sse
   
   # Or HTTP mode
   ./start_mcp_server.sh http
   
   # Or stdio mode (for direct AI integration)
   ./start_mcp_server.sh stdio
   ```

2. **Configure your VS Code extension**:
   - **SSE Endpoint**: `http://localhost:8001/sse`
   - **HTTP Endpoint**: `http://localhost:8002/mcp`

### Method 2: VS Code Settings Configuration

Your `.vscode/settings.json` has been configured with MCP server settings:

```json
{
  "mcp.servers": {
    "schichtplan": {
      "command": "python3",
      "args": ["src/backend/mcp_server.py"],
      "cwd": "${workspaceFolder}",
      "env": {
        "PYTHONPATH": ".",
        "FLASK_ENV": "development"
      }
    }
  },
  "mcp.endpoints": {
    "schichtplan-sse": {
      "url": "http://localhost:8001/sse",
      "transport": "sse"
    },
    "schichtplan-http": {
      "url": "http://localhost:8002/mcp",
      "transport": "http"
    }
  }
}
```

## Available MCP Tools

Once connected, you'll have access to these Schichtplan tools:

- **get_server_info**: Get server information and status
- **get_capabilities**: List all available MCP capabilities
- **get_employees**: Retrieve employee data
- **get_shift_templates**: Get available shift templates
- **generate_schedule**: AI-powered schedule generation
- **get_schedule**: Retrieve existing schedules
- **generate_demo_data**: Create test data
- **get_system_status**: Check system health

## Quick Start Steps

1. **Start the server**:
   ```bash
   cd /home/jango/Git/maike2/schichtplan
   ./start_mcp_server.sh sse
   ```

2. **Test the connection**:
   ```bash
   ./start_mcp_server.sh test
   ```

3. **Open VS Code** in the project directory

4. **Configure your AI extension** to connect to:
   - **SSE**: `http://localhost:8001/sse`
   - **HTTP**: `http://localhost:8002/mcp`

5. **Test with a prompt** like:
   ```
   "Get the list of employees and generate a schedule for next week"
   ```

## Troubleshooting

### Server Not Starting
```bash
# Check dependencies
./start_mcp_server.sh status

# Check logs
python3 src/backend/mcp_server.py --transport sse --log-level DEBUG
```

### Connection Issues
- Ensure the server is running on the correct port
- Check firewall settings
- Verify the endpoint URL in your VS Code extension

### Import Errors
Make sure you're in the project root directory and Python path is set correctly.

## Example Usage in VS Code

Once connected, you can use natural language prompts with your AI extension:

- "Show me all employees in the system"
- "Generate a schedule for the next week"
- "What shift templates are available?"
- "Create some demo data for testing"
- "Check the system status"

The MCP server will automatically handle the backend operations and return structured data to your AI assistant.
