#!/usr/bin/env python
"""
Temporary version of the schedule generator diagnostic script with proper Flask app context handling.
"""

import traceback
import sys
from datetime import date, datetime, timedelta
import uuid
from pathlib import Path
import logging
from logging.handlers import RotatingFileHandler
import click

# Add the project root to Python path
project_root = Path(__file__).resolve().parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Import Flask app and models first
from src.backend.app import create_app

# Path to the diagnostic logs folder
DIAGNOSTIC_DIR = project_root / "logs" / "diagnostics"
DIAGNOSTIC_DIR.mkdir(exist_ok=True)


# Configure diagnostic logging
class DiagnosticFormatter(logging.Formatter):
    """Custom formatter for diagnostic logs with timestamps and indentation for hierarchical steps"""

    def __init__(self):
        super().__init__("%(message)s")
        self.indent_level = 0

    def format(self, record):
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        indent = "  " * self.indent_level
        msg = record.getMessage()

        if msg.startswith("STEP:"):
            self.indent_level += 1
            return f"{timestamp} \033[1;36m{indent}{msg}\033[0m"
        elif msg.startswith("SUBSTEP:"):
            return f"{timestamp} \033[1;34m{indent}{msg}\033[0m"
        elif msg.startswith("ERROR:"):
            return f"{timestamp} \033[1;31m{indent}{msg}\033[0m"
        elif msg.startswith("WARNING:"):
            return f"{timestamp} \033[1;33m{indent}{msg}\033[0m"
        elif msg.startswith("SUCCESS:"):
            return f"{timestamp} \033[1;32m{indent}{msg}\033[0m"
        elif msg.startswith("INFO:"):
            return f"{timestamp} \033[1;37m{indent}{msg}\033[0m"
        elif msg.startswith("END STEP:"):
            result = f"{timestamp} \033[1;36m{indent}{msg}\033[0m"
            self.indent_level = max(0, self.indent_level - 1)
            return result
        elif msg.startswith("RECOMMENDATION:"):
            return f"{timestamp} \033[1;35m{indent}{msg}\033[0m"
        else:
            return f"{timestamp} {indent}{msg}"


def setup_diagnostic_logging(session_id):
    """Set up diagnostic logging for the scheduling process"""
    diagnostic_logger = logging.getLogger(f"diagnostic_{session_id}")
    diagnostic_logger.setLevel(logging.DEBUG)
    diagnostic_logger.propagate = False

    log_file = DIAGNOSTIC_DIR / f"schedule_diagnostic_{session_id}.log"
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10485760,  # 10MB
        backupCount=3,
        encoding="utf-8",
    )
    console_handler = logging.StreamHandler(stream=sys.stdout)

    formatter = DiagnosticFormatter()
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    diagnostic_logger.handlers = []
    diagnostic_logger.addHandler(file_handler)
    diagnostic_logger.addHandler(console_handler)

    return diagnostic_logger, log_file


def run_diagnostic(app, start_date=None, end_date=None, days=7):
    """Run the schedule generator diagnostic"""
    session_id = str(uuid.uuid4())[:8]
    logger, log_file = setup_diagnostic_logging(session_id)

    try:
        logger.info("STEP: Initializing diagnostic tool")
        logger.info(f"INFO: Diagnostic session ID: {session_id}")
        logger.info(f"INFO: Diagnostic log file: {log_file}")

        # Import models after app creation to ensure proper initialization
        from src.backend.models import Employee, ShiftTemplate, Coverage
        from src.backend.services.scheduler import ScheduleGenerator

        # Verify database connection
        logger.info("SUBSTEP: Verifying database connection")
        try:
            with app.app_context():
                result = Employee.query.count()
                logger.info(
                    f"SUCCESS: Database connection verified: {result} employees found"
                )
        except Exception as e:
            logger.error(f"ERROR: Database connection failed - {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "session_id": session_id,
                "error": str(e),
                "log_file": str(log_file),
            }

        # Set up dates
        if not start_date:
            start_date = date.today()
        elif isinstance(start_date, str):
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()

        if not end_date:
            end_date = start_date + timedelta(days=days - 1)
        elif isinstance(end_date, str):
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

        logger.info(f"INFO: Schedule date range: {start_date} to {end_date}")

        # Check database state
        try:
            with app.app_context():
                employee_count = Employee.query.count()
                active_employees = Employee.query.filter_by(is_active=True).count()
                keyholders = Employee.query.filter_by(is_keyholder=True).count()
                shift_count = ShiftTemplate.query.count()
                coverage_count = Coverage.query.count()

                logger.info(f"INFO: Total employees: {employee_count}")
                logger.info(f"INFO: Active employees: {active_employees}")
                logger.info(f"INFO: Keyholders: {keyholders}")
                logger.info(f"INFO: Shift templates: {shift_count}")
                logger.info(f"INFO: Coverage requirements: {coverage_count}")

                if employee_count == 0:
                    logger.warning("WARNING: No employees found in database")
                if shift_count == 0:
                    logger.warning("WARNING: No shift templates found in database")
                if coverage_count == 0:
                    logger.warning(
                        "WARNING: No coverage requirements found in database"
                    )

        except Exception as e:
            logger.error(f"ERROR: Failed to check database state - {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "session_id": session_id,
                "error": str(e),
                "log_file": str(log_file),
            }

        # Generate schedule
        logger.info("STEP: Generating schedule")
        try:
            with app.app_context():
                generator = ScheduleGenerator()
                result = generator.generate(
                    start_date=start_date,
                    end_date=end_date,
                    version=1,
                    session_id=session_id,
                )
                logger.info("SUCCESS: Schedule generation completed")
                return {
                    "session_id": session_id,
                    "log_file": str(log_file),
                    "result": result,
                }
        except Exception as e:
            logger.error(f"ERROR: Schedule generation failed - {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "session_id": session_id,
                "error": str(e),
                "log_file": str(log_file),
            }

    except Exception as e:
        logger.error(f"ERROR: Diagnostic failed - {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "session_id": session_id,
            "error": str(e),
            "log_file": str(log_file),
        }


# Create Flask CLI command
app = create_app()


@app.cli.command("run-diagnostic")
@click.option("--start-date", type=str, help="Start date in YYYY-MM-DD format")
@click.option("--end-date", type=str, help="End date in YYYY-MM-DD format")
@click.option("--days", type=int, default=7, help="Number of days if no dates provided")
def cli_run_diagnostic(start_date=None, end_date=None, days=7):
    """Run the schedule generator diagnostic"""
    result = run_diagnostic(app, start_date, end_date, days)

    print("\n" + "=" * 80)
    print(f"Diagnostic completed. Session ID: {result['session_id']}")
    print(f"Log file: {result['log_file']}")
    if "error" in result:
        print(f"Error: {result['error']}")
    print("=" * 80 + "\n")
