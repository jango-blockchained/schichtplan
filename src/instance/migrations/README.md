# Database Migration Guide

This document explains the migration strategy for the Schichtplan application, including how to run existing migrations, create new migrations, and understand the project structure.

## Migration Directory Structure

The project uses a consolidated migration structure:

1. **Primary Migration Directory** (`/src/instance/migrations`):
   - Standard Flask-Migrate/Alembic setup integrated with the application
   - Used for normal schema migrations through Flask CLI
   - Managed by Flask-Migrate extension

2. **Migration Tools Directory** (`/src/instance/tools/migrations`):
   - Contains utility scripts for database operations
   - Used for special-case migrations, fixes, or data transformations
   - Not for regular schema migrations

## Path Resolution Strategy

When writing migration scripts, paths should be resolved consistently:

```python
# Standard method for resolving paths
from pathlib import Path
import os

# Get absolute path of current file
current_file = Path(__file__).resolve()

# Get directories relative to current file
current_dir = current_file.parent
instance_dir = current_dir.parent  # /src/instance
src_dir = instance_dir.parent      # /src
project_dir = src_dir.parent       # /

# Database path 
db_path = instance_dir / "app.db"
```

The application uses the database at `/src/instance/app.db`.

## How to Run Migrations

### Using Flask-Migrate (Recommended)

From the project root directory:

```bash
# Initialize migrations (if not already initialized)
flask db init

# Create a new migration
flask db migrate -m "Description of changes"

# Apply migrations
flask db upgrade

# Roll back migrations
flask db downgrade
```

### Using Migration Tools

For special cases or fixes:

```bash
# Run a specific migration tool
python src/instance/tools/migrations/add_special_days_column.py

# Rebuild the database (CAUTION: Destructive!)
python src/instance/tools/migrations/rebuild_db.py
```

## Creating New Migrations

### Standard Schema Changes

1. Update your SQLAlchemy models in `/src/backend/models/`
2. Generate a migration:
   ```bash
   flask db migrate -m "Add new column to table"
   ```
3. Review the generated migration in `/src/instance/migrations/versions/`
4. Apply the migration:
   ```bash
   flask db upgrade
   ```

### Custom/Fix Migrations

For complex scenarios or fixes:

1. Create a new Python script in `/src/instance/tools/migrations/`
2. Use the path resolution strategy shown above
3. Make the script executable and add documentation
4. Test thoroughly before running in production

## Best Practices

1. **Always review** generated migrations before applying them
2. **Backup** your database before running migrations
3. **Test** migrations in development before production
4. **Include down migrations** (downgrades) for rollback ability
5. **Document** complex migrations in their file headers
6. **Version control** all migration files
7. **Check column existence** before modifications to handle partial migrations