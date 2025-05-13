# Migration Tools

This directory contains specialized migration tools for database operations that are not covered by standard Alembic migrations.

## Available Tools

| Script | Description | Usage |
|--------|-------------|-------|
| `add_special_days_column.py` | Adds the special_days column to the settings table | `python add_special_days_column.py [--dry-run]` |
| `create_version_table.py` | Creates the version table for schedule versioning | `python create_version_table.py` |
| `drop_tables.py` | WARNING: Drops all tables from the database | `python drop_tables.py` |
| `migrate_versions.py` | Migrates schedule data between versions | `python migrate_versions.py` |
| `rebuild_db.py` | Rebuilds the database from scratch | `python rebuild_db.py` |
| `reset_db.py` | Resets the database to a clean state | `python reset_db.py` |
| `run_migration.py` | Runs Alembic migrations | `python run_migration.py [--upgrade/--downgrade]` |
| `migration_template.py` | Template for creating new migration scripts | (Do not run directly - use as a template) |

## When to Use These Tools

These tools should be used in specific situations:

1. **Standard Schema Changes**: For normal model changes, use Flask-Migrate (`flask db migrate`).
2. **Emergency Fixes**: When Alembic migrations fail or when you need to fix data inconsistencies.
3. **Custom Data Transformations**: For complex data transformations not easily handled by Alembic.

## Creating New Migration Tools

1. Copy `migration_template.py` to create a new migration script.
2. Follow the standard pattern for path resolution.
3. Include proper documentation, help text, and a dry-run option.
4. Test thoroughly in development before running in production.

## Best Practices

1. **Always back up** your database before running migration tools.
2. Use the **--dry-run** option first to preview changes.
3. **Document thoroughly** in the script header what the migration does.
4. Include **verification steps** after the migration completes.
5. Handle **error cases gracefully**.

## Safety Measures

Destructive operations (like `drop_tables.py`, `reset_db.py`, and `rebuild_db.py`) should:

1. Ask for confirmation before executing
2. Not be run in production environments
3. Be preceded by a complete database backup

Refer to the main [MIGRATIONS.md](/docs/MIGRATIONS.md) document in the project root for a complete understanding of the migration strategy.