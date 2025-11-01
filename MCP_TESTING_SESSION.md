# MCP Server Testing Session Guide

## ✅ Current Status

The MCP server is successfully running and responding to requests. Here's what we've verified:

### Working Components

1. **Backend Flask Server** (port 5000)

   - ✅ MCP health check endpoint
   - ✅ MCP configuration endpoint
   - ✅ Tool discovery/listing
   - ✅ Resource management
   - ✅ Database connectivity

2. **MCP STDIO Server**

   - ✅ Running in background
   - ✅ Ready for client connections

3. **MCP SSE Server** (port 8001)
   - ✅ Running and responding
   - ✅ Ready for streaming connections

### Registered MCP Tools (15 total)

**Schedule Analysis:**

- `analyze_partial_schedule` - Analyze incomplete schedules
- `suggest_schedule_improvements` - Get improvement suggestions
- `validate_coverage_compliance` - Validate coverage requirements

**Employee Management:**

- `manage_employees` - CRUD operations on employees
- `analyze_employee_workload` - Analyze workload distribution
- `suggest_employee_assignments` - AI-powered assignment suggestions

**Coverage Optimization:**

- `optimize_shift_distribution` - Optimize shift distribution
- `suggest_coverage_improvements` - Coverage improvement suggestions

**CRUD Operations:**

- `manage_schedules` - Schedule management
- `manage_shift_templates` - Shift template management
- `manage_absences` - Absence record management

**AI Schedule Generation:**

- `generate_ai_schedule` - Generate AI-optimized schedules
- `generate_schedule_scenarios` - Multiple scenario generation

**ML Optimization:**

- `optimize_schedule_with_ml` - ML-based optimization

## Testing Endpoints

### 1. Health Check

```bash
curl http://localhost:5000/api/v2/mcp/health
```

**Expected:** Server status, database connection, employee count

### 2. Configuration

```bash
curl http://localhost:5000/api/v2/mcp/config
```

**Expected:** Server endpoints (stdio, SSE, HTTP) and capabilities

### 3. List All Tools

```bash
curl http://localhost:5000/api/v2/mcp/tools
```

**Expected:** All 15 MCP tools with descriptions and parameters

### 4. Tool Validation (Test Endpoint)

```bash
curl -X POST http://localhost:5000/api/v2/mcp/test-tool \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "manage_employees",
    "parameters": {"operation": "list"}
  }'
```

**Expected:** Tool validation result (doesn't execute, only validates)

### 5. Tool Execution (Execute Endpoint)

```bash
curl -X POST http://localhost:5000/api/v2/mcp/execute-tool \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "manage_employees",
    "parameters": {
      "operation": "list",
      "filters": {},
      "include_availability": true
    }
  }'
```

**Expected:** Actual tool execution result with data

## Next Steps for Extended Testing

### 1. Test MCP STDIO Transport (for Claude, etc.)

```bash
# In one terminal, start the STDIO server:
./src/backend/.venv/bin/python src/backend/mcp_server.py --transport stdio

# In another terminal, use with Claude or another AI client
```

### 2. Test MCP SSE Transport (for Web Clients)

```bash
# SSE server is already running on port 8001
# Can be accessed from web clients via: http://localhost:8001/sse
```

### 3. Test Tool Execution via API

Example: List employees

```bash
curl -X POST http://localhost:5000/api/v2/mcp/execute-tool \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "manage_employees",
    "parameters": {
      "operation": "list",
      "include_availability": true
    }
  }' | jq .
```

Example: Analyze workload

```bash
curl -X POST http://localhost:5000/api/v2/mcp/execute-tool \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "analyze_employee_workload",
    "parameters": {
      "start_date": "2025-10-01",
      "end_date": "2025-10-31",
      "include_recommendations": true
    }
  }' | jq .
```

Example: Validate schedule compliance

```bash
curl -X POST http://localhost:5000/api/v2/mcp/execute-tool \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "validate_coverage_compliance",
    "parameters": {
      "start_date": "2025-10-01",
      "end_date": "2025-10-31"
    }
  }' | jq .
```

### 4. View MCP Status Dashboard

```bash
curl http://localhost:5000/api/v2/mcp/status | jq .
```

### 5. Check Logs

```bash
# View application logs
tail -f instance/logs/app.log

# View MCP-specific logs (if available)
tail -f instance/logs/mcp.log

# View all logs
tail -f instance/logs/*.log
```

## Running VS Code Tasks

All MCP-related tasks are available in VS Code:

- **Start MCP Server (STDIO)** - Standard MCP protocol
- **Start MCP Server (SSE)** - Server-Sent Events transport
- **Start MCP Server (HTTP)** - Streamable HTTP transport
- **Test MCP Health** - Quick health check

## Development Manager

You can also use the development manager for comprehensive service control:

```bash
python dev_manager.py
```

This provides:

- Service lifecycle management (start/stop/restart)
- Log viewing and filtering
- Port monitoring
- Service health status

## Common Issues & Solutions

### Issue: Tool endpoint returns 500 error

**Solution:** Ensure the tool name matches exactly. Use `/api/v2/mcp/tools` to get the exact names.

### Issue: SSE connection times out

**Solution:** Make sure the SSE server is running on port 8001:

```bash
# Check if port 8001 is listening
lsof -i :8001

# Or start the SSE server
python dev_manager.py  # and select "Start MCP Server (SSE)"
```

### Issue: Tool execution doesn't return expected data

**Solution:** Check parameters format. Some tools may require `dry_run=false` to execute changes.

## Resources

- **MCP Server File:** `src/backend/mcp_server.py`
- **MCP Service:** `src/backend/services/mcp_service.py`
- **MCP Routes:** `src/backend/routes/mcp_routes.py`
- **MCP Tools:** `src/backend/services/mcp_tools/`
- **Documentation:** `docs/MCP_INTEGRATION_GUIDE.md`
