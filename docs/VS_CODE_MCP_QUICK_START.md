# VS Code MCP Server Setup for Schichtplan

This guide shows how to use the Schichtplan MCP server with GitHub Copilot in VS Code's agent mode.

## What is MCP?

Model Context Protocol (MCP) is an open standard that allows AI models to use external tools and services. The Schichtplan MCP server exposes shift scheduling functionality to AI assistants, enabling them to:

- 📊 Analyze schedules
- 👥 Manage employees
- 🎯 Optimize coverage
- 🤖 Generate AI-powered schedules
- 📈 Perform ML-based optimizations

## Prerequisites

- Visual Studio Code 1.102 or later
- GitHub Copilot subscription
- Python 3.10+ with virtual environment set up
- Schichtplan backend dependencies installed

## Quick Start

### 1. Verify MCP Configuration

The MCP server is already configured in `.vscode/mcp.json`:

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
        "FLASK_APP": "src.backend.app:create_app"
      }
    }
  }
}
```

### 2. Start the MCP Server

The MCP server starts automatically when you use it in agent mode, but you can also test it manually:

```bash
# Test stdio mode (default)
./src/backend/.venv/bin/python src/backend/mcp_server.py

# Test with network transports
./src/backend/.venv/bin/python src/backend/mcp_server.py --transport sse --port 8001
./src/backend/.venv/bin/python src/backend/mcp_server.py --transport http --port 8002
```

### 3. Use in VS Code Agent Mode

1. **Open GitHub Copilot Chat** (Ctrl+Alt+I / Cmd+Option+I)
2. **Select Agent Mode** from the dropdown at the top
3. **Click the Tools button** to see available tools
4. **Enable Schichtplan tools** - look for tools starting with your server name
5. **Ask questions** like:
   - "Analyze the schedule for next week"
   - "List all active employees"
   - "Generate an optimized schedule for Monday"
   - "Check coverage requirements"

### 4. View Server Status

To check if the MCP server is running:

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Run: `MCP: List Servers`
3. Look for `schichtplanAssistent` in the list
4. Click to see status and available tools

## Available Tools

### Schedule Analysis Tools

- **analyze_partial_schedule** - Analyze schedule completeness
- **suggest_schedule_improvements** - Get AI recommendations
- **analyze_schedule_conflicts** - Identify conflicts
- **get_schedule_statistics** - Get metrics and KPIs

### Employee Management Tools

- **get_employees** - List employees with filters
- **get_employee_availability** - Check availability
- **get_absences** - View absences and leave
- **analyze_employee_workload** - Analyze work distribution

### Coverage Optimization Tools

- **analyze_coverage_gaps** - Find understaffed periods
- **suggest_coverage_improvements** - Get optimization suggestions
- **get_coverage_requirements** - View requirements by day/time

### CRUD Operations Tools

- **create_employee** - Add new employee
- **update_employee** - Update employee data
- **create_shift_template** - Define shift patterns
- **manage_availability** - Set employee availability

### AI Schedule Generation Tools

- **generate_ai_schedule** - AI-powered schedule creation
- **optimize_schedule_with_ai** - Apply AI optimizations
- **evaluate_schedule_quality** - Score schedule quality

### ML Optimization Tools

- **predict_schedule_conflicts** - ML-based conflict prediction
- **suggest_ml_optimizations** - ML-powered improvements
- **analyze_historical_patterns** - Learn from past schedules

### Scenario Planning Tools

- **create_schedule_scenario** - Test "what-if" scenarios
- **compare_scenarios** - Compare alternatives
- **simulate_schedule_changes** - Predict change impact

## Example Prompts

Here are some example prompts to try in agent mode:

### Basic Queries

```
Show me all active employees
What are the coverage requirements for Monday?
List upcoming absences for this week
```

### Analysis

```
Analyze the schedule for this week and identify any problems
Check if we have enough staff on Friday evening
Show me employees with the highest workload
```

### Generation

```
Generate an optimized schedule for next week
Create a schedule that minimizes overtime
Build a schedule considering all employee preferences
```

### Optimization

```
How can I improve coverage on weekends?
Suggest ways to reduce schedule conflicts
Find optimal shift assignments for this employee
```

## MCP Resources

The server also provides resources that can be added as context:

- `employees://{employee_id}` - Employee details
- `schedules://{start_date}/{end_date}` - Schedule data
- `shift-templates://all` - Available shift templates
- `coverage://{day_of_week}` - Coverage requirements
- `availability://{employee_id}/{date}` - Employee availability
- `conflicts://{start_date}/{end_date}` - Schedule conflicts

To use resources:

