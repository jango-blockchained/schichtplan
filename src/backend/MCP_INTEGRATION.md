# FastMCP Integration for Schichtplan

This document describes the FastMCP (Model Context Protocol) integration in the Schichtplan application. FastMCP enables AI applications to interact with the shift planning system through standardized tools, resources, and prompts.

## Overview

The FastMCP integration exposes core Schichtplan functionality through the Model Context Protocol, allowing AI systems to:

- Query employee and shift data
- Generate and manage schedules
- Access system configuration
- Analyze scheduling patterns
- Generate demo data for testing

## Architecture

The MCP integration consists of several components:

```
src/backend/
├── services/
│   └── mcp_service.py        # Core MCP service implementation
├── routes/
│   └── mcp_routes.py         # Flask routes for MCP web integration
├── mcp_server.py             # Standalone MCP server script
└── examples/
    └── mcp_client_example.py # Example MCP client
```

## Transport Modes

The FastMCP integration supports three transport protocols:

### 1. STDIO (Standard Input/Output)
- **Best for**: Local tools, command-line scripts, AI assistants like Claude Desktop
- **Usage**: Process-based communication
- **Security**: Runs in same process space

### 2. SSE (Server-Sent Events)
- **Best for**: Web-based applications, real-time updates
- **Usage**: HTTP-based streaming
- **Security**: Network accessible with standard HTTP security

### 3. Streamable HTTP
- **Best for**: Modern web deployments, microservices
- **Usage**: HTTP-based with enhanced streaming capabilities
- **Security**: Network accessible with standard HTTP security

## Available Tools

The MCP server exposes the following tools:

### Core Data Access
- `get_employees(active_only, include_details)` - Retrieve employee information
- `get_shift_templates(active_only)` - Get shift template definitions
- `get_system_status()` - Get system status and database statistics

### Schedule Management
- `generate_schedule(start_date, end_date, use_ai, version)` - Generate new schedules
- `get_schedule(start_date, end_date, version)` - Retrieve existing schedules

### Development & Testing
- `generate_demo_data(employee_count, shift_count, coverage_blocks)` - Create test data

## Available Resources

Resources provide read-only access to system data:

- `config://system` - System configuration settings
- `employees://{employee_id}` - Detailed employee information

## Available Prompts

Prompts provide templates for AI interactions:

- `schedule_analysis_prompt(schedule_data)` - Analyze schedule data
- `employee_scheduling_prompt(employee_data, requirements)` - Optimize scheduling decisions

## Quick Start

### 1. Install Dependencies

```bash
# Install FastMCP
pip install -r src/backend/requirements.txt
```

### 2. Run MCP Server

#### STDIO Mode (Default)
```bash
python src/backend/mcp_server.py
```

#### SSE Mode
```bash
python src/backend/mcp_server.py --transport sse --port 8001
```

#### Streamable HTTP Mode
```bash
python src/backend/mcp_server.py --transport http --port 8002
```

### 3. Test the Integration

```bash
# Run the example client
python src/backend/examples/mcp_client_example.py
```

### 4. Web Integration

The MCP service is also integrated into the Flask web application:

```bash
# Start the main Flask app
python src/backend/app.py

# Access MCP status via web API
curl http://localhost:5000/api/v2/mcp/status
```

## Usage Examples

### Basic Client Connection

```python
from fastmcp import Client

# Connect via stdio
async with Client("src/backend/mcp_server.py") as client:
    # List available tools
    tools = await client.list_tools()
    
    # Get system status
    status = await client.call_tool("get_system_status", {})
    print(status.content)
```

### Schedule Generation

```python
# Generate demo data first
await client.call_tool("generate_demo_data", {
    "employee_count": 15,
    "shift_count": 8,
    "coverage_blocks": 5
})

# Generate a schedule
result = await client.call_tool("generate_schedule", {
    "start_date": "2025-01-01",
    "end_date": "2025-01-07",
    "use_ai": False
})
```

### Web API Access

```bash
# Get MCP service status
curl http://localhost:5000/api/v2/mcp/status

# List available tools
curl http://localhost:5000/api/v2/mcp/tools

# Test a tool via web API
curl -X POST http://localhost:5000/api/v2/mcp/test-tool \
  -H "Content-Type: application/json" \
  -d '{"tool_name": "get_system_status", "parameters": {}}'
```

