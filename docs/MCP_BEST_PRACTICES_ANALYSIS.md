# MCP Server Best Practices Analysis

## Current Implementation Review

### ✅ Strengths

1. **FastMCP Usage** (v2.5.0+)

   - Using the latest FastMCP library
   - Proper async/await patterns throughout
   - Multiple transport support (stdio, SSE, HTTP)

2. **VS Code Integration Setup**

   - Created `.vscode/mcp.json` configuration file
   - Follows VS Code MCP server naming convention (camelCase: `schichtplanAssistent`)
   - Proper stdio transport configuration
   - Environment variables properly set

3. **Tool Organization**

   - Tools organized into logical categories (7 tool modules)
   - Clean separation of concerns
   - Proper tool registration pattern

4. **Server Architecture**
   - Standalone server script (`src/backend/mcp_server.py`)
   - Separate service layer (`mcp_service.py`)
   - Flask app integration for database access
   - Graceful error handling

### ⚠️ Areas for Improvement

## 1. VS Code MCP Configuration (mcp.json)

### Current Setup

```json
{
  "servers": {
    "schichtplanAssistent": {
      "type": "stdio",
      "command": "./src/backend/.venv/bin/python",
      "args": ["src/backend/mcp_server.py", "--transport", "stdio"],
      "env": {
        "PYTHONPATH": "${workspaceFolder}",
        "FLASK_ENV": "development",
        "FLASK_APP": "src.backend.app:create_app"
      }
    }
  }
}
```

### Best Practice Recommendations

#### a) Remove Redundant Transport Argument

The `--transport stdio` argument is redundant since it's the default. Simplify to:

```json
"args": ["src/backend/mcp_server.py"]
```

#### b) Add Development Mode Support

For debugging, add a development configuration:

```json
"servers": {
  "schichtplanAssistent": {
    "type": "stdio",
    "command": "./src/backend/.venv/bin/python",
    "args": ["src/backend/mcp_server.py"],
    "env": {
      "PYTHONPATH": "${workspaceFolder}",
      "FLASK_ENV": "development",
      "FLASK_APP": "src.backend.app:create_app"
    },
    "dev": {
      "watch": "src/backend/**/*.py",
      "debug": {
        "type": "debugpy",
        "port": 5678
      }
    }
  }
}
```

## 2. Server Implementation Issues

### Current Issues

#### a) Thread-Based Execution (Not Recommended)

```python
# Current implementation in mcp_server.py
def main_cli():
    def run_main():
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        try:
            new_loop.run_until_complete(main())
        finally:
            new_loop.close()

    thread = threading.Thread(target=run_main)
    thread.daemon = False
    thread.start()
    thread.join()
```

**Problem**: Threading adds unnecessary complexity and potential event loop conflicts.

**Best Practice**: Direct async execution

```python
if __name__ == "__main__":
    asyncio.run(main())
```

#### b) Deprecated FastMCP Methods

```python
# Current usage
await self.mcp.run_stdio_async()
await self.mcp.run_sse_async()
await self.mcp.run_streamable_http_async()
```

**Best Practice**: Use the unified `run()` method

```python
# For stdio (default)
await self.mcp.run()

# For SSE
from fastmcp.transports.sse import sse_transport
await self.mcp.run(transport=sse_transport(port=port))

# For HTTP
from fastmcp.transports.http import http_transport
await self.mcp.run(transport=http_transport(port=port))
```

## 3. Logging Configuration

### Current Implementation

```python
logging.basicConfig(
    level=getattr(logging, level.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stderr),
    ],
)
```

### Best Practice for Stdio Mode

For stdio transport, minimize stderr output to avoid protocol interference:

```python
def setup_logging(level: str = "INFO", transport: str = "stdio"):
    """Setup logging configuration."""
    if transport == "stdio":
        # Use file logging for stdio to avoid protocol interference
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler("mcp_server.log"),
            ],
        )
    else:
        # Use stderr for network transports
        logging.basicConfig(
            level=getattr(logging, level.upper()),
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[
                logging.StreamHandler(sys.stderr),
            ],
        )
```

## 4. Tool Registration

### Current Implementation

✅ Good pattern with separate tool classes

### Enhancement Recommendations

#### a) Add Tool Metadata

```python
@self.mcp.tool()
async def analyze_schedule(
    ctx,
    start_date: str,
    end_date: str,
    include_coverage: bool = True
):
    """
    Analyze schedule completeness and quality.

    Args:
        start_date: ISO format date (YYYY-MM-DD)
        end_date: ISO format date (YYYY-MM-DD)
        include_coverage: Include coverage analysis

    Returns:
        Detailed schedule analysis with metrics and recommendations
    """
    # Implementation
```

#### b) Add Resource Support

The VS Code docs mention that MCP servers can provide resources. Consider adding:

```python
@self.mcp.resource("schedule://{date}")
async def get_schedule_resource(ctx, date: str):
    """Get schedule data for a specific date."""
    # Return schedule data
```

