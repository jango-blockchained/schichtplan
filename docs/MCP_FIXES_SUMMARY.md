# MCP Server Critical Fixes Summary

## Issues Fixed

### 1. **CRITICAL: AsyncIO Event Loop Conflict** ✅

**Problem:** Server was exiting with code 1 immediately after initialization with error:

```
RuntimeError: Already running asyncio in this thread
```

**Root Cause:**

- `mcp.run()` internally calls `anyio.run()` to create a new event loop
- But we were already inside an event loop created by `asyncio.run(main())` in `mcp_server.py`
- This caused a nested event loop error

**Solution:**

- Changed `await self.mcp.run()` → `await self.mcp.run_async()` in all transport methods:
  - `run_stdio()` - stdio transport
  - `run_sse()` - SSE transport
  - `run_streamable_http()` - HTTP transport

**Files Modified:**

- `src/backend/services/mcp_service.py` (lines 780, 795, 809)

---

### 2. **Pydantic V2 Schema Deprecation** ✅

**Problem:** Warning messages in stderr:

```
PydanticDeprecatedSince20: Support for class-based `config` is deprecated,
use ConfigDict instead. Deprecated in Pydantic V2.0 to be removed in V3.0.
See Pydantic V2 Migration Guide at https://errors.pydantic.dev/2.5/migration/
```

**Root Cause:**

- Pydantic V2 renamed `Config.schema_extra` to `Config.json_schema_extra`
- 3 occurrences across the codebase

**Solution:**
Changed all `schema_extra` → `json_schema_extra`:

1. `src/backend/schemas/ai_schedule.py` - 2 occurrences (lines 29, 55)
2. `src/backend/schemas/settings.py` - 1 occurrence (line 768)

**Files Modified:**

- `src/backend/schemas/ai_schedule.py`
- `src/backend/schemas/settings.py`

---

### 3. **SQLAlchemy 2.0 Import Deprecation** ✅

**Problem:** Warning message:

```
SADeprecationWarning: The declarative_base() function is now available as
sqlalchemy.orm.declarative_base(). (deprecated since: 2.0)
```

**Root Cause:**

- SQLAlchemy 2.0 moved `declarative_base` from `sqlalchemy.ext.declarative` to `sqlalchemy.orm`

**Solution:**
Updated import statement:

```python
# Before
from sqlalchemy.ext.declarative import declarative_base

# After
from sqlalchemy.orm import declarative_base
```

**Files Modified:**

- `src/backend/services/conversation_manager.py` (line 10)

---

## Testing Steps

### Quick Test

```bash
# Navigate to project root
cd /home/jango/Git/maike2/schichtplan

# Run MCP server in stdio mode (default)
./src/backend/.venv/bin/python src/backend/mcp_server.py

# Server should now start without errors and stay running
```

### VS Code Integration Test

1. Reload VS Code window (Cmd/Ctrl + Shift + P → "Developer: Reload Window")
2. Check MCP server status in VS Code output panel
3. Open Copilot Chat and try MCP commands:
   - `@schichtplanAssistent What resources are available?`
   - `@schichtplanAssistent Show me employee data`

### Expected Behavior

- ✅ No deprecation warnings in logs
- ✅ Server starts and stays running (doesn't exit with code 1)
- ✅ VS Code can initialize connection and send requests
- ✅ Resources and prompts are accessible

---

## Technical Details

### FastMCP API Usage

```python
# ❌ WRONG - Creates nested event loop
await mcp.run()

# ✅ CORRECT - Uses existing event loop
await mcp.run_async()
```

### Event Loop Context

- `mcp.run()` - Use when starting server from synchronous code
- `mcp.run_async()` - Use when already inside an async function/event loop

### Why This Matters

The `run_async()` method is designed for integration scenarios where:

1. You already have an async application (like our Flask app with async routes)
2. You want to embed MCP server functionality
3. You need to share the same event loop

---

## Next Steps

### Immediate

1. ✅ Test server startup and verify no errors
2. Test VS Code integration
3. Verify resources and prompts work correctly

### Future Enhancements (Priority Order)

4. **Development Mode** - Add watch/debug features for easier development
5. **Integration Tests** - Create automated tests for MCP functionality
6. **Performance Monitoring** - Add metrics and logging for production use
7. **Documentation** - Expand usage examples for each resource and prompt

---

## Files Changed Summary

```
src/backend/services/mcp_service.py          - AsyncIO fix (run() → run_async())
src/backend/services/conversation_manager.py - SQLAlchemy import fix
src/backend/schemas/ai_schedule.py          - Pydantic schema_extra → json_schema_extra (2x)
src/backend/schemas/settings.py             - Pydantic schema_extra → json_schema_extra (1x)
```

---

## References

- [FastMCP Documentation](https://github.com/jlowin/fastmcp)
- [Pydantic V2 Migration Guide](https://docs.pydantic.dev/latest/migration/)
- [SQLAlchemy 2.0 Documentation](https://docs.sqlalchemy.org/en/20/)
- [VS Code MCP Integration Guide](../../.vscode/mcp.json)

---

**Status:** ✅ All critical issues resolved
**Last Updated:** 2025-10-08
**Next Milestone:** VS Code integration testing
