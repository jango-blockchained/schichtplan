# Schichtplan MCP Server API Documentation

## Overview

The Schichtplan MCP (Model Context Protocol) Server provides AI tools with comprehensive access to the shift scheduling system. It exposes tools, resources, and prompts that enable AI applications to interact with employee data, shift templates, schedules, and optimization algorithms.

## Quick Start

### 1. Start the MCP Server

```bash
# Start with backend and frontend
./start.sh --with-mcp

# Or start MCP server standalone
python3 src/backend/mcp_server.py --transport sse --port 8001
```

### 2. Connect from AI Tools

For tools supporting MCP:
- **stdio**: Direct process communication
- **SSE**: `http://localhost:8001/sse`
- **HTTP**: `http://localhost:8002/mcp`

### 3. Test the Connection

```bash
# Run example client
python3 examples/mcp_client_examples.py --transport stdio
```

## Server Information

Use `get_server_info` to get basic server information:

```json
{
  "name": "Schichtplan MCP Server",
  "version": "1.0.0",
  "description": "Model Context Protocol server for Schichtplan shift scheduling application",
  "protocol_version": "2024-11-05",
  "supported_transports": ["stdio", "sse", "streamable-http"],
  "features": [
    "Employee management",
    "Shift template management",
    "Schedule generation (AI and traditional)",
    "System status monitoring",
    "Demo data generation"
  ]
}
```

## Available Tools

### Core Information Tools

#### `get_server_info()`
Returns server metadata, version, and capabilities.

#### `get_capabilities()`
Returns detailed information about all available tools, resources, and prompts.

#### `get_system_status()`
Returns current system status including database statistics.

```json
{
  "database": "connected",
  "employees": {
    "total": 15,
    "active": 12,
    "keyholders": 3
  },
  "shift_templates": {
    "total": 8,
    "active": 6
  },
  "schedules": {
    "total": 5
  }
}
```

### Employee Management

#### `get_employees(active_only=True, include_details=False)`
Retrieve employee information.

**Parameters:**
- `active_only` (boolean): Filter for active employees only
- `include_details` (boolean): Include detailed information

**Returns:**
```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "is_active": true,
    "is_keyholder": false,
    "gfb_status": "geringfügig beschäftigt"
  }
]
```

### Shift Template Management

#### `get_shift_templates(active_only=True)`
Retrieve shift template definitions.

**Parameters:**
- `active_only` (boolean): Filter for active templates only

**Returns:**
```json
[
  {
    "id": 1,
    "name": "Morning Shift",
    "start_time": "08:00",
    "end_time": "16:00",
    "duration_hours": 8.0,
    "color": "#FF5733",
    "requires_keyholder": false,
    "max_employees": 2
  }
]
```

### Schedule Management

#### `generate_schedule(start_date, end_date, use_ai=False, version=None)`
Generate a new schedule for the specified date range.

**Parameters:**
- `start_date` (string): Start date in YYYY-MM-DD format
- `end_date` (string): End date in YYYY-MM-DD format
- `use_ai` (boolean): Whether to use AI-powered scheduling
- `version` (integer, optional): Version number for the schedule

**Returns:**
```json
{
  "status": "success",
  "schedule_id": 123,
  "message": "Schedule generated for 2024-01-01 to 2024-01-07",
  "assignments_count": 56
}
```

#### `get_schedule(start_date, end_date, version=None)`
Retrieve existing schedule for the specified date range.

**Parameters:**
- `start_date` (string): Start date in YYYY-MM-DD format
- `end_date` (string): End date in YYYY-MM-DD format
- `version` (integer, optional): Version number

**Returns:**
```json
{
  "schedules": [
    {
      "id": 123,
      "start_date": "2024-01-01",
      "end_date": "2024-01-07",
      "version": 1,
      "assignments": [
        {
          "id": 456,
          "date": "2024-01-01",
          "employee_id": 1,
          "employee_name": "John Doe",
          "shift_template_id": 1,
          "shift_name": "Morning Shift",
          "start_time": "08:00",
          "end_time": "16:00"
        }
      ]
    }
  ],
  "total_assignments": 56
}
```

