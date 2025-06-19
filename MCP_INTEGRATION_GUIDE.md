# Schichtplan MCP Integration

This document describes the Model Context Protocol (MCP) integration for the Schichtplan shift scheduling application.

## Overview

The Schichtplan MCP Server exposes comprehensive shift scheduling functionality through the Model Context Protocol, enabling AI applications to interact with the shift planning system for analysis, optimization, and management tasks.

## Features

### 🛠️ Tools (16 available)
- **System Management**: Health checks, server info, capabilities discovery
- **Employee Management**: Employee data, availability, absences
- **Schedule Management**: Generation, retrieval, analysis, optimization
- **Coverage Analysis**: Requirements, conflicts, statistics
- **AI-Powered Optimization**: Intelligent schedule optimization recommendations

### 📊 Resources (7 available)
- **System Configuration**: `config://system`
- **Employee Details**: `employees://{employee_id}`
- **Schedule Data**: `schedules://{start_date}/{end_date}`
- **Shift Templates**: `shift-templates://all`
- **Coverage Requirements**: `coverage://{day_of_week}`
- **Employee Availability**: `availability://{employee_id}/{date}`
- **Schedule Conflicts**: `conflicts://{start_date}/{end_date}`

### 🤖 AI Prompts (6 available)
- **Schedule Analysis**: Comprehensive schedule evaluation
- **Employee Scheduling**: Optimal employee assignment strategies
- **Schedule Optimization**: AI-powered optimization recommendations
- **Conflict Resolution**: Intelligent conflict resolution strategies
- **Workforce Planning**: Strategic workforce planning insights
- **Compliance Auditing**: Regulatory compliance verification

## Quick Start

### 1. Prerequisites
```bash
# Ensure Python 3.8+ is installed
python3 --version

# Install dependencies
pip3 install -r src/backend/requirements.txt
```

### 2. Start the MCP Server

#### STDIO Mode (Default)
```bash
python3 src/backend/mcp_server.py
```

#### Server-Sent Events (SSE) Mode
```bash
python3 src/backend/mcp_server.py --transport sse --port 8001
```

#### HTTP Mode
```bash
python3 src/backend/mcp_server.py --transport http --port 8002
```

### 3. VS Code Integration

The MCP server is automatically configured in VS Code:

1. **Primary Server**: Uses STDIO transport for direct AI tool integration
2. **Development Server**: Debug mode with detailed logging
3. **Network Endpoints**: SSE and HTTP transports for web-based tools

Access via VS Code Command Palette:
- `MCP: Connect to Schichtplan Server`
- `MCP: Test Tools`
- `MCP: View Resources`

## Available Tools

### System Tools
```typescript
// Health check and status
mcp_health_check() -> HealthStatus
get_server_info() -> ServerInfo
get_capabilities() -> Capabilities
get_system_status() -> SystemStatus
```

### Employee Management
```typescript
// Employee data and availability
get_employees(active_only?, include_details?) -> Employee[]
get_employee_availability(employee_id?, start_date?, end_date?) -> Availability[]
get_absences(employee_id?, start_date?, end_date?) -> Absence[]
```

### Schedule Management
```typescript
// Schedule operations
generate_schedule(start_date, end_date, use_ai?, version?) -> ScheduleResult
get_schedule(start_date, end_date, version?) -> Schedule
analyze_schedule_conflicts(start_date, end_date) -> ConflictAnalysis
get_schedule_statistics(start_date, end_date) -> Statistics
optimize_schedule_ai(start_date, end_date, goals?) -> OptimizationResult
```

### Coverage and Templates
```typescript
// Shift templates and coverage
get_shift_templates(active_only?) -> ShiftTemplate[]
get_coverage_requirements(date?) -> CoverageRequirement[]
```

### Data Generation
```typescript
// Demo data for testing
generate_demo_data(employee_count?, shift_count?, coverage_blocks?) -> DemoDataResult
```

## Resource Access

### System Configuration
```
config://system
```
Returns system settings, scheduling parameters, and configuration.

### Employee Information
```
employees://{employee_id}
```
Detailed employee data including availability, absences, and scheduling history.

### Schedule Data
```
schedules://{start_date}/{end_date}
```
Complete schedule information for the specified date range.

### Shift Templates
```
shift-templates://all
```
All available shift templates with timing and requirements.

### Coverage Requirements
```
coverage://{day_of_week}
```
Coverage requirements for specific days (0=Monday, 6=Sunday).

### Employee Availability
```
availability://{employee_id}/{date}
```
Employee availability for a specific date.

