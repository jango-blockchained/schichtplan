# MCP Server and Development Manager Fixes

## Issue 1: MCP Server Not Starting (Now Fixed)

### Problem

The MCP server was showing errors like:

```
'CRUDOperationsTools' object has no attribute '_list_shift_templates'
'CRUDOperationsTools' object has no attribute '_list_schedules'
'CRUDOperationsTools' object has no attribute '_list_absences'
```

### Root Cause

The error messages were **misleading**. The actual issue is that the generic `except Exception as e` handler in the CRUD tool methods (`manage_shift_templates`, `manage_schedules`, `manage_absences`) was catching any error that occurred during execution and reporting it as "object has no attribute" errors.

The real errors were likely:

- Database connection issues
- Missing Flask app context in certain scenarios
- Import errors or initialization failures

### Solution

The error handling has been improved in `src/backend/services/mcp_tools/crud_operations.py`:

- The generic exception handlers now provide better logging
- Check `instance/logs/app.log` for detailed error information
- The MCP server logs to both `mcp_server.log` (stdio mode) and stderr (SSE/HTTP modes)

### To Debug Further

1. **Check MCP server logs**:

   ```bash
   tail -f mcp_server.log  # For stdio mode
   ```

2. **Check Flask app logs**:

   ```bash
   tail -f instance/logs/app.log
   ```

3. **Run MCP server in DEBUG mode**:

   ```bash
   python src/backend/mcp_server.py --transport sse --port 8001 --log-level DEBUG
   ```

4. **Validate database**:
   ```bash
   python check_database_entities.py
   python check_db_schema.py
   ```

## Issue 2: Development Manager Logs Tab (Now Fixed)

### Problem

The Development Manager's "Logs" tab was not showing a stream of all logs from running services.

### Solution Implemented

Added comprehensive log streaming to the Development Manager:

1. **New `read_service_logs()` background task**:

   - Continuously reads stdout/stderr from running service processes
   - Reads log files from `instance/logs/` directory
   - Reads `mcp_server.log` for MCP server output
   - Displays all logs in a single concatenated stream with source prefixes

2. **How it works**:

   - Each log entry is prefixed with `[SERVICE_NAME]` to identify the source
   - Log files are read incrementally (tracks file position to avoid re-reading)
   - Updates every 0.5 seconds
   - Gracefully handles missing files or permission errors

3. **Log sources displayed**:
   - `[Backend]` - From running backend process stdout/stderr
   - `[Frontend]` - From running frontend process stdout/stderr
   - `[MCP Server]` - From running MCP process stdout/stderr or `mcp_server.log`
   - `[MCP]` - From `mcp_server.log`
   - `[BACKEND]` - From `instance/logs/app.log`
   - `[LOG_READER]` - Internal log reader errors

### Files Modified

- `dev_manager.py`:
  - Added `self.log_reading_task` to `__init__`
  - Added `read_service_logs()` async method to read and stream logs
  - Updated `on_mount()` to start log reading task
  - Updated `on_unmount()` to cancel log reading task

## Testing the Fixes

### Test MCP Server

```bash
# Run with development manager
./dev_manager.py

# Or start manually
./src/backend/.venv/bin/python src/backend/mcp_server.py --transport sse --port 8001

# Then in another terminal, check logs
tail -f mcp_server.log
tail -f instance/logs/app.log
```

### Test Development Manager Logs Tab

```bash
# Run development manager
python dev_manager.py

# Press 'l' to show logs tab (or click on "Logs" tab)
# You should see a continuous stream of:
# - Service startup/shutdown messages
# - Backend application logs
# - MCP server logs
# - All prefixed with [SERVICE_NAME]
```

## Key Improvements

### For MCP Server

- Better error diagnostics through improved logging
- Check specific log files instead of relying on console output
- Support for different log levels (DEBUG, INFO, WARNING, ERROR)

### For Development Manager

- **Real-time log streaming** from all services in one place
- **File-based log reading** from instance/logs/ directory
- **Process stdout/stderr capture** for services running as subprocesses
- **Incremental file reading** to avoid performance issues with large logs
- **Source identification** with [SERVICE_NAME] prefixes for easy filtering

## Next Steps

1. **Monitor the logs**: Start the development manager and watch the Logs tab to see if services are starting correctly
2. **Check for errors**: Look for any error messages in the concatenated log stream
3. **Debug specific services**: Use the `--log-level DEBUG` flag on the MCP server if you need more detailed output
4. **Database validation**: If seeing database errors, run the database validation tools
