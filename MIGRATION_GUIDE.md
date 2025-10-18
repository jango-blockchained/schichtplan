# Migration Guide for Reorganized File Structure

This guide helps developers update their workflows and scripts after the codebase cleanup.

## Quick Reference

### Validation Scripts

**Before:**

```bash
python check_db_schema.py
python check_database_entities.py
python check_db.py
python check_schedule.py
python check_settings.py
```

**After:**

```bash
python tools/validators/check_db_schema.py
python tools/validators/check_database_entities.py
python tools/validators/check_db.py
python tools/validators/check_schedule.py
python tools/validators/check_settings.py
```

### MCP Examples

**Before:**

```bash
python src/backend/examples/mcp_client_example.py
python mcp_server_minimal.py
python mcp_server_enhanced.py
```

**After:**

```bash
python examples/mcp/mcp_client_example.py
python examples/mcp/mcp_server_minimal.py
python examples/mcp/mcp_server_enhanced.py
```

### Utility Scripts

**Before:**

```bash
./ngrok-expose
python scripts/count_employees_this_week.py
python scripts/setup_mcp_integration.py
```

**After:**

```bash
./tools/utils/ngrok-expose
python tools/utils/count_employees_this_week.py
python tools/utils/setup_mcp_integration.py
```

### Backend Migration Tools

**Before:**

```bash
python src/backend/tools/rebuild_db.py
python src/backend/tools/run_migration.py
python src/backend/tools/add_settings_columns.py
```

**After:**

```bash
python src/backend/tools/migrations/rebuild_db.py
python src/backend/tools/migrations/run_migration.py
python src/backend/tools/updates/add_settings_columns.py
```

## Directory Structure Changes

### New Directories

1. **`tools/`** - Root-level development tools

   - `validators/` - Database validation scripts
   - `utils/` - Utility scripts
   - `debug/` - Debug utilities (currently empty)

2. **`examples/`** - Example code and reference implementations

   - `mcp/` - MCP server examples

3. **`docs/archive/`** - Archived documentation
   - Session summaries and POC documents

### Removed Directories

- `scripts/` - Contents moved to `tools/utils/`
- `poc/` - Moved to `docs/archive/poc/`
- `src/backend/examples/` - Moved to `examples/`

## Updated Imports

If you've been importing validation scripts in your code:

**Before:**

```python
# This won't work anymore
from check_db_schema import check_schema
```

**After:**

```python
# Add project root to path first
import sys
import os
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.insert(0, project_root)

# Then import
from tools.validators.check_db_schema import check_schema
```

## Git Commands

If you have local branches that reference old paths:

```bash
# Update your branch
git pull origin main

# If you have conflicts with moved files, resolve them
git status  # Check what files have conflicts
git add .   # After resolving
git commit
```

## Documentation Updates

- Session documentation moved to `docs/archive/`
- POC documents moved to `docs/archive/poc/`
- New README files added:
  - `tools/README.md`
  - `examples/README.md`
  - `CLEANUP_SUMMARY.md`

## Testing

All tests now live in `tests/backend/` with the following changes:

- Manual test scripts moved to `src/backend/tools/debug/`
- Outdated `_fixed` test files removed
- Disabled tests moved to `tools/debug/`

**Running tests:**

```bash
pytest
pytest tests/backend/
```

## CI/CD Impact

If you have CI/CD pipelines that reference old paths:

1. Update validation script paths in CI config
2. Update any scripts that reference `scripts/` directory
3. Update documentation generation paths if needed

## Questions?

See `CLEANUP_SUMMARY.md` for a complete list of all changes made during the cleanup.
