# ShiftWise MCP Server

This directory contains the MCP (Model-Claude-Protocol) server integration for the ShiftWise application. The MCP server provides AI-enhanced tools and resources for interacting with the ShiftWise application.

## Setup

1. Create a virtual environment (if not already created):
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

2. Install the required packages:
   ```bash
   pip install -r src/mcp/requirements.txt
   ```

## Running the MCP Server

To start the MCP server in development mode:

```bash
mcp dev src/mcp/server.py
```

This will start the server with hot-reloading enabled.

## Available Resources

The MCP server provides the following resources:

- `greeting`: Returns a welcome message
- `get_employees`: Returns all employees
- `get_employee(employee_id)`: Returns a specific employee
- `get_shifts`: Returns all shifts
- `get_schedules`: Returns all schedules
- `get_schedule(schedule_id)`: Returns a specific schedule
- `get_settings`: Returns application settings

## Available Tools

The MCP server provides the following tools:

- `create_employee`: Creates a new employee
- `update_employee`: Updates an existing employee
- `delete_employee`: Deletes an employee
- `generate_schedule`: Generates a new schedule
- `export_schedule_pdf`: Exports a schedule as PDF

## Integration with Claude Desktop

To integrate with Claude Desktop, configure the Claude Desktop settings to point to your MCP server URL (typically `http://localhost:8000` when running in development mode).

## Security

In a production environment, make sure to:

1. Configure proper authentication
2. Set up HTTPS
3. Implement rate limiting
4. Use environment variables for sensitive information 