### Development and Testing

#### `generate_demo_data(employee_count=15, shift_count=8, coverage_blocks=5)`
Generate demo data for testing and development.

**Parameters:**
- `employee_count` (integer): Number of employees to create
- `shift_count` (integer): Number of shift templates to create
- `coverage_blocks` (integer): Number of coverage requirements to create

## Available Resources

### System Configuration
- **URI**: `config://system`
- **Content-Type**: `application/json`
- **Description**: System configuration and settings

### Employee Details
- **URI**: `employees://{employee_id}`
- **Content-Type**: `application/json`
- **Description**: Detailed information about a specific employee
- **Parameters**: `employee_id` (integer)

## Available Prompts

### Schedule Analysis
- **Name**: `schedule_analysis_prompt`
- **Parameters**: `schedule_data` (string - JSON schedule data)
- **Description**: Generate AI prompt for analyzing schedule data

### Employee Scheduling
- **Name**: `employee_scheduling_prompt`
- **Parameters**: 
  - `employee_data` (string - JSON employee data)
  - `requirements` (string - Scheduling requirements)
- **Description**: Generate AI prompt for employee scheduling decisions

## Transport Protocols

### stdio
Direct standard input/output communication. Best for:
- Desktop AI applications
- Command-line tools
- Direct process integration

```bash
python3 src/backend/mcp_server.py
```

### Server-Sent Events (SSE)
HTTP-based streaming protocol. Best for:
- Web applications
- Browser-based AI tools
- Real-time updates

```bash
python3 src/backend/mcp_server.py --transport sse --port 8001
```

Connect to: `http://localhost:8001/sse`

### Streamable HTTP
HTTP-based request/response protocol. Best for:
- REST API integration
- HTTP-based AI services
- Traditional web services

```bash
python3 src/backend/mcp_server.py --transport http --port 8002
```

Connect to: `http://localhost:8002/mcp`

## Integration Examples

### Claude Desktop Integration

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "schichtplan": {
      "command": "python3",
      "args": ["src/backend/mcp_server.py"],
      "cwd": "/path/to/schichtplan"
    }
  }
}
```

### OpenAI Integration

For OpenAI tools that support MCP, use the SSE endpoint:

```python
import openai

client = openai.Client(
    base_url="http://localhost:8001/sse",
    api_key="your-api-key"
)
```

### Custom Integration

Use the example client as a starting point:

```python
from examples.mcp_client_examples import SchichtplanMCPClient

client = SchichtplanMCPClient(transport="stdio")
await client.connect_stdio()
```

## Error Handling

All tools return structured error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "traceback": "Detailed error information"
}
```

## Logging

MCP server logs are written to:
- Console: Standard error (stderr)
- File: `src/logs/tmux_mcp_output.log` (when run via start.sh)

Log levels: DEBUG, INFO, WARNING, ERROR

## Security Considerations

- The MCP server runs locally and accesses the local database
- No authentication is required for local connections
- For network transports, ensure proper firewall configuration
- Consider using HTTPS/TLS for production deployments

## Performance

- stdio transport: Lowest latency, best for single client
- SSE transport: Good for multiple concurrent clients
- HTTP transport: Standard REST API performance

## Troubleshooting

### Connection Issues
1. Check if the server is running: `netstat -tlnp | grep 8001`
2. Verify the correct port and transport
3. Check logs in `src/logs/tmux_mcp_output.log`

### Tool Errors
1. Ensure the database is accessible
2. Check Flask app context is available
3. Verify all dependencies are installed

### Performance Issues
1. Use `get_system_status` to check database health
2. Monitor resource usage
3. Consider using connection pooling for high-volume usage