## 5. Prompt Support

### Current Implementation

✅ Basic prompts registered

### Enhancement Recommendations

Add more contextual prompts:

```python
@self.mcp.prompt()
async def schedule_conflict_resolution(ctx, conflicts: list):
    """Generate resolution steps for schedule conflicts."""
    conflict_summary = "\n".join([
        f"- {c['type']}: {c['description']}"
        for c in conflicts
    ])
    return f"""Analyze these schedule conflicts and suggest resolutions:

{conflict_summary}

Consider:
1. Employee availability and preferences
2. Coverage requirements
3. Labor regulations
4. Shift distribution fairness
"""
```

## 6. Error Handling

### Current Implementation

Basic try-catch blocks present

### Best Practice Enhancement

```python
async def run_stdio(self):
    """Run the MCP server in stdio mode."""
    try:
        self.logger.info("Starting MCP server in stdio mode...")
        await self.mcp.run()
    except KeyboardInterrupt:
        self.logger.info("Server shutdown requested")
    except ConnectionError as e:
        self.logger.error(f"Connection error: {e}")
        raise
    except Exception as e:
        self.logger.error(f"Error running stdio server: {e}", exc_info=True)
        raise
    finally:
        # Cleanup
        await self.cleanup()
```

## 7. Server Naming and Discovery

### Current Status

✅ Good server naming: `schichtplanAssistent` (camelCase)

### Additional Recommendations

#### Update mcp_config.json metadata

The `mcp_config.json` is not used by VS Code but is good for documentation:

- Keep it for reference
- Update the README with VS Code-specific instructions

## 8. Security Considerations

### Recommendations

#### a) Trust Management

Since MCP servers can run arbitrary code, ensure:

- Clear documentation about what the server does
- Proper error messages for database access failures
- No execution of arbitrary user code

#### b) Environment Variables

Consider adding input variables for sensitive data:

```json
{
  "servers": {
    "schichtplanAssistent": {
      "type": "stdio",
      "command": "./src/backend/.venv/bin/python",
      "args": ["src/backend/mcp_server.py"],
      "env": {
        "PYTHONPATH": "${workspaceFolder}",
        "FLASK_ENV": "development",
        "DATABASE_URL": "${input:database-url}"
      }
    }
  },
  "inputs": [
    {
      "type": "promptString",
      "id": "database-url",
      "description": "Database connection URL",
      "password": false
    }
  ]
}
```

## 9. Documentation

### Recommendations

#### a) Add VS Code MCP Setup Guide

Create `docs/VS_CODE_MCP_SETUP.md` with:

- Installation instructions
- How to use in agent mode
- Available tools list
- Example prompts

#### b) Tool Discovery

Ensure all tools have clear descriptions for VS Code's tool picker:

```python
@self.mcp.tool()
async def generate_schedule(ctx, week_start: str, constraints: dict = None):
    """
    🗓️ Generate optimized schedule for a week

    Creates a complete weekly schedule considering employee availability,
    coverage requirements, and labor regulations.

    Use this when: Starting a new schedule, regenerating a week, optimizing coverage
    """
```

## 10. Testing

### Add MCP Integration Tests

```python
# tests/test_mcp_integration.py
import pytest
from fastmcp.testing import MCPTestClient

@pytest.mark.asyncio
async def test_mcp_server_initialization():
    """Test MCP server starts and responds."""
    async with MCPTestClient("src/backend/mcp_server.py") as client:
        tools = await client.list_tools()
        assert len(tools) > 0
        assert any(t.name == "generate_schedule" for t in tools)

@pytest.mark.asyncio
async def test_schedule_generation_tool():
    """Test schedule generation through MCP."""
    async with MCPTestClient("src/backend/mcp_server.py") as client:
        result = await client.call_tool("generate_schedule", {
            "week_start": "2025-10-13",
        })
        assert result is not None
        assert "schedule_id" in result
```

## Summary of Required Changes

### Priority 1 (Critical)

1. ✅ Create `.vscode/mcp.json` - **DONE**
2. 🔧 Remove threading in `main_cli()` - use direct `asyncio.run()`
3. 🔧 Update to use `mcp.run()` instead of deprecated `run_stdio_async()`

### Priority 2 (Important)

4. 🔧 Update logging for stdio mode (use file logging)
5. 📝 Add development mode configuration with watch and debug
6. 📝 Update tool descriptions with emojis and clear use cases

### Priority 3 (Enhancement)

7. 📝 Add resource support for schedules, employees
8. 📝 Add more contextual prompts
9. 📝 Create VS Code MCP setup documentation
10. 🧪 Add MCP integration tests

## Next Steps

1. Apply Priority 1 changes to `src/backend/mcp_server.py`
2. Test MCP server in VS Code agent mode
3. Add development mode configuration
4. Create user documentation
5. Add integration tests
