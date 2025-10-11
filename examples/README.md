# Schichtplan Examples

This directory contains example code and reference implementations.

## MCP Examples (`mcp/`)

Examples for working with the Model Context Protocol (MCP) integration:

- `mcp_client_example.py` - Demonstrates how to connect to and interact with the Schichtplan MCP server
- `mcp_server_minimal.py` - Minimal MCP server implementation
- `mcp_server_simplified.py` - Simplified MCP server for testing
- `mcp_server_enhanced.py` - Enhanced MCP server with additional features

## Other Examples

- `import_example.py` - Shows how to update imports from the old monolithic scheduler to the new modular structure
- `ai_routes_enhanced_final.py` - Example of enhanced AI routes implementation

## Usage

### Running MCP Client Example

```bash
# From project root
python examples/mcp/mcp_client_example.py
```

This will demonstrate:
- Connecting to MCP server via stdio
- Listing available tools
- Calling MCP tools
- Schedule generation via MCP

### Starting MCP Servers

```bash
# Minimal server
python examples/mcp/mcp_server_minimal.py --transport sse

# Simplified server
python examples/mcp/mcp_server_simplified.py --transport sse

# Enhanced server
python examples/mcp/mcp_server_enhanced.py --transport sse
```

## Production MCP Server

For production use, see the main MCP server at `src/backend/mcp_server.py` or the conversational AI server started via `start_conversational_ai.py`.

## Import Migration Example

The `import_example.py` file shows how to migrate from old imports:

```python
# Old (deprecated)
from services.schedule_generator import ScheduleGenerator

# New (current)
from services.scheduler import ScheduleGenerator
```