### Schedule Conflicts
```
conflicts://{start_date}/{end_date}
```
Identified conflicts and issues in the schedule.

## AI Prompts

### Schedule Analysis
Analyze schedule data for coverage, conflicts, and optimization opportunities.

```typescript
schedule_analysis_prompt(schedule_data: string) -> string
```

### Employee Scheduling
Generate optimal employee scheduling strategies based on availability and requirements.

```typescript
employee_scheduling_prompt(employee_data: string, requirements: string) -> string
```

### Schedule Optimization
AI-powered schedule optimization with conflict resolution and efficiency improvements.

```typescript
schedule_optimization_prompt(current_schedule: string, conflicts: string, goals: string) -> string
```

### Conflict Resolution
Intelligent strategies for resolving scheduling conflicts and preventing future issues.

```typescript
conflict_resolution_prompt(conflict_data: string, employee_data: string) -> string
```

### Workforce Planning
Strategic workforce planning with capacity optimization and skill development recommendations.

```typescript
workforce_planning_prompt(employee_data: string, forecast_data: string, constraints: string) -> string
```

### Compliance Auditing
Comprehensive compliance verification against labor laws and company policies.

```typescript
compliance_audit_prompt(schedule_data: string, regulations: string, policies: string) -> string
```

## Configuration

### Environment Variables
```bash
export PYTHONPATH="/home/jango/Git/maike2/schichtplan"
export FLASK_ENV="development"
export FLASK_APP="src.backend.app:create_app"
```

### VS Code Settings
The MCP integration is configured in `.vscode/settings.json`:

```json
{
  "mcp.servers": {
    "schichtplan": {
      "command": "python3",
      "args": ["src/backend/mcp_server.py"],
      "capabilities": ["tools", "resources", "prompts", "logging"]
    }
  }
}
```

## Development

### Debugging
Use the provided VS Code launch configurations:
- **Debug MCP Server (STDIO)**: Standard debugging
- **Debug MCP Server (SSE)**: SSE transport debugging  
- **Debug MCP Server (HTTP)**: HTTP transport debugging

### Testing
```bash
# Run all tests
python3 -m pytest -v

# Test specific MCP functionality
python3 -m pytest tests/test_mcp_tools.py -v

# Health check
python3 -c "
from src.backend.services.mcp_service import SchichtplanMCPService
from src.backend.app import create_app
app = create_app()
with app.app_context():
    service = SchichtplanMCPService(app)
    print('MCP Service initialized successfully')
"
```

### Adding New Tools
1. Add the tool function to `SchichtplanMCPService._register_tools()`
2. Update `mcp_config.json` capabilities
3. Update VS Code settings in `.vscode/settings.json`
4. Add tests for the new tool

### Adding New Resources
1. Add the resource function to `SchichtplanMCPService._register_resources()`
2. Update configuration files
3. Document the resource format and usage

### Adding New Prompts
1. Add the prompt function to `SchichtplanMCPService._register_prompts()`
2. Update configuration files
3. Test prompt effectiveness with AI models

## Troubleshooting

### Common Issues

#### MCP Server Won't Start
```bash
# Check Python path
echo $PYTHONPATH

# Verify dependencies
pip3 list | grep fastmcp

# Check Flask app
python3 -c "from src.backend.app import create_app; create_app()"
```

#### Database Connection Issues
```bash
# Check database file
ls -la src/instance/app.db

# Test database connection
python3 check_db.py
```

#### Transport Issues
```bash
# Test STDIO
echo '{"jsonrpc": "2.0", "method": "ping", "id": 1}' | python3 src/backend/mcp_server.py

# Test SSE (in another terminal)
curl http://localhost:8001/sse

# Test HTTP (in another terminal)  
curl http://localhost:8002/mcp
```

### Logging
Logs are available in:
- **Console**: Real-time output during development
- **Application Logs**: `src/logs/mcp_server.log`
- **Diagnostic Logs**: Session-specific logs in `src/logs/diagnostic/`

### Performance Monitoring
Monitor MCP server performance:
```bash
# Check server status
python3 -c "
import asyncio
from src.backend.services.mcp_service import SchichtplanMCPService
from src.backend.app import create_app

async def check_health():
    app = create_app()
    service = SchichtplanMCPService(app)
    status = await service.mcp_health_check()
    print(f'Health Status: {status}')

asyncio.run(check_health())
"
```

## Support

For issues and feature requests:
1. Check the troubleshooting section above
2. Review the application logs
3. Test individual components
4. Create detailed issue reports with logs and reproduction steps

## License

This MCP integration follows the same license as the main Schichtplan application.