1. In Chat view, select **Add Context > MCP Resources**
2. Choose a resource type
3. Provide required parameters

## MCP Prompts

Pre-configured prompts for common tasks:

- `/mcp.schichtplanAssistent.schedule_optimization_prompt` - Schedule optimization
- `/mcp.schichtplanAssistent.employee_availability_prompt` - Availability analysis
- `/mcp.schichtplanAssistent.schedule_compliance_prompt` - Compliance checking

Use these by typing `/` in the chat input and selecting the prompt.

## Troubleshooting

### Server Not Starting

**Check logs:**

```bash
# MCP server logs are in:
tail -f mcp_server.log
```

**Common issues:**

- Virtual environment not activated
- Database connection problems
- Missing dependencies

**Solution:**

```bash
# Reinstall dependencies
./src/backend/.venv/bin/pip install -r src/backend/requirements.txt

# Check database
python check_db.py
```

### Tools Not Showing in Agent Mode

1. Refresh MCP servers: Command Palette → `MCP: Show Installed Servers` → Restart
2. Clear cached tools: Command Palette → `MCP: Reset Cached Tools`
3. Check MCP output: Command Palette → `MCP: List Servers` → Select server → Show Output

### Tool Confirmation Required

The first time you use an MCP tool, VS Code asks for confirmation. This is a security feature.

**Options:**

- **Continue** - Run once
- **Continue and don't ask again for this tool** - Trust this tool
- **Continue for this session** - Trust for current session
- **Cancel** - Don't run the tool

## Development Mode

For development, you can enable watch mode and debugging:

Add to `.vscode/mcp.json`:

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
}
```

Then the server will automatically restart when you edit Python files.

## Advanced Usage

### Running Multiple Transport Modes

You can run the server in different modes simultaneously:

**Terminal 1 - Stdio (for VS Code):**

```bash
./src/backend/.venv/bin/python src/backend/mcp_server.py
```

**Terminal 2 - SSE (for web tools):**

```bash
./src/backend/.venv/bin/python src/backend/mcp_server.py --transport sse --port 8001
```

**Terminal 3 - HTTP (for external integrations):**

```bash
./src/backend/.venv/bin/python src/backend/mcp_server.py --transport http --port 8002
```

### Using with Custom Tools

You can create custom VS Code extensions that use the MCP server:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const client = new Client({
  name: "custom-tool",
  version: "1.0.0",
});

// Connect to MCP server
await client.connect({
  command: "./src/backend/.venv/bin/python",
  args: ["src/backend/mcp_server.py"],
});

// Call tools
const result = await client.callTool("get_employees", {
  active_only: true,
});
```

## Best Practices

### 1. Be Specific with Prompts

❌ "Show me the schedule"
✅ "Show me the schedule for October 14-20, 2025"

### 2. Use Context

Add relevant files or MCP resources to give Copilot more context:

- Schedule PDFs
- Employee lists
- Coverage requirement documents

### 3. Iterate

Start with simple queries, then refine:

1. "Analyze this week's schedule"
2. "Focus on evening shifts"
3. "Suggest how to improve coverage"

### 4. Review Tool Actions

Always review what tools will do before confirming, especially for:

- Creating/updating employees
- Generating schedules
- Modifying data

## Security

### Trust Considerations

MCP servers can run arbitrary code. The Schichtplan MCP server:

✅ **Safe:**

- Reads from database
- Analyzes schedules
- Generates recommendations
- Creates AI suggestions

⚠️ **Requires Review:**

- Creating/updating employees
- Modifying schedules
- Deleting data

### Permissions

The MCP server runs with the same permissions as VS Code:

- File system access within workspace
- Database access (SQLite file)
- Network access (if using SSE/HTTP transports)

## Support

### Documentation

- [VS Code MCP Documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [Model Context Protocol Spec](https://modelcontextprotocol.io/)
- [FastMCP Library](https://github.com/jlowin/fastmcp)

### Project Files

- `docs/MCP_BEST_PRACTICES_ANALYSIS.md` - Implementation analysis
- `docs/mcp_api.md` - API documentation
- `docs/MCP_INTEGRATION_GUIDE.md` - Integration guide

### Logs

- MCP Server: `mcp_server.log`
- Backend: `backend_start.log`
- VS Code: Help → Toggle Developer Tools → Console

## What's Next?

1. **Try the tools** - Experiment with different prompts
2. **Explore resources** - Add MCP resources to your context
3. **Use prompts** - Try pre-configured prompts with `/`
4. **Build workflows** - Chain tools together for complex tasks
5. **Customize** - Modify the server for your needs

Happy scheduling! 🗓️
