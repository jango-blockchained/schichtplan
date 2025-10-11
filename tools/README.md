# Schichtplan Tools Directory

This directory contains utility scripts and tools for working with the Schichtplan application.

## Directory Structure

### validators/
Database validation and checking scripts moved from the root directory:
- `check_db.py` - Check database structure and connections
- `check_db_schema.py` - Validate database schema
- `check_database_entities.py` - Verify database entities
- `check_schedule.py` - Check schedule data integrity
- `check_settings.py` - Validate settings configuration

### debug/
Debugging and diagnostic utilities (legacy location: `src/backend/tools/debug/`)

### utils/
General utility scripts and helpers:
- `count_employees_this_week.py` - Count scheduled employees for current week
- `setup_mcp_integration.py` - Configure AI tools for MCP integration
- `ngrok-expose` - Expose local ports using ngrok

## Usage

All validation scripts can be run directly:

```bash
# From project root
python tools/validators/check_db_schema.py
python tools/validators/check_database_entities.py
```

## Note on Backend Tools

The main backend tools are still located at `src/backend/tools/` and are organized by function:
- `data_generators/` - Demo data and test data generation
- `db_operations/` - Database operations and fixes
- `debug/` - Debugging utilities
- `migrations/` - Database migration scripts
- `validators/` - Data validation tools
- `scheduler/` - Scheduler-specific tools
- `test_runners/` - Test execution utilities

See `src/backend/tools/README.md` for more information about backend tools.
