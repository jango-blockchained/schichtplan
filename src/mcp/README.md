# Schichtplan MCP Server

This directory contains the Model Context Protocol (MCP) server for the Schichtplan application, enabling interaction with shift scheduling data and tools through AI assistants like Claude.

## Overview

The MCP server exposes resources (read-only data) and tools (actions) that can be used by AI assistants to interact with the Schichtplan application. This allows the AI to retrieve employee data, view schedules, generate new schedules, and more.

## Server Implementations

The project provides two server implementations:

1. **Real Server** (`server.py`) - Connects to the actual backend database and services. Use this for production use and when you want to work with real data.

2. **Simplified Server** (`simple_server.py`) - Uses mock data and doesn't require database access. This is useful for development, testing, and demonstration purposes.

## Setup

1. Ensure you have Python 3.8+ installed
2. Create a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r src/mcp/requirements.txt
   ```

## Running the Server

Use the `mcp-shifts` command-line tool to start the server:

```bash
# Start the real server in development mode
mcp-shifts 

# Start the simplified server in development mode
mcp-shifts --simplified

# Start in production mode
mcp-shifts run

# Start the simplified server in production mode
mcp-shifts run --simplified

# Specify a port
mcp-shifts --port 9000

# Show verbose output
mcp-shifts --verbose
```

Once running, the server will be available at:
- Development mode (default): http://localhost:8000
- With MCP Inspector UI: http://localhost:8000/mcp

## Available Resources

The MCP server provides the following resources (read-only data):

| Resource | URL | Description |
|----------|-----|-------------|
| Greeting | `/greeting` | Welcome message and server info |
| Employees | `/employees` | List of all employees |
| Employee | `/employees/{id}` | Details of a specific employee |
| Shifts | `/shifts` | List of all shift templates |
| Schedules | `/schedules` | List of all schedules |
| Schedule | `/schedules/{id}` | Details of a specific schedule |
| Absences | `/absences` | List of employee absences |
| Settings | `/settings` | Application settings |

## Available Tools

The MCP server provides the following tools (actions):

| Tool | Parameters | Description |
|------|------------|-------------|
| create_employee | first_name, last_name, role, email, phone, hourly_rate, max_hours, skills | Create a new employee |
| update_employee | employee_id, first_name, last_name, role, email, phone, hourly_rate, max_hours, skills, active | Update an existing employee |
| delete_employee | employee_id | Deactivate an employee |
| generate_schedule | start_date, end_date, name, employees, constraints | Generate a new schedule |
| publish_schedule | schedule_id | Publish a schedule |
| export_schedule_pdf | schedule_id, include_employee_details, include_costs | Export a schedule as PDF |

## Testing Tools Manually

You can test the tools using curl or any API tool:

```bash
# Create an employee
curl -X POST http://localhost:8000/tools/create_employee \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Alice", "last_name": "Cooper", "role": "Manager", "hourly_rate": 22.50}'

# Generate a schedule
curl -X POST http://localhost:8000/tools/generate_schedule \
  -H "Content-Type: application/json" \
  -d '{"start_date": "2023-10-01"}'
```

## Integration with Claude

To use this MCP server with Claude:

1. Start the MCP server with `mcp-shifts` (use the real server for actual data)
2. In Claude Desktop, go to Settings > Integrations
3. Add a new integration with URL `http://localhost:8000`
4. Claude will now have access to the tools and resources provided by this server

## Development

### Real vs. Simplified Server

- **Real Server**: Connects to your actual database and uses your backend services. Changes made through this server affect your real data.
- **Simplified Server**: Uses mock data that doesn't persist between server restarts. Good for testing and development.

### Adding a New Resource

To add a new resource:

1. Add a new static method to the `Resources` class in `server.py` (or `SimpleResources` in `simple_server.py`)
2. Add a new route for the resource
3. Ensure the resource returns properly formatted JSON data

### Adding a New Tool

To add a new tool:

1. Add a new static method to the `Tools` class in `server.py` (or `SimpleTools` in `simple_server.py`)
2. Register the tool in the `_setup_tools` method of the `MCP` class 
3. Add a route for manual testing
4. Ensure the tool handles errors gracefully and returns structured responses

## License

This MCP server is part of the Schichtplan application and follows the same licensing terms.

# Troubleshooting

If you encounter issues with the MCP server, here are some common problems and solutions:

## Connection Issues

If you can't connect to the server from Claude or using curl:

1. **Check if the server is running**:
   ```bash
   ps aux | grep python | grep mcp
   ```

2. **Verify the port is not in use**:
   ```bash
   lsof -i :8000
   ```

3. **Test connectivity with curl**:
   ```bash
   curl http://127.0.0.1:8000/greeting
   ```

4. **Try a different port**:
   ```bash
   mcp-shifts --claude --port 9000
   ```
   Then use `http://127.0.0.1:9000` in Claude's integration settings.

5. **Use localhost instead of IP**:
   If 127.0.0.1 doesn't work, try using `localhost`:
   ```bash
   curl http://localhost:8000/greeting
   ```

## Import Errors

If you see errors like `ImportError: cannot import name 'FastMCP'`:

1. The `__init__.py` file may be trying to import classes that don't exist. This has been fixed in the latest version.

2. Make sure you're running the server directly with:
   ```bash
   python src/mcp/claude_server.py
   ```
   or using the `mcp-shifts` script.

## MCP Protocol Errors

If Claude reports issues parsing JSON from the server:

1. Make sure you're running the latest version of the Claude-specific server:
   ```bash
   mcp-shifts --claude
   ```

2. Verify the server is outputting proper JSON:
   ```bash
   curl http://127.0.0.1:8000/mcp/openapi.json
   ```

## Running the Test Server

To verify if your local network setup allows server connections, you can run the test server:

```bash
python test_server.py
```

Then try connecting to it:
```bash
curl http://127.0.0.1:5000/
curl http://127.0.0.1:5000/json
```

If these work but the MCP server doesn't, the issue is likely with the MCP server configuration, not your network.

## Claude Integration with stdio Transport

For the most reliable integration with Claude, you should use the stdio transport type, which requires running the server with the MCP CLI.

### Running the Server for Claude Integration

```bash
# Start the Claude-specific server with MCP CLI for stdio transport
mcp-shifts --claude --use-mcp-cli

# If you want to use the full server with real data
mcp-shifts --use-mcp-cli
```

When running with the `--use-mcp-cli` option:
1. All console output will be redirected to log files
2. The server will communicate with Claude using the stdio transport
3. The MCP protocol will handle all the JSON messaging correctly

## Connecting to an Existing Backend

The MCP server can now act as a proxy to an existing running backend application instead of starting its own instance. This is useful when you want to:

1. Use an existing backend that's already running
2. Connect to a backend running on a different machine
3. Avoid duplicating the backend processes

### How to Connect to an Existing Backend

By default, the MCP server connects to a backend running at `http://127.0.0.1:5000`. You can specify a different backend URL with the `--backend-url` option:

```bash
# Connect to a backend running on the default URL (http://127.0.0.1:5000)
mcp-shifts --claude

# Connect to a backend running on a different port
mcp-shifts --claude --backend-url http://127.0.0.1:3000

# Connect to a backend running on a different host
mcp-shifts --claude --backend-url http://backend-server:5000
```

### How the Proxy Works

When using the proxy mode:

1. The MCP server starts on port 8000 (or the port you specify)
2. All API requests are forwarded to the backend URL
3. If the backend is unavailable, the server will fall back to mock data
4. Resources and tools will use the backend's implementation if available
5. The MCP protocol is handled by the proxy server, not the backend

This allows you to run a lightweight MCP server that connects to your full application backend, avoiding the need to duplicate database connections or business logic.

### Setting Up the Integration in Claude

1. In Claude Desktop, go to Settings > Integrations
2. Add a new integration with:
   - Name: Schichtplan MCP
   - Server Type: Command
   - Transport Type: stdio
   - Command: `mcp-shifts --claude --use-mcp-cli`
   - Working Directory: Your project directory
3. Click "Connect"

### Debugging the Integration

If you encounter issues with the Claude integration:

1. Check the log files in the `src/mcp` directory:
   - `claude_server.log` - Logs from the Claude-specific server
   - `server.log` - Logs from the real server
   - `simple_server.log` - Logs from the simplified server

2. Make sure you're running with the `--use-mcp-cli` option when integrating with Claude

3. If you need to test the server functionality without Claude, run without the MCP CLI option:
   ```bash
   mcp-shifts --claude
   ```
   Then use curl to test the endpoints. 