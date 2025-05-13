#!/usr/bin/env python
"""
Script to run Alembic migrations.
"""
import os
import sys
import click
from alembic import command
from alembic.config import Config

# Add parent directories to path to allow imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

@click.command()
@click.option('--upgrade', is_flag=True, help='Upgrade to the latest migration')
@click.option('--downgrade', is_flag=True, help='Downgrade to the previous migration')
@click.option('--revision', help='Create a new migration revision')
@click.option('--show', is_flag=True, help='Show current revision')
@click.option('--history', is_flag=True, help='Show migration history')
def run_migrations(upgrade, downgrade, revision, show, history):
    """Run database migrations using Alembic."""
    try:
        # Get the Alembic config file path
        alembic_ini = os.path.join(backend_dir, 'migrations', 'alembic.ini')
        
        # Create Alembic config
        alembic_cfg = Config(alembic_ini)
        
        # Set the migration script location
        script_location = os.path.join(backend_dir, 'migrations')
        alembic_cfg.set_main_option('script_location', script_location)
        
        # If no options specified, default to upgrade
        if not any([upgrade, downgrade, revision, show, history]):
            upgrade = True

        if upgrade:
            print("Upgrading database to the latest revision...")
            command.upgrade(alembic_cfg, 'head')
            print("Database upgrade complete.")
        
        if downgrade:
            print("Downgrading database to the previous revision...")
            command.downgrade(alembic_cfg, '-1')
            print("Database downgrade complete.")
        
        if revision:
            print(f"Creating new migration with message: {revision}")
            command.revision(alembic_cfg, autogenerate=True, message=revision)
            print("Migration created.")
        
        if show:
            print("Current database revision:")
            command.current(alembic_cfg)
        
        if history:
            print("Migration history:")
            command.history(alembic_cfg)
    
    except Exception as e:
        print(f"Error running migrations: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    run_migrations()