# Database Migration Guide

This document explains the migration strategy for the Schichtplan application, including how to run existing migrations, create new migrations, and understand the project structure.

## Migration Directory Structure

There are three migration-related directories in the project:

1. **Primary Migration Directory** (`/src/migrations`):
   - Standard Flask-Migrate/Alembic setup integrated with the application
   - Used for normal schema migrations through Flask CLI
   - Managed by Flask-Migrate extension

2. **Backend Migration Directory** (`/src/backend/migrations`):
   - Alternative migration setup used when running backend in standalone mode
   - Used primarily during development or testing
   - Less frequently used than the primary migrations

3. **Migration Tools Directory** (`/src/backend/tools/migrations`):
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
backend_dir = current_dir.parents[1]  # /src/backend
src_dir = backend_dir.parent         # /src
project_dir = src_dir.parent         # /

# Database path (as defined in app.py)
instance_dir = os.path.join(src_dir, "instance")
db_path = os.path.join(instance_dir, "app.db")
```

The application typically uses the database at `/src/instance/app.db`.

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
python src/backend/tools/migrations/add_special_days_column.py

# Rebuild the database (CAUTION: Destructive!)
python src/backend/tools/migrations/rebuild_db.py
```

## Creating New Migrations

### Standard Schema Changes

1. Update your SQLAlchemy models in `/src/backend/models/`
2. Generate a migration:
   ```bash
   flask db migrate -m "Add new column to table"
   ```
3. Review the generated migration in `/src/migrations/versions/`
4. Apply the migration:
   ```bash
   flask db upgrade
   ```

### Custom/Fix Migrations

For complex scenarios or fixes:

1. Create a new Python script in `/src/backend/tools/migrations/`
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

## Checking Migration Status

To check the current migration status:

```bash
flask db current  # Shows current migration version
flask db history  # Shows migration history
```

## Troubleshooting

### No such table: alembic_version

This typically occurs when running migrations on a database that wasn't initialized with Alembic:

```bash
# Initialize the database with Alembic
flask db stamp head
```

### No such column errors

If you encounter "no such column" errors (like we did with `special_days`), use the custom migration tools:

```bash
python src/backend/tools/migrations/add_special_days_column.py
```

### Multiple Migration Heads

If you see "Multiple head revisions":

```bash
# Merge the heads
flask db merge heads
```