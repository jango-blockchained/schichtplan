# FastMCP Integration - Quick Start Guide

This guide provides a quick overview of the FastMCP integration added to your Schichtplan project.

## What was Added

✅ **FastMCP Server Service** (`src/backend/services/mcp_service.py`)
- Exposes core Schichtplan functionality through MCP tools
- Provides employee, shift, and schedule management capabilities
- Supports AI-powered and traditional schedule generation

✅ **Standalone MCP Server** (`src/backend/mcp_server.py`)
- Independent server that can run in stdio, SSE, or streamable HTTP modes
- Command-line interface with argument parsing
- Comprehensive logging and error handling

✅ **Flask Web Integration** (`src/backend/routes/mcp_routes.py`)
- Web API endpoints for MCP status and tool testing
- Integrated into existing Flask application
- REST endpoints for MCP management

✅ **Client Examples** (`src/backend/examples/mcp_client_example.py`)
- Demonstrates all three transport modes
- Example schedule generation workflows
- Error handling patterns

✅ **Startup Script** (`start_mcp_server.sh`)
- Convenient commands for different server modes
- Dependency checking and status validation
- Cross-platform compatibility

## Quick Commands

### Install Dependencies
```bash
./start_mcp_server.sh install
```

### Check Status
```bash
./start_mcp_server.sh status
```

### Run Server (STDIO Mode - Default)
```bash
./start_mcp_server.sh stdio
```

### Run Server (SSE Mode)
```bash
./start_mcp_server.sh sse          # Port 8001
./start_mcp_server.sh sse 8003     # Custom port
```

### Run Server (HTTP Mode)
```bash
./start_mcp_server.sh http         # Port 8002
./start_mcp_server.sh http 8004    # Custom port
```

### Test the Integration
```bash
./start_mcp_server.sh test
```

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_employees` | Retrieve employee information with filtering |
| `get_shift_templates` | Get shift template definitions |
| `get_system_status` | System status and database statistics |
| `generate_schedule` | Generate new schedules (AI or traditional) |
| `get_schedule` | Retrieve existing schedules |
| `generate_demo_data` | Create test data for development |

## Available MCP Resources

| Resource | Description |
|----------|-------------|
| `config://system` | System configuration settings |
| `employees://{id}` | Detailed employee information |

## Available MCP Prompts

| Prompt | Description |
|--------|-------------|
| `schedule_analysis_prompt` | Generate schedule analysis prompts |
| `employee_scheduling_prompt` | Create employee scheduling prompts |

## Transport Modes

### STDIO (Default)
- **Best for**: Local AI tools, Claude Desktop integration
- **Usage**: `./start_mcp_server.sh stdio`
- **Connection**: Process-based communication

### SSE (Server-Sent Events)
- **Best for**: Web applications, real-time updates
- **Usage**: `./start_mcp_server.sh sse`
- **Connection**: `http://localhost:8001/sse`

### Streamable HTTP
- **Best for**: Modern web deployments, microservices
- **Usage**: `./start_mcp_server.sh http`
- **Connection**: `http://localhost:8002/mcp`

## Claude Desktop Configuration

Add this to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "schichtplan": {
      "command": "python",
      "args": ["/path/to/your/project/src/backend/mcp_server.py"],
      "env": {
        "PYTHONPATH": "/path/to/your/project"
      }
    }
  }
}
```

## Web API Endpoints

When the Flask app is running, these endpoints are available:

- `GET /api/v2/mcp/status` - MCP service status
- `GET /api/v2/mcp/tools` - List available tools
- `GET /api/v2/mcp/resources` - List available resources
- `GET /api/v2/mcp/prompts` - List available prompts
- `POST /api/v2/mcp/test-tool` - Test a specific tool
- `GET /api/v2/mcp/config` - Client configuration info
- `GET /api/v2/mcp/health` - Health check

## Example Usage

### Basic Client Connection
```python
from fastmcp import Client

async with Client("src/backend/mcp_server.py") as client:
    # Get system status
    status = await client.call_tool("get_system_status", {})
    print(status.content)
    
    # Generate demo data
    await client.call_tool("generate_demo_data", {
        "employee_count": 10,
        "shift_count": 5
    })
    
    # Generate schedule
    result = await client.call_tool("generate_schedule", {
        "start_date": "2025-01-01",
        "end_date": "2025-01-07",
        "use_ai": False
    })
```

### Web API Testing
```bash
# Check MCP status
curl http://localhost:5000/api/v2/mcp/status

# Test a tool
curl -X POST http://localhost:5000/api/v2/mcp/test-tool \
  -H "Content-Type: application/json" \
  -d '{"tool_name": "get_system_status", "parameters": {}}'
```

## Future AI Features

This FastMCP integration provides the foundation for:

- **AI-Powered Schedule Optimization**: Use LLMs to optimize shift assignments
- **Intelligent Conflict Resolution**: AI assistance for scheduling conflicts
- **Predictive Analytics**: Forecast staffing needs and availability patterns
- **Natural Language Scheduling**: Voice/text-based schedule modifications
- **Smart Recommendations**: AI suggestions for schedule improvements

## Next Steps

1. **Install and Test**: Run `./start_mcp_server.sh install` then `./start_mcp_server.sh test`
2. **Explore Tools**: Use the client examples to understand available functionality
3. **Integrate with AI**: Connect Claude Desktop or other MCP-compatible AI tools
4. **Extend Functionality**: Add custom tools for your specific scheduling needs
5. **Deploy**: Use SSE or HTTP modes for production deployments

## Documentation

- **Full Documentation**: `src/backend/MCP_INTEGRATION.md`
- **FastMCP Official Docs**: https://gofastmcp.com
- **MCP Specification**: https://spec.modelcontextprotocol.io

## Support

If you encounter any issues:

1. Check `./start_mcp_server.sh status` for system health
2. Run `./start_mcp_server.sh test` to validate functionality
3. Check logs for detailed error messages
4. Verify database connectivity with the main Flask app

The FastMCP integration is now ready to power your AI-enhanced scheduling features! 🚀