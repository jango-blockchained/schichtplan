#!/usr/bin/env python3
"""
Scheduler Diagnostic Tool

This script runs the schedule generator directly for a specified date range
and provides detailed diagnostic information to help identify why no shifts
are being assigned.
"""

import os
import sys
import logging
from datetime import date, datetime, timedelta
import argparse

# Add parent directories to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
root_dir = os.path.abspath(os.path.join(backend_dir, ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# Configure basic logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("scheduler_diagnostic")

# Import Flask app directly from app.py
try:
    from app import create_app

    print("Creating Flask app from app module...")
    app = create_app()
except ImportError as e:
    logger.warning(f"Could not import from app: {e}")
    try:
        # Try with the full package path
        from src.backend.app import create_app

        print("Creating Flask app from src.backend.app...")
        app = create_app()
    except ImportError as e:
        logger.error(f"Could not import create_app: {e}")
        logger.error(
            "This script requires the Flask application to access the database."
        )
        logger.error("Please run this script from the project root directory.")
        sys.exit(1)

if not app:
    logger.error("Failed to create Flask application")
    sys.exit(1)

# Make sure we push the app context before importing models
with app.app_context():
    # Import required modules - only do this AFTER setting up app context
    try:
        from services.scheduler.generator import ScheduleGenerator
        from services.scheduler.config import SchedulerConfig
        from services.scheduler.resources import ScheduleResources
        from models import (
            Employee,
            ShiftTemplate,
            Coverage,
            db,
            Absence,
            EmployeeAvailability,
        )
    except ImportError:
        try:
            from backend.services.scheduler.generator import ScheduleGenerator
            from backend.services.scheduler.config import SchedulerConfig
            from backend.services.scheduler.resources import ScheduleResources
            from backend.models import (
                Employee,
                ShiftTemplate,
                Coverage,
                db,
                Absence,
                EmployeeAvailability,
            )
        except ImportError:
            try:
                from src.backend.services.scheduler.generator import ScheduleGenerator
                from src.backend.services.scheduler.config import SchedulerConfig
                from src.backend.services.scheduler.resources import ScheduleResources
                from src.backend.models import (
                    Employee,
                    ShiftTemplate,
                    Coverage,
                    db,
                    Absence,
                    EmployeeAvailability,
                )
            except ImportError as e:
                logger.error(f"Error importing required modules: {e}")
                logger.error(
                    "Make sure you're running this script from the correct directory."
                )
                sys.exit(1)


def print_section(title):
    """Print a section title with formatting"""
    print("\n" + "=" * 80)
    print(f" {title} ".center(80, "="))
    print("=" * 80 + "\n")


def print_info(label, value):
    """Print labeled information with consistent formatting"""
    print(f"{label.ljust(25)}: {value}")


def diagnose_resources(resources):
    """Diagnose if the resources were loaded correctly"""
    print_section("RESOURCE DIAGNOSIS")

    # Employees
    employees = resources.employees
    active_employees = [e for e in employees if getattr(e, "is_active", True)]
    print_info("Total Employees", len(employees))
    print_info("Active Employees", len(active_employees))
    if len(active_employees) == 0:
        print("\n⚠️  WARNING: No active employees found! Shifts cannot be assigned.")

    # Shifts
    shifts = resources.shifts
    print_info("Total Shift Templates", len(shifts))
    if len(shifts) == 0:
        print("\n⚠️  WARNING: No shift templates found! No shifts to assign.")
    else:
        shift_types = {}
        for shift in shifts:
            shift_type = getattr(shift, "shift_type", None) or getattr(
                shift, "shift_type_id", "Unknown"
            )
            if shift_type not in shift_types:
                shift_types[shift_type] = 0
            shift_types[shift_type] += 1

        print("\nShift Types:")
        for s_type, count in shift_types.items():
            print(f"  • {s_type}: {count} templates")

        # Check if shifts have active_days configuration
        shifts_with_active_days = [
            s for s in shifts if hasattr(s, "active_days") and s.active_days
        ]
        print_info("\nShifts with active_days", len(shifts_with_active_days))
        if len(shifts_with_active_days) < len(shifts):
            print("⚠️  WARNING: Some shifts don't have active_days configuration!")

    # Coverage
    coverage = resources.coverage
    print_info("\nTotal Coverage Records", len(coverage))
    if len(coverage) == 0:
        print("\n⚠️  WARNING: No coverage records found! No demand for employees.")
    else:
        coverage_by_day = {}
        for cov in coverage:
            day_index = getattr(cov, "day_index", None)
            if day_index is None and hasattr(cov, "day_of_week"):
                day_index = cov.day_of_week

            if day_index not in coverage_by_day:
                coverage_by_day[day_index] = []
            coverage_by_day[day_index].append(cov)

        days = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]
        print("\nCoverage by Day:")
        for day_idx in range(7):
            day_coverage = coverage_by_day.get(day_idx, [])
            total_employees_needed = sum(
                getattr(c, "min_employees", 0) for c in day_coverage
            )

            print(
                f"  • {days[day_idx]}: {len(day_coverage)} records, {total_employees_needed} total employees needed"
            )

    # Absences
    absences = resources.absences
    print_info("\nTotal Absence Records", len(absences))

    # Availabilities
    availabilities = resources.availabilities
    print_info("Total Availability Records", len(availabilities))
    if len(availabilities) == 0 and len(active_employees) > 0:
        print("\n⚠️  NOTE: No availability records found. System will use defaults.")


def diagnose_date_coverage(resources, generator, date_to_check):
    """Diagnose coverage requirements for a specific date"""
    print_section(f"COVERAGE DIAGNOSIS FOR {date_to_check}")

    # Use the generator's _process_coverage method to check what shifts are needed
    try:
        shift_needs = generator._process_coverage(date_to_check)

        if not shift_needs:
            print("❌ No coverage requirements found for this date.")
            print("   Without coverage requirements, no shifts will be scheduled.")
            return False

        print(f"✅ Found coverage requirements for {len(shift_needs)} shifts:")
        for shift_id, count in shift_needs.items():
            shift = resources.get_shift(shift_id)
            shift_name = getattr(shift, "name", "Unknown") if shift else "Unknown Shift"
            shift_type = (
                getattr(shift, "shift_type_id", "Unknown") if shift else "Unknown Type"
            )
            print(
                f"  • Shift {shift_id} ({shift_name}, {shift_type}): {count} employees needed"
            )

        return True
    except Exception as e:
        print(f"❌ Error processing coverage: {str(e)}")
        return False


def diagnose_date_shifts(resources, generator, date_to_check):
    """Diagnose shift availability for a specific date"""
    print_section(f"SHIFT DIAGNOSIS FOR {date_to_check}")

    # Use the generator's _create_date_shifts method to check what shifts are available
    try:
        date_shifts = generator._create_date_shifts(date_to_check)

        if not date_shifts:
            print("❌ No applicable shift templates found for this date.")
            print("   Check if shift templates have appropriate active_days settings.")
            return False

        print(f"✅ Found {len(date_shifts)} applicable shift instances:")
        for idx, shift in enumerate(date_shifts, 1):
            shift_id = shift.get("shift_id")
            shift_type = shift.get("shift_type", "Unknown")
            start_time = shift.get("start_time", "Unknown")
            end_time = shift.get("end_time", "Unknown")
            print(
                f"  {idx}. Shift {shift_id} ({shift_type}): {start_time} - {end_time}"
            )

        return True
    except Exception as e:
        print(f"❌ Error creating date shifts: {str(e)}")
        return False


def diagnose_availability(
    resources, generator, date_to_check, distribution_manager=None
):
    """Diagnose employee availability for a specific date"""
    print_section(f"EMPLOYEE AVAILABILITY FOR {date_to_check}")

    # Get active employees
    active_employees = [e for e in resources.employees if getattr(e, "is_active", True)]

    if not active_employees:
        print("❌ No active employees found!")
        return False

    # Check availability for the day's shifts
    date_shifts = generator._create_date_shifts(date_to_check)
    if not date_shifts:
        print("❌ No shifts available to check against!")
        return False

    # If we have a distribution manager, use it (it has the proper availability checker)
    if distribution_manager:
        available_employees = distribution_manager.get_available_employees(
            date_to_check, date_shifts
        )
        print(
            f"✅ Found {len(available_employees)} generally available employees out of {len(active_employees)} active."
        )

        if len(available_employees) == 0:
            print("\n⚠️  WARNING: No employees are available for this date!")
            print("   Check employee absence records and availability settings.")
        else:
            # Further diagnose by shift type if employees are available
            shifts_by_type = {}
            for shift in date_shifts:
                shift_type = shift.get("shift_type", "Unknown")
                if shift_type not in shifts_by_type:
                    shifts_by_type[shift_type] = []
                shifts_by_type[shift_type].append(shift)

            print("\nAvailability by Shift Type:")
            for shift_type, type_shifts in shifts_by_type.items():
                available_for_type = distribution_manager.get_available_employees(
                    date_to_check, type_shifts
                )
                print(
                    f"  • {shift_type}: {len(available_for_type)} employees available"
                )

                if len(available_for_type) == 0:
                    print("    ⚠️  WARNING: No employees available for this shift type!")

        return len(available_employees) > 0
    else:
        # No distribution manager, do basic checks
        availability_checker = generator.availability_checker

        available_count = 0
        available_by_employee = {}

        for employee in active_employees:
            is_on_leave = availability_checker.is_employee_on_leave(
                employee.id, date_to_check
            )

            if is_on_leave:
                available_by_employee[employee.id] = f"❌ On leave/absence"
                continue

            # Check availability for each shift
            available_shifts = []
            unavailable_shifts = []

            for shift in date_shifts:
                shift_template = resources.get_shift(shift.get("shift_id"))
                if shift_template:
                    is_available, avail_type = (
                        availability_checker.is_employee_available(
                            employee.id, date_to_check, shift_template
                        )
                    )

                    if is_available:
                        available_shifts.append(
                            f"Shift {shift_template.id} ({avail_type})"
                        )
                    else:
                        unavailable_shifts.append(f"Shift {shift_template.id}")

            if available_shifts:
                available_by_employee[employee.id] = (
                    f"✅ Available for: {', '.join(available_shifts)}"
                )
                available_count += 1
            else:
                available_by_employee[employee.id] = f"❌ Not available for any shifts"

        print(
            f"✅ Found {available_count} available employees out of {len(active_employees)} active."
        )

        if available_count == 0:
            print("\n⚠️  WARNING: No employees are available for this date!")
            print("   Check employee absence records and availability settings.")
        else:
            print("\nEmployee Availability Details:")
            for emp_id, status in available_by_employee.items():
                employee = resources.get_employee(emp_id)
                name = getattr(employee, "name", f"Employee {emp_id}")
                print(f"  • {name}: {status}")

        return available_count > 0


def diagnose_constraints(resources, generator, date_to_check):
    """Diagnose constraint issues for a specific date"""
    print_section(f"CONSTRAINT DIAGNOSIS FOR {date_to_check}")

    constraint_checker = generator.constraint_checker
    config = generator.config

    # Print key constraint settings
    print("Current Constraint Settings:")
    print(
        f"  • Max Consecutive Days: {getattr(config, 'max_consecutive_days', 'Not set')}"
    )
    print(f"  • Min Rest Hours: {getattr(config, 'min_rest_hours', 'Not set')}")
    print(
        f"  • Enforce Rest Periods: {getattr(config, 'enforce_rest_periods', 'Not set')}"
    )

    # Get max hours per group
    if hasattr(config, "max_hours_per_group"):
        print("\nMax Hours Per Employee Group:")
        for group, hours in config.max_hours_per_group.items():
            print(f"  • {group}: {hours} hours")

    # Get daily hours per employee group
    if hasattr(config, "employee_types"):
        print("\nMax Daily Hours Per Employee Type:")
        for emp_type in config.employee_types:
            print(
                f"  • {emp_type.get('id', 'Unknown')}: {emp_type.get('max_daily_hours', 'Not set')} hours"
            )

    # For a complete check, we would need a distribution manager and existing schedule
    # Since this gets complex, we'll just provide the constraint settings for now

    print(
        "\nNOTE: For detailed constraint violations, check the generated diagnostic logs."
    )
    print("      Look for messages like 'Employee X exceeds constraints for shift Y'")


def run_schedule_generation(start_date, end_date, debug=True):
    """Run the schedule generation for a date range with diagnostics"""
    print_section("RUNNING SCHEDULE GENERATION")
    print_info("Start Date", start_date)
    print_info("End Date", end_date)

    # Always use the Flask app context for database operations
    with app.app_context():
        # Configure resources and generator
        resources = ScheduleResources()
        try:
            print("Loading resources...")
            resources.load()
            print("Resources loaded successfully!")

            # Diagnose the resources first
            diagnose_resources(resources)

            config = SchedulerConfig()
            if debug:
                # Set debug-friendly config settings
                config.max_consecutive_days = 7  # Relaxed setting
                config.enforce_rest_periods = False  # Disable for testing

            generator = ScheduleGenerator(resources, config)

            # Run the generation with diagnostics
            try:
                result = generator.generate(start_date, end_date)

                # Check if any assignments were generated
                assignments = result.get("entries", [])
                metrics = result.get("metrics", {})

                print_info("Assignments Generated", len(assignments))

                if len(assignments) == 0:
                    print("\n❌ NO ASSIGNMENTS WERE GENERATED!")

                    # Print diagnostic log location
                    session_id = getattr(generator, "session_id", "unknown")
                    print_info("Diagnostic Log Session", session_id)

                    # Run diagnostics for each day
                    current_date = start_date
                    while current_date <= end_date:
                        # Diagnose each stage of the process for this date
                        has_coverage = diagnose_date_coverage(
                            resources, generator, current_date
                        )
                        if not has_coverage:
                            print(
                                "\n⚠️  No coverage requirements found for this date, skipping further diagnostics."
                            )
                            current_date += timedelta(days=1)
                            continue

                        has_shifts = diagnose_date_shifts(
                            resources, generator, current_date
                        )
                        if not has_shifts:
                            print(
                                "\n⚠️  No applicable shifts found for this date, skipping further diagnostics."
                            )
                            current_date += timedelta(days=1)
                            continue

                        has_available = diagnose_availability(
                            resources, generator, current_date
                        )
                        if not has_available:
                            print(
                                "\n⚠️  No available employees for this date, skipping further diagnostics."
                            )
                            current_date += timedelta(days=1)
                            continue

                        diagnose_constraints(resources, generator, current_date)

                        current_date += timedelta(days=1)
                else:
                    print("\n✅ ASSIGNMENTS WERE SUCCESSFULLY GENERATED!\n")
                    # Print metrics if available
                    if metrics:
                        print("Distribution Metrics:")
                        for key, value in metrics.items():
                            if isinstance(value, dict):
                                print(f"  {key}:")
                                for subkey, subvalue in value.items():
                                    print(f"    {subkey}: {subvalue}")
                            else:
                                print(f"  {key}: {value}")

                return result

            except Exception as e:
                print(f"\n❌ ERROR DURING SCHEDULE GENERATION: {str(e)}")
                import traceback

                traceback.print_exc()
                return None

        except Exception as e:
            print(f"\n❌ ERROR LOADING RESOURCES: {str(e)}")
            import traceback

            traceback.print_exc()
            return None


def main():
    """Main function to parse arguments and run the diagnostic"""
    parser = argparse.ArgumentParser(description="Schedule Generator Diagnostic Tool")
    parser.add_argument(
        "--start",
        type=lambda s: datetime.strptime(s, "%Y-%m-%d").date(),
        default=date.today(),
        help="Start date in YYYY-MM-DD format. Defaults to today.",
    )
    parser.add_argument(
        "--end",
        type=lambda s: datetime.strptime(s, "%Y-%m-%d").date(),
        default=date.today() + timedelta(days=6),
        help="End date in YYYY-MM-DD format. Defaults to one week from today.",
    )
    parser.add_argument(
        "--no-debug",
        action="store_true",
        help="Don't modify config settings for debugging.",
    )

    args = parser.parse_args()

    print_section("SCHEDULER DIAGNOSTIC TOOL")
    print(
        "This tool runs the schedule generator and diagnoses why shifts might not be assigned."
    )
    print_info("Start Date", args.start)
    print_info("End Date", args.end)
    print_info("Debug Mode", not args.no_debug)

    run_schedule_generation(args.start, args.end, debug=not args.no_debug)

    print("\n" + "=" * 80)
    print(" DIAGNOSTIC COMPLETE ".center(80, "="))
    print("=" * 80)


if __name__ == "__main__":
    main()
