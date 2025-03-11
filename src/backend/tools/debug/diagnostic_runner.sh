#!/bin/bash
# Diagnostic script for the Schichtplan schedule generator
# This script directly tests the database connectivity and scheduler functionality

set -e  # Exit immediately if a command exits with a non-zero status.

# Get the absolute paths
PROJECT_ROOT=$(cd "$(dirname "$0")/../../../../" && pwd)
echo "Project root: $PROJECT_ROOT"

# Create a diagnostics log directory if it doesn't exist
DIAG_DIR="$PROJECT_ROOT/logs/diagnostics"
mkdir -p "$DIAG_DIR"
LOG_FILE="$DIAG_DIR/diagnostic_$(date +%Y%m%d_%H%M%S).log"

# Start logging
exec > >(tee "$LOG_FILE")
exec 2>&1

# Print header
echo "===================================================================="
echo "SCHICHTPLAN DIAGNOSTIC TOOL"
echo "===================================================================="
echo "Date: $(date)"
echo "Running diagnostics from: $(pwd)"
echo "Log file: $LOG_FILE"
echo "Project root: $PROJECT_ROOT"
echo "===================================================================="

# Set up environment
export PYTHONPATH="$PROJECT_ROOT"
export FLASK_APP="src.backend.app"
export FLASK_ENV="development"
export DEBUG_MODE="1"

echo "Environment variables:"
echo "  PYTHONPATH: $PYTHONPATH"
echo "  FLASK_APP: $FLASK_APP"
echo "  FLASK_ENV: $FLASK_ENV"
echo "  DEBUG_MODE: $DEBUG_MODE"

# Activate virtual environment if it exists
if [ -d "$PROJECT_ROOT/.venv" ]; then
    echo "Activating virtual environment..."
    source "$PROJECT_ROOT/.venv/bin/activate"
fi

# Create a Python diagnostic script
TEMP_SCRIPT="$PROJECT_ROOT/src/backend/tools/debug/temp_diagnostic.py"

echo "Creating temporary diagnostic script at $TEMP_SCRIPT"
cat > "$TEMP_SCRIPT" << 'EOF'
#!/usr/bin/env python3
"""
Temporary diagnostic script for Schichtplan schedule generator
"""
import os
import sys
import time
import traceback
from datetime import date, timedelta
from pathlib import Path

# Print environment information
print("\n==== ENVIRONMENT INFORMATION ====")
print(f"Python version: {sys.version}")
print(f"Current directory: {os.getcwd()}")
print(f"PYTHONPATH: {os.environ.get('PYTHONPATH')}")
print(f"FLASK_APP: {os.environ.get('FLASK_APP')}")

try:
    # Import Flask
    print("\n==== TEST 1: Import Flask ====")
    import flask
    print(f"Flask imported successfully (version: {flask.__version__})")

    # Import SQLAlchemy
    print("\n==== TEST 2: Import SQLAlchemy ====")
    import sqlalchemy
    from sqlalchemy import text
    print(f"SQLAlchemy imported successfully (version: {sqlalchemy.__version__})")

    # Import app module
    print("\n==== TEST 3: Import App Module ====")
    from src.backend.app import create_app
    print("App module imported successfully")

    # Create Flask app
    print("\n==== TEST 4: Create Flask App ====")
    app = create_app()
    print("Flask app created successfully")
    print(f"App config: {app.config.get('SQLALCHEMY_DATABASE_URI')}")
    print(f"Debug mode: {app.config.get('DEBUG')}")
    print(f"Testing mode: {app.config.get('TESTING')}")

    # Import models
    print("\n==== TEST 5: Import Models ====")
    from src.backend.models import db, Employee, ShiftTemplate, Coverage
    print("Models imported successfully")

    # Test database connection
    print("\n==== TEST 6: Database Connection ====")
    with app.app_context():
        # Test basic connectivity
        try:
            result = db.session.execute(text('SELECT 1')).scalar()
            print(f"Basic database query result: {result}")
            
            # Check tables
            employee_count = Employee.query.count()
            shift_count = ShiftTemplate.query.count()
            coverage_count = Coverage.query.count()
            
            print(f"Database status:")
            print(f"  - Employee count: {employee_count}")
            print(f"  - Shift template count: {shift_count}")
            print(f"  - Coverage requirement count: {coverage_count}")
        except Exception as e:
            print(f"Database connection error: {e}")
            traceback.print_exc()
            sys.exit(1)

    # Import scheduler
    print("\n==== TEST 7: Import Scheduler ====")
    try:
        from src.backend.services.scheduler import ScheduleGenerator
        print("Scheduler imported successfully")
    except Exception as e:
        print(f"Scheduler import error: {e}")
        traceback.print_exc()
        sys.exit(1)

    # Initialize scheduler
    print("\n==== TEST 8: Initialize Scheduler ====")
    with app.app_context():
        try:
            generator = ScheduleGenerator()
            print("ScheduleGenerator initialized successfully")
            print(f"Generator resources loaded: {hasattr(generator, 'resources')}")
        except Exception as e:
            print(f"Scheduler initialization error: {e}")
            traceback.print_exc()
            sys.exit(1)

    # Generate schedule (simple test)
    print("\n==== TEST 9: Generate Schedule (Simple Test) ====")
    with app.app_context():
        try:
            generator = ScheduleGenerator()
            print("Generating schedule...")
            
            # Use today and the next 2 days for a quick test
            today = date.today()
            end_date = today + timedelta(days=2)
            
            start_time = time.time()
            result = generator.generate(
                start_date=today,
                end_date=end_date,
                version=1
            )
            end_time = time.time()
            
            schedule_entries = result.get('schedule', [])
            warnings = result.get('warnings', [])
            errors = result.get('errors', [])
            
            print(f"Schedule generated in {end_time - start_time:.2f} seconds:")
            print(f"  - Date range: {today} to {end_date}")
            print(f"  - Entries: {len(schedule_entries)}")
            print(f"  - Warnings: {len(warnings)}")
            print(f"  - Errors: {len(errors)}")
            
            if errors:
                print("\nSample errors:")
                for i, error in enumerate(errors[:3]):
                    print(f"  {i+1}. {error.get('message', 'Unknown error')}")
                if len(errors) > 3:
                    print(f"  ... and {len(errors) - 3} more")
        except Exception as e:
            print(f"Schedule generation error: {e}")
            traceback.print_exc()
            sys.exit(1)

    # All tests passed
    print("\n==== ALL TESTS PASSED ====")
    print("Diagnostic completed successfully")

except Exception as e:
    print(f"\nDIAGNOSTIC FAILED: {e}")
    traceback.print_exc()
    sys.exit(1)
EOF

# Make the script executable
chmod +x "$TEMP_SCRIPT"

# Run the diagnostic script
echo -e "\nRunning diagnostic script..."
python3 "$TEMP_SCRIPT"

# Check if the script succeeded
if [ $? -eq 0 ]; then
    echo -e "\n===================================================================="
    echo "DIAGNOSTIC COMPLETED SUCCESSFULLY"
    echo "All tests passed. See log file for details: $LOG_FILE"
    echo "===================================================================="
else
    echo -e "\n===================================================================="
    echo "DIAGNOSTIC FAILED"
    echo "See log file for details: $LOG_FILE"
    echo "===================================================================="
    exit 1
fi 