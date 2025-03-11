#!/usr/bin/env python3
"""
Flask CLI diagnostic script for Schichtplan schedule generator
This script is designed to be run with the Flask CLI to ensure proper app context
"""

import os
import sys
import time
import traceback
from datetime import date, timedelta

import click
from flask import current_app
from flask.cli import with_appcontext


@click.command("run-diagnostic")
@with_appcontext
def run_diagnostic():
    """Run diagnostic tests for the Schichtplan schedule generator."""
    try:
        # Print environment information
        click.echo("\n==== ENVIRONMENT INFORMATION ====")
        click.echo(f"Python version: {sys.version}")
        click.echo(f"Current directory: {os.getcwd()}")
        click.echo(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}")
        click.echo(f"FLASK_APP: {os.environ.get('FLASK_APP')}")
        click.echo(f"App instance path: {current_app.instance_path}")
        click.echo(f"App root path: {current_app.root_path}")
        click.echo(f"Debug mode: {current_app.debug}")
        click.echo(f"Testing mode: {current_app.testing}")
        click.echo(f"Database URI: {current_app.config.get('SQLALCHEMY_DATABASE_URI')}")

        # Import models
        click.echo("\n==== TEST 1: Import Models ====")
        from src.backend.models import db, Employee, ShiftTemplate, Coverage

        click.echo("Models imported successfully")

        # Test database connection
        click.echo("\n==== TEST 2: Database Connection ====")
        try:
            from sqlalchemy import text

            # Test basic connectivity
            result = db.session.execute(text("SELECT 1")).scalar()
            click.echo(f"Basic database query result: {result}")

            # Check tables
            employee_count = Employee.query.count()
            shift_count = ShiftTemplate.query.count()
            coverage_count = Coverage.query.count()

            click.echo("Database status:")
            click.echo(f"  - Employee count: {employee_count}")
            click.echo(f"  - Shift template count: {shift_count}")
            click.echo(f"  - Coverage requirement count: {coverage_count}")
        except Exception as e:
            click.echo(f"Database connection error: {e}")
            traceback.print_exc()
            sys.exit(1)

        # Import scheduler
        click.echo("\n==== TEST 3: Import Scheduler ====")
        try:
            from src.backend.services.scheduler import ScheduleGenerator

            click.echo("Scheduler imported successfully")
        except Exception as e:
            click.echo(f"Scheduler import error: {e}")
            traceback.print_exc()
            sys.exit(1)

        # Initialize scheduler
        click.echo("\n==== TEST 4: Initialize Scheduler ====")
        try:
            generator = ScheduleGenerator()
            click.echo("ScheduleGenerator initialized successfully")
            click.echo(f"Generator resources loaded: {hasattr(generator, 'resources')}")
        except Exception as e:
            click.echo(f"Scheduler initialization error: {e}")
            traceback.print_exc()
            sys.exit(1)

        # Generate schedule (simple test)
        click.echo("\n==== TEST 5: Generate Schedule (Simple Test) ====")
        try:
            generator = ScheduleGenerator()
            click.echo("Generating schedule...")

            # Use today and the next 2 days for a quick test
            today = date.today()
            end_date = today + timedelta(days=2)

            start_time = time.time()
            result = generator.generate(start_date=today, end_date=end_date, version=1)
            end_time = time.time()

            schedule_entries = result.get("schedule", [])
            warnings = result.get("warnings", [])
            errors = result.get("errors", [])

            click.echo(f"Schedule generated in {end_time - start_time:.2f} seconds:")
            click.echo(f"  - Date range: {today} to {end_date}")
            click.echo(f"  - Entries: {len(schedule_entries)}")
            click.echo(f"  - Warnings: {len(warnings)}")
            click.echo(f"  - Errors: {len(errors)}")

            if errors:
                click.echo("\nSample errors:")
                for i, error in enumerate(errors[:3]):
                    click.echo(f"  {i + 1}. {error.get('message', 'Unknown error')}")
                if len(errors) > 3:
                    click.echo(f"  ... and {len(errors) - 3} more")
        except Exception as e:
            click.echo(f"Schedule generation error: {e}")
            traceback.print_exc()
            sys.exit(1)

        # All tests passed
        click.echo("\n==== ALL TESTS PASSED ====")
        click.echo("Diagnostic completed successfully")

    except Exception as e:
        click.echo(f"\nDIAGNOSTIC FAILED: {e}")
        traceback.print_exc()
        sys.exit(1)


# Register the command with Flask CLI
def register_commands(app):
    app.cli.add_command(run_diagnostic)


# Allow direct execution for testing
if __name__ == "__main__":
    click.echo("This script should be run using the Flask CLI:")
    click.echo("  export FLASK_APP=src.backend.app")
    click.echo("  flask run-diagnostic")
    sys.exit(1)
