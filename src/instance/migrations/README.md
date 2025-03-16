# Schichtplan Database Migrations

This directory contains the consolidated database migrations for the Schichtplan application.

## Migration Chain

1. `initial_.py` - Base migration (empty)
2. `add_shift_types_column.py` - Adds shift_types column to settings table
3. `add_shift_type_to_schedules.py` - Adds shift_type column to schedules table

## How to Apply Migrations

You can apply migrations using the Flask-Migrate CLI:

```bash
# From the project root
cd /home/jango/Git/schichtplan
export FLASK_APP=src/backend/run.py
flask db upgrade
```

Or you can use the provided script:

```bash
# From the project root
python src/instance/apply_migrations.py
```

## How to Create New Migrations

To create a new migration:

```bash
# From the project root
export FLASK_APP=src/backend/run.py
flask db migrate -m "Description of the migration"
```

## How to Rebuild the Database

To completely rebuild the database:

```bash
# From the project root
python src/instance/rebuild_db.py
```

This will delete the existing database and create a new one with all tables, then apply all migrations. 