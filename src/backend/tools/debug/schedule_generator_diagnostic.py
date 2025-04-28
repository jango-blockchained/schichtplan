#!/usr/bin/env python
"""
Diagnostic test for the schedule generator backend process.
This tool logs each step of the scheduling process, identifies where the solution gets stuck,
and provides recommendations for resolving issues.
"""

import traceback
import sys
import time
import json
import os
from datetime import date, datetime, timedelta
import uuid
from pathlib import Path
import logging
from logging.handlers import RotatingFileHandler

# Import the db instance at the top level
from src.backend.models import db

# Path to the diagnostic logs folder
DIAGNOSTIC_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent / "logs" / "diagnostics"
)
DIAGNOSTIC_DIR.mkdir(exist_ok=True)


# Configure diagnostic logging
class DiagnosticFormatter(logging.Formatter):
    """Custom formatter for diagnostic logs with timestamps and indentation for hierarchical steps"""

    def __init__(self):
        super().__init__("%(message)s")
        self.indent_level = 0

    def format(self, record):
        # Add timestamp to each record
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        indent = "  " * self.indent_level
        msg = record.getMessage()

        # Format based on message type
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
    # Create a logger
    diagnostic_logger = logging.getLogger(f"diagnostic_{session_id}")
    diagnostic_logger.setLevel(logging.DEBUG)
    diagnostic_logger.propagate = False

    # Create handlers
    log_file = DIAGNOSTIC_DIR / f"schedule_diagnostic_{session_id}.log"
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10485760,  # 10MB
        backupCount=3,
        encoding="utf-8",
    )
    console_handler = logging.StreamHandler(stream=sys.stdout)

    # Create and set formatter
    formatter = DiagnosticFormatter()
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # Add handlers to logger
    diagnostic_logger.handlers = []  # Clear any existing handlers
    diagnostic_logger.addHandler(file_handler)
    diagnostic_logger.addHandler(console_handler)

    return diagnostic_logger, log_file


class ScheduleGeneratorDiagnostic:
    """Diagnostic wrapper for the schedule generator process"""

    def __init__(self):
        """Initialize the diagnostic tool"""
        self.session_id = str(uuid.uuid4())[
            :8
        ]  # Generate a short unique ID for this diagnostic session
        self.logger, self.log_file = setup_diagnostic_logging(self.session_id)
        self.app = None
        self.times = {}
        self.stats = {
            "employees": 0,
            "shifts": 0,
            "coverage_blocks": 0,
            "dates": 0,
            "available_employees": 0,
            "assignments_made": 0,
            "constraints_applied": 0,
            "errors": 0,
            "warnings": 0,
        }
        self.bottlenecks = []
        self.recommendations = []

    def _log_step(self, step_name):
        """Log a major step in the process"""
        self.logger.info(f"STEP: {step_name}")
        self.times[step_name] = {"start": time.time()}

    def _log_end_step(self, step_name):
        """Log the end of a major step and record duration"""
        if step_name in self.times:
            duration = time.time() - self.times[step_name]["start"]
            self.times[step_name]["duration"] = duration
            self.logger.info(f"END STEP: {step_name} (took {duration:.3f}s)")

            # Detect slow steps (over 2 seconds)
            if duration > 2.0:
                self.bottlenecks.append(
                    {
                        "step": step_name,
                        "duration": duration,
                        "timestamp": datetime.now().isoformat(),
                    }
                )
        else:
            self.logger.info(f"END STEP: {step_name} (duration unknown)")

    def _log_substep(self, substep_name):
        """Log a substep in the process"""
        self.logger.info(f"SUBSTEP: {substep_name}")

    def _log_error(self, message, error=None):
        """Log an error with details"""
        self.stats["errors"] += 1
        if error:
            self.logger.error(
                f"ERROR: {message} - {type(error).__name__}: {str(error)}"
            )
            self.logger.error(traceback.format_exc())
        else:
            self.logger.error(f"ERROR: {message}")

    def _log_warning(self, message):
        """Log a warning"""
        self.stats["warnings"] += 1
        self.logger.warning(f"WARNING: {message}")

    def _log_info(self, message):
        """Log general information"""
        self.logger.info(f"INFO: {message}")

    def _log_success(self, message):
        """Log a successful outcome"""
        self.logger.info(f"SUCCESS: {message}")

    def _log_recommendation(self, message):
        """Log a recommendation"""
        self.logger.info(f"RECOMMENDATION: {message}")
        self.recommendations.append(message)

    def run_diagnostic(self, start_date=None, end_date=None, days=7):
        """Run a full diagnostic test on the schedule generator process"""
        try:
            self._log_step("Initializing diagnostic tool")
            self._log_info(f"Diagnostic session ID: {self.session_id}")
            self._log_info(f"Diagnostic log file: {self.log_file}")

            # Check environment settings
            flask_app = os.environ.get("FLASK_APP")
            flask_env = os.environ.get("FLASK_ENV")
            debug_mode = os.environ.get("DEBUG_MODE")

            self._log_info("Environment settings:")
            self._log_info(f"  FLASK_APP: {flask_app or '(not set)'}")
            self._log_info(f"  FLASK_ENV: {flask_env or '(not set)'}")
            self._log_info(f"  DEBUG_MODE: {debug_mode or '(not set)'}")

            if not flask_app:
                os.environ["FLASK_APP"] = "src.backend.app"
                self._log_warning("FLASK_APP not set, setting to src.backend.app")

            if not flask_env:
                os.environ["FLASK_ENV"] = "development"
                self._log_warning("FLASK_ENV not set, setting to development")

            if not debug_mode:
                os.environ["DEBUG_MODE"] = "1"
                self._log_warning("DEBUG_MODE not set, setting to 1")

            # Import Flask app (here to avoid circular imports)
            self._log_substep("Importing required modules")
            try:
                # Use direct import to avoid ambiguity
                sys.path.insert(
                    0, str(Path(__file__).resolve().parent.parent.parent.parent.parent)
                )
                self._log_info(
                    f"Python path updated to include project root: {sys.path[0]}"
                )

                import src.backend.app

                self._log_success("Successfully imported app module")
            except ImportError as e:
                self._log_error("Failed to import Flask app", e)
                self._log_recommendation(
                    "Check your Python path settings. Run this script from the project root with PYTHONPATH=."
                )
                raise

            self._log_end_step("Initializing diagnostic tool")

            # Create app instance
            self._log_step("Setting up Flask application")
            try:
                self.app = src.backend.app.create_app()
                self._log_success("Flask application created successfully")
            except Exception as e:
                self._log_error("Failed to create Flask application", e)
                self._log_recommendation(
                    "Check your app configuration in src/backend/app.py"
                )
                raise
            self._log_end_step("Setting up Flask application")

            # Run the diagnostics within the app context
            with self.app.app_context():
                # Now import models INSIDE the app context
                self._log_substep("Importing models within app context")
                try:
                    # Import the shared db instance - MOVED TO TOP LEVEL
                    # from src.backend.models import db

                    # Now import specific models
                    from src.backend.models import (
                        Employee,
                        ShiftTemplate,
                        Coverage,
                        Settings,
                        Schedule,
                        EmployeeAvailability,
                        Absence,
                    )
                    self._log_info("Successfully imported model classes")

                    # Import scheduler services
                    from src.backend.services.scheduler.generator import (
                        ScheduleGenerator,
                    )
                    self._log_info("Successfully imported ScheduleGenerator")

                    self._log_success("Models imported successfully")
                except ImportError as e:
                    self._log_error(f"Failed to import models or generator: {e}")
                    self._log_recommendation("Check Python path and model imports")
                    raise

                # Set up dates for the schedule
                self._log_step("Setting up schedule date range")
                if not start_date:
                    today = date.today()
                    start_date = today
                elif isinstance(start_date, str):
                    start_date = datetime.strptime(start_date, "%Y-%m-%d").date()

                if not end_date:
                    end_date = start_date + timedelta(days=days - 1)
                elif isinstance(end_date, str):
                    end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

                self._log_info(
                    f"Schedule date range: {start_date} to {end_date} ({(end_date - start_date).days + 1} days)"
                )
                self.stats["dates"] = (end_date - start_date).days + 1
                self._log_end_step("Setting up schedule date range")

                # Make sure db is properly initialized
                self._log_substep("Verifying database connection")
                try:
                    # Verify database is accessible by querying something simple
                    result = db.session.execute(
                        db.select(db.func.count()).select_from(Employee.__table__)
                    ).scalar()
                    self._log_success(
                        f"Database connection verified: {result} employees found"
                    )
                except Exception as e:
                    self._log_error("Database connection failed", e)
                    self._log_recommendation(
                        "Check database configuration and connection"
                    )
                    raise

                # Check database state
                self._log_step("Analyzing database state")

                # Check employees
                try:
                    # Use db.session.execute instead of Model.query
                    employee_count = db.session.execute(db.select(db.func.count(Employee.id))).scalar_one()
                    active_employees = db.session.execute(db.select(db.func.count(Employee.id)).filter_by(is_active=True)).scalar_one()
                    keyholders = db.session.execute(db.select(db.func.count(Employee.id)).filter_by(is_keyholder=True)).scalar_one()

                    self.stats["employees"] = employee_count
                    self.stats["available_employees"] = active_employees

                    self._log_info(f"Total employees: {employee_count}")
                    self._log_info(f"Active employees: {active_employees}")
                    self._log_info(f"Keyholders: {keyholders}")

                    if active_employees == 0:
                        self._log_error("No active employees found in database")
                        self._log_recommendation(
                            "Create at least one active employee in the database"
                        )
                    elif keyholders == 0:
                        self._log_warning("No keyholders found in the database")
                        self._log_recommendation(
                            "Designate at least one employee as keyholder"
                        )

                    # Check shift templates
                    # Use db.session.execute instead of Model.query
                    shift_count = db.session.execute(db.select(db.func.count(ShiftTemplate.id))).scalar_one()
                    self.stats["shifts"] = shift_count
                    self._log_info(f"Shift templates: {shift_count}")

                    if shift_count == 0:
                        self._log_error("No shift templates found in database")
                        self._log_recommendation(
                            "Create shift templates in the database"
                        )

                    # Check coverage requirements
                    # Use db.session.execute instead of Model.query
                    coverage_count = db.session.execute(db.select(db.func.count(Coverage.id))).scalar_one()
                    self.stats["coverage_blocks"] = coverage_count
                    self._log_info(f"Coverage requirements: {coverage_count}")

                    if coverage_count == 0:
                        self._log_error("No coverage requirements found in database")
                        self._log_recommendation(
                            "Define coverage requirements in the database"
                        )

                    # Check settings
                    # Use db.session.execute instead of Model.query
                    settings = db.session.execute(db.select(Settings)).scalar_one_or_none()
                    if not settings:
                        self._log_warning(
                            "No settings found in database, using defaults"
                        )
                        self._log_recommendation("Create settings in the database")
                    else:
                        self._log_info(
                            f"Settings: min_hours_between_shifts={settings.min_hours_between_shifts}, max_consecutive_days={settings.max_consecutive_days}"
                        )
                except Exception as e:
                    self._log_error("Failed to query database state", e)
                    self._log_recommendation("Check database connection and schema")
                    raise

                self._log_end_step("Analyzing database state")

                # Check existing schedule entries
                self._log_step("Checking existing schedule entries")
                try:
                    # Use db.session.execute instead of Model.query
                    existing_entries = db.session.execute(
                        db.select(db.func.count(Schedule.id)).filter(
                            Schedule.date >= start_date, Schedule.date <= end_date
                        )
                    ).scalar_one()

                    self._log_info(
                        f"Existing schedule entries for date range: {existing_entries}"
                    )

                    if existing_entries > 0:
                        self._log_warning(
                            f"Found {existing_entries} existing schedule entries in the date range"
                        )
                        self._log_recommendation(
                            "Consider clearing existing entries before generating a new schedule"
                        )
                except Exception as e:
                    self._log_error("Failed to check existing schedule entries", e)
                    self._log_recommendation(
                        "Check Schedule model and database connection"
                    )

                self._log_end_step("Checking existing schedule entries")

                # Monitoring hooks for the ScheduleGenerator
                original_generate = ScheduleGenerator.generate

                def generate_with_monitoring(self_instance, *args, **kwargs):
                    """Wrapper function to monitor the generate method"""
                    self._log_step("Running ScheduleGenerator.generate")

                    # Monitor the schedule generator steps
                    original_create_schedule = self_instance._create_schedule
                    original_assign_shifts = self_instance._assign_shifts
                    original_validate_schedule = self_instance._validate_schedule
                    original_finalize_schedule = self_instance._finalize_schedule

                    def monitored_create_schedule(*args, **kwargs):
                        self._log_substep("Creating initial schedule structure")
                        start_time = time.time()
                        result = original_create_schedule(*args, **kwargs)
                        duration = time.time() - start_time
                        self._log_info(
                            f"Initial schedule structure created in {duration:.3f}s"
                        )
                        return result

                    def monitored_assign_shifts(*args, **kwargs):
                        self._log_substep("Assigning shifts to employees")
                        start_time = time.time()
                        result = original_assign_shifts(*args, **kwargs)
                        duration = time.time() - start_time

                        # Count assignments made
                        assignments = sum(
                            1
                            for entry in self_instance.schedule
                            if entry.get("shift_id") is not None
                        )
                        self.stats["assignments_made"] = assignments

                        self._log_info(
                            f"Shift assignment completed in {duration:.3f}s with {assignments} assignments made"
                        )

                        if duration > 5.0:
                            self._log_warning(
                                f"Shift assignment took {duration:.3f}s which is longer than expected"
                            )
                            self._log_recommendation(
                                "Consider optimizing the shift assignment algorithm or reducing the complexity of constraints"
                            )

                        return result

                    def monitored_validate_schedule(*args, **kwargs):
                        self._log_substep("Validating schedule against constraints")
                        start_time = time.time()
                        result = original_validate_schedule(*args, **kwargs)
                        duration = time.time() - start_time

                        # Count constraints applied
                        constraints = (
                            len(self_instance.validator.validation_errors)
                            if hasattr(self_instance, "validator")
                            else 0
                        )
                        self.stats["constraints_applied"] = constraints

                        self._log_info(
                            f"Schedule validation completed in {duration:.3f}s with {constraints} constraint violations"
                        )
                        return result

                    def monitored_finalize_schedule(*args, **kwargs):
                        self._log_substep("Finalizing schedule")
                        start_time = time.time()
                        result = original_finalize_schedule(*args, **kwargs)
                        duration = time.time() - start_time
                        self._log_info(
                            f"Schedule finalization completed in {duration:.3f}s"
                        )
                        return result

                    # Replace methods with monitored versions
                    self_instance._create_schedule = monitored_create_schedule
                    self_instance._assign_shifts = monitored_assign_shifts
                    self_instance._validate_schedule = monitored_validate_schedule
                    self_instance._finalize_schedule = monitored_finalize_schedule

                    # Call the original method
                    start_time = time.time()
                    try:
                        result = original_generate(self_instance, *args, **kwargs)
                        duration = time.time() - start_time

                        # Restore original methods
                        self_instance._create_schedule = original_create_schedule
                        self_instance._assign_shifts = original_assign_shifts
                        self_instance._validate_schedule = original_validate_schedule
                        self_instance._finalize_schedule = original_finalize_schedule

                        self._log_end_step("Running ScheduleGenerator.generate")
                        self._log_success(
                            f"Schedule generation completed successfully in {duration:.3f}s"
                        )
                        return result
                    except Exception as e:
                        # Restore original methods
                        self_instance._create_schedule = original_create_schedule
                        self_instance._assign_shifts = original_assign_shifts
                        self_instance._validate_schedule = original_validate_schedule
                        self_instance._finalize_schedule = original_finalize_schedule

                        self._log_error("Schedule generation failed", e)
                        self._log_end_step("Running ScheduleGenerator.generate")
                        raise

                # Replace the generate method with our monitored version
                ScheduleGenerator.generate = generate_with_monitoring

                # Run the schedule generator
                self._log_step("Creating ScheduleGenerator instance")
                try:
                    generator = ScheduleGenerator()
                    self._log_success("ScheduleGenerator instance created successfully")
                except Exception as e:
                    self._log_error("Failed to create ScheduleGenerator instance", e)
                    self._log_recommendation(
                        "Check the ScheduleGenerator implementation for errors"
                    )
                    raise
                self._log_end_step("Creating ScheduleGenerator instance")

                # Generate the schedule
                self._log_step("Generating schedule")
                try:
                    result = generator.generate(
                        start_date=start_date,
                        end_date=end_date,
                        version=1,
                        session_id=self.session_id,
                    )

                    # Analyze results
                    schedule_entries = result.get("schedule", [])
                    warnings = result.get("warnings", [])
                    errors = result.get("errors", [])

                    self._log_info(
                        f"Generated {len(schedule_entries)} schedule entries"
                    )
                    self._log_info(f"Warnings: {len(warnings)}")
                    self._log_info(f"Errors: {len(errors)}")

                    if errors:
                        self._log_warning(
                            f"Schedule generation completed with {len(errors)} errors"
                        )
                        for i, error in enumerate(errors[:5]):
                            self._log_warning(
                                f"Error {i + 1}: {error.get('message', 'Unknown error')}"
                            )

                        if len(errors) > 5:
                            self._log_warning(f"... and {len(errors) - 5} more errors")
                    else:
                        self._log_success(
                            "Schedule generation completed successfully without errors"
                        )

                    # Check the coverage achievement
                    self._log_substep("Analyzing coverage achievement")
                    coverage_by_day = {}
                    current_date = start_date
                    while current_date <= end_date:
                        day_entries = [
                            e
                            for e in schedule_entries
                            if e.get("date") == current_date.strftime("%Y-%m-%d")
                        ]
                        coverage_by_day[current_date.strftime("%Y-%m-%d")] = len(
                            day_entries
                        )
                        current_date += timedelta(days=1)

                    for day, count in coverage_by_day.items():
                        self._log_info(f"Coverage for {day}: {count} assignments")

                    # Save the diagnostic result
                    diagnostic_result = {
                        "session_id": self.session_id,
                        "timestamp": datetime.now().isoformat(),
                        "date_range": {
                            "start_date": start_date.isoformat(),
                            "end_date": end_date.isoformat(),
                            "days": (end_date - start_date).days + 1,
                        },
                        "statistics": self.stats,
                        "bottlenecks": self.bottlenecks,
                        "recommendations": self.recommendations,
                        "timings": self.times,
                        "warnings_count": len(warnings),
                        "errors_count": len(errors),
                        "schedule_entries_count": len(schedule_entries),
                    }

                    result_file = (
                        DIAGNOSTIC_DIR / f"diagnostic_result_{self.session_id}.json"
                    )
                    with open(result_file, "w") as f:
                        json.dump(diagnostic_result, f, indent=4)

                    self._log_success(f"Diagnostic results saved to {result_file}")

                except Exception as e:
                    self._log_error("Schedule generation failed", e)

                    # Analyze where it failed
                    tb = traceback.format_exc()
                    if "resources.load" in tb:
                        self._log_recommendation(
                            "The failure occurred while loading resources. Check database connectivity and resource models."
                        )
                    elif "assign_shifts" in tb:
                        self._log_recommendation(
                            "The failure occurred during shift assignment. Check the shift assignment algorithm and constraints."
                        )
                    elif "validate_schedule" in tb:
                        self._log_recommendation(
                            "The failure occurred during schedule validation. Check the validation rules."
                        )
                    elif "finalize_schedule" in tb:
                        self._log_recommendation(
                            "The failure occurred while finalizing the schedule. Check database connectivity and transaction handling."
                        )
                    else:
                        self._log_recommendation(
                            "Check the traceback for details on where the failure occurred."
                        )

                    raise
                finally:
                    # Restore the original generate method
                    ScheduleGenerator.generate = original_generate

                self._log_end_step("Generating schedule")

                # Generate final recommendations
                self._log_step("Generating recommendations")

                # Check for bottlenecks
                if self.bottlenecks:
                    self._log_info(
                        f"Identified {len(self.bottlenecks)} performance bottlenecks"
                    )
                    for bottleneck in self.bottlenecks:
                        self._log_info(
                            f"Bottleneck: {bottleneck['step']} - {bottleneck['duration']:.3f}s"
                        )

                    # Add recommendations based on bottlenecks
                    slowest_bottleneck = max(
                        self.bottlenecks, key=lambda x: x["duration"]
                    )
                    if (
                        slowest_bottleneck["step"]
                        == "Running ScheduleGenerator.generate"
                    ):
                        self._log_recommendation(
                            "Consider optimizing the overall schedule generation algorithm"
                        )
                    elif "assign_shifts" in slowest_bottleneck["step"]:
                        self._log_recommendation(
                            "Optimize the shift assignment algorithm or reduce constraint complexity"
                        )
                    elif "validate_schedule" in slowest_bottleneck["step"]:
                        self._log_recommendation(
                            "Optimize the schedule validation process or reduce the number of validation rules"
                        )

                # Check for data issues
                if self.stats["employees"] == 0:
                    self._log_recommendation("Add employees to the database")
                if self.stats["shifts"] == 0:
                    self._log_recommendation("Add shift templates to the database")
                if self.stats["coverage_blocks"] == 0:
                    self._log_recommendation(
                        "Add coverage requirements to the database"
                    )

                if self.stats["employees"] > 0 and self.stats["assignments_made"] == 0:
                    self._log_recommendation(
                        "No assignments were made. Check shift templates and employee availability."
                    )

                if self.stats["errors"] > 5:
                    self._log_recommendation(
                        "High number of errors. Review the scheduler implementation for bugs."
                    )

                if self.stats["warnings"] > 10:
                    self._log_recommendation(
                        "High number of warnings. Review the scheduler configuration and constraints."
                    )

                self._log_end_step("Generating recommendations")

                # Summary
                self._log_step("Summary")
                self._log_info(
                    f"Total time: {sum(timing['duration'] for timing in self.times.values() if 'duration' in timing):.3f}s"
                )
                self._log_info(f"Errors: {self.stats['errors']}")
                self._log_info(f"Warnings: {self.stats['warnings']}")
                self._log_info(f"Employees: {self.stats['employees']}")
                self._log_info(f"Shifts: {self.stats['shifts']}")
                self._log_info(f"Coverage blocks: {self.stats['coverage_blocks']}")
                self._log_info(f"Assignments made: {self.stats['assignments_made']}")

                self._log_info("Final recommendations:")
                for i, recommendation in enumerate(self.recommendations):
                    self._log_recommendation(f"{i + 1}. {recommendation}")

                self._log_success("Diagnostic completed successfully")
                self._log_end_step("Summary")

                return {
                    "session_id": self.session_id,
                    "log_file": str(self.log_file),
                    "stats": self.stats,
                    "bottlenecks": self.bottlenecks,
                    "recommendations": self.recommendations,
                }

        except Exception as e:
            self._log_error("Diagnostic failed", e)
            self._log_recommendation("Fix the errors and run the diagnostic again")
            return {
                "session_id": self.session_id,
                "error": str(e),
                "log_file": str(self.log_file),
            }


def run_diagnostic(start_date=None, end_date=None, days=7):
    """Run the schedule generator diagnostic"""
    diagnostic = ScheduleGeneratorDiagnostic()
    result = diagnostic.run_diagnostic(start_date, end_date, days)

    print("\n" + "=" * 80)
    print(f"Diagnostic completed. Session ID: {diagnostic.session_id}")
    print(f"Log file: {diagnostic.log_file}")
    print("=" * 80 + "\n")

    return result


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Run a diagnostic test on the schedule generator"
    )
    parser.add_argument(
        "--start-date", type=str, help="Start date in YYYY-MM-DD format"
    )
    parser.add_argument("--end-date", type=str, help="End date in YYYY-MM-DD format")
    parser.add_argument(
        "--days", type=int, default=7, help="Number of days if no dates provided"
    )

    args = parser.parse_args()

    run_diagnostic(args.start_date, args.end_date, args.days)