## Claude Desktop Integration

To use with Claude Desktop, add this to your MCP configuration:

```json
{
  "mcpServers": {
    "schichtplan": {
      "command": "python",
      "args": ["path/to/src/backend/mcp_server.py"],
      "env": {
        "PYTHONPATH": "path/to/project"
      }
    }
  }
}
```

## Advanced Usage

### Custom Context Creation

```python
from src.backend.app import create_app
from src.backend.services.mcp_service import SchichtplanMCPService

# Create Flask app context
app = create_app()

# Create MCP service with specific app context
with app.app_context():
    mcp_service = SchichtplanMCPService(app)
    mcp_server = mcp_service.get_mcp_server()
```

### Error Handling

The MCP service includes comprehensive error handling:

```python
try:
    result = await client.call_tool("generate_schedule", {
        "start_date": "invalid-date",
        "end_date": "2025-01-07"
    })
except Exception as e:
    print(f"Tool execution failed: {e}")
```

### Logging and Monitoring

The MCP service logs all operations:

```python
import logging

# Configure logging level
logging.basicConfig(level=logging.DEBUG)

# Run server with detailed logging
python src/backend/mcp_server.py --log-level DEBUG
```

## Security Considerations

### STDIO Mode
- Runs in same process space as client
- Inherits client's security context
- No network exposure

### Network Modes (SSE/HTTP)
- Accessible over network
- Consider implementing authentication
- Use HTTPS in production
- Implement rate limiting

### Database Access
- MCP tools access the same database as the main application
- All database operations respect existing permissions
- Consider read-only access for some tools

## Development

### Adding New Tools

```python
@self.mcp.tool()
async def my_new_tool(param1: str, param2: int, ctx: Context = None) -> Dict[str, Any]:
    """Description of what this tool does."""
    try:
        # Tool implementation
        result = {"status": "success", "data": "example"}
        await ctx.info(f"Tool executed successfully")
        return result
    except Exception as e:
        await ctx.error(f"Tool failed: {str(e)}")
        raise
```

### Adding New Resources

```python
@self.mcp.resource("my_resource://{parameter}")
def get_my_resource(parameter: str) -> str:
    """Get custom resource data."""
    try:
        # Resource implementation
        data = {"parameter": parameter, "data": "example"}
        return json.dumps(data, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, indent=2)
```

### Testing

```bash
# Run all tests
python -m pytest src/backend/tests/

# Test MCP functionality specifically
python src/backend/examples/mcp_client_example.py
```

## Troubleshooting

### Common Issues

1. **Import Errors**
   ```bash
   # Ensure PYTHONPATH includes project root
   export PYTHONPATH="$(pwd):$PYTHONPATH"
   ```

2. **Database Connection Issues**
   ```bash
   # Ensure Flask app can connect to database
   python -c "from src.backend.app import create_app; app=create_app(); print('Database OK')"
   ```

3. **Port Conflicts**
   ```bash
   # Use different ports for different transports
   python src/backend/mcp_server.py --transport sse --port 8003
   ```

### Debug Mode

```bash
# Run with maximum logging
python src/backend/mcp_server.py --log-level DEBUG --transport sse
```

### Validation

```bash
# Validate MCP server functionality
python src/backend/examples/mcp_client_example.py
```

## Future Enhancements

Potential areas for expansion:

1. **Authentication & Authorization**
   - OAuth integration
   - Role-based access control
   - API key management

2. **Real-time Features**
   - Live schedule updates
   - Notification system
   - Event streaming

3. **Advanced AI Features**
   - Schedule optimization algorithms
   - Predictive analytics
   - Intelligent recommendations

4. **Performance Optimization**
   - Caching strategies
   - Database query optimization
   - Async processing

5. **Monitoring & Observability**
   - Metrics collection
   - Performance monitoring
   - Usage analytics

## Contributing

When adding new MCP functionality:

1. Follow the existing patterns in `mcp_service.py`
2. Add comprehensive docstrings
3. Include error handling
4. Add tests for new functionality
5. Update this documentation

## Support

For issues related to FastMCP integration:

1. Check the logs for detailed error messages
2. Verify database connectivity
3. Test with the example client
4. Consult the FastMCP documentation at https://gofastmcp.com