#!/usr/bin/env python
"""
Scheduler process tracing script.
This script adds detailed instrumentation to the schedule generation process
to trace all the steps and identify exactly where the issue is occurring.
"""

import os
import sys
import logging
import json
from datetime import date, datetime, timedelta
from contextlib import contextmanager

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
root_dir = os.path.abspath(os.path.join(backend_dir, "../.."))
sys.path.insert(0, root_dir)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("scheduler_tracer")


@contextmanager
def trace_section(name, indent=0):
    """Context manager to log start/end of sections with timing"""
    print(f"{' ' * indent}▶ Starting: {name}")
    start_time = datetime.now()
    yield
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    print(f"{' ' * indent}✓ Completed: {name} ({duration:.3f}s)")


def pretty_print_json(data, indent=0):
    """Pretty print JSON data with indentation"""
    if not data:
        print(f"{' ' * indent}  (Empty/None)")
        return

    if isinstance(data, (list, dict)):
        formatted = json.dumps(data, indent=2)
        prefix = " " * indent
        formatted = "\n".join([f"{prefix}  {line}" for line in formatted.splitlines()])
        print(formatted)
    else:
        print(f"{' ' * indent}  {data}")


def main():
    """Main function for tracing the scheduler process"""
    print("=" * 80)
    print("SCHEDULER PROCESS TRACER")
    print("=" * 80)
    print(
        "This tool provides detailed step-by-step tracing of the schedule generation process.\n"
    )

    # Import necessary modules
    try:
        from src.backend.app import create_app
        from src.backend.models import db
        from src.backend.services.scheduler.generator import ScheduleGenerator

        print("✅ Successfully imported required modules")
    except ImportError as e:
        print(f"❌ Error importing modules: {e}")
        return

    # Create Flask application context
    app = create_app()
    with app.app_context():
        try:
            # Create our test date range
            # Use a hard-coded date for consistency
            test_date = date(2025, 5, 10)  # A Saturday
            print(f"Using test date: {test_date} (weekday: {test_date.weekday()})")
            # 0=Monday, 6=Sunday in Python's weekday()

            # Create a schedule generator
            with trace_section("Initializing ScheduleGenerator"):
                generator = ScheduleGenerator()

            # Create a detailed trace of each step of the scheduler
            print("\n1. EXAMINING COVERAGE PROCESSING")
            print("=" * 50)
            with trace_section("Processing coverage"):
                # Process coverage for the test date
                shift_needs = generator._process_coverage(test_date)
                print(f"  Coverage needs result:")
                pretty_print_json(shift_needs, indent=2)

                # Analyze result
                if not shift_needs:
                    print("  ⚠️ WARNING: No coverage needs were determined!")
                else:
                    print(f"  ✅ Found {len(shift_needs)} coverage needs")

            print("\n2. EXAMINING SHIFT TEMPLATE SELECTION")
            print("=" * 50)
            with trace_section("Creating date shifts"):
                # Create shifts for the test date
                date_shifts = generator._create_date_shifts(test_date)
                print(f"  Shift instances created: {len(date_shifts)}")

                if date_shifts:
                    print("  First few shift instances:")
                    for i, shift in enumerate(date_shifts[:3]):
                        print(f"  Shift {i + 1}:")
                        pretty_print_json(shift, indent=4)

                # Analyze result
                if not date_shifts:
                    print("  ⚠️ WARNING: No shift instances were created!")
                else:
                    print(f"  ✅ Created {len(date_shifts)} shift instances")

            # Test if the shift filtering process works
            print("\n3. EXAMINING DISTRIBUTION PREPARATION")
            print("=" * 50)

            # Create a copy of the assignment logic - now we use all shifts
            with trace_section("Filtering shifts"):
                needed_shift_instances = date_shifts
                print(f"  Using all {len(needed_shift_instances)} shift instances")

            print("\n4. EXAMINING EMPLOYEE ASSIGNMENT")
            print("=" * 50)

            with trace_section("Getting available employees"):
                # Get all available employees for that date
                available_employees = (
                    generator.distribution_manager.get_available_employees(test_date)
                )
                print(f"  Available employees: {len(available_employees)}")
                if not available_employees:
                    print("  ⚠️ WARNING: No available employees found!")
                else:
                    print(f"  ✅ Found {len(available_employees)} available employees")

                    # Show first few employee details
                    print("  First few employees:")
                    for i, emp in enumerate(available_employees[:3]):
                        print(
                            f"  Employee {i + 1}: ID={emp.id}, Name={getattr(emp, 'name', 'N/A')}"
                        )

            print("\n5. TESTING ASSIGNMENT DIRECTLY")
            print("=" * 50)

            # Test assigning employees to shifts
            with trace_section("Testing direct assignment"):
                if needed_shift_instances and available_employees:
                    # Group shifts by type
                    shifts_by_type = {}
                    for shift in needed_shift_instances:
                        shift_type = shift.get("shift_type")
                        if not shift_type:
                            # Extract from template
                            template = shift.get("shift_template")
                            if template:
                                shift_type = getattr(template, "shift_type", "UNKNOWN")

                        if shift_type not in shifts_by_type:
                            shifts_by_type[shift_type] = []
                        shifts_by_type[shift_type].append(shift)

                    print(
                        f"  Shifts grouped by type: {[(t, len(s)) for t, s in shifts_by_type.items()]}"
                    )

                    # Test assignment for each type
                    print("\n  Testing assignment by type:")
                    for shift_type, type_shifts in shifts_by_type.items():
                        with trace_section(f"Assigning {shift_type} shifts", indent=2):
                            # Directly use the assign_employees_by_type method
                            assignments = (
                                generator.distribution_manager.assign_employees_by_type(
                                    test_date,
                                    type_shifts,
                                    available_employees,
                                    shift_type,
                                )
                            )

                            if assignments:
                                print(
                                    f"    ✅ Created {len(assignments)} {shift_type} assignments"
                                )
                                # Show first assignment
                                if assignments:
                                    print("    First assignment:")
                                    pretty_print_json(assignments[0], indent=6)
                            else:
                                print(
                                    f"    ⚠️ No assignments created for {shift_type} shifts"
                                )

            print("\n6. TESTING COMPLETE DISTRIBUTION PROCESS")
            print("=" * 50)

            with trace_section("Testing complete distribution"):
                # Test the complete distribution process
                assignments = (
                    generator.distribution_manager.assign_employees_with_distribution(
                        test_date, needed_shift_instances, shift_needs
                    )
                )

                if assignments:
                    print(f"  ✅ Distribution created {len(assignments)} assignments")
                    # Show first few assignments
                    print("  First few assignments:")
                    for i, assignment in enumerate(assignments[:3]):
                        print(f"  Assignment {i + 1}:")
                        pretty_print_json(assignment, indent=4)
                else:
                    print("  ⚠️ Distribution process created no assignments")

            print("\nTracing complete. Analyzing findings...")
            print("=" * 50)

            # Summarize findings
            shifts_by_type = {}  # Initialize this variable to fix the error
            issues = []
            if not shift_needs:
                issues.append("No coverage needs were determined")

                # Add additional coverage check
                print("\nDiagnosing coverage issue:")
                print("-" * 30)
                with trace_section("Testing specific date coverage"):
                    # Check if any coverage records exist
                    coverage_records = generator.resources.coverage
                    print(f"Total coverage records: {len(coverage_records)}")

                    # Check if any apply to our test date
                    applicable_records = []
                    for coverage in coverage_records:
                        if hasattr(coverage, "day_index"):
                            weekday = test_date.weekday()
                            day_index = coverage.day_index
                            print(
                                f"Testing coverage day_index {day_index} against test date weekday {weekday}"
                            )
                            if (
                                day_index - 1
                            ) % 7 == weekday:  # Assuming day_index uses 0=Sunday format
                                applicable_records.append(coverage)

                    print(
                        f"Applicable coverage records for {test_date}: {len(applicable_records)}"
                    )
                    for i, coverage in enumerate(applicable_records[:3]):
                        print(
                            f"Coverage {i + 1}: ID={coverage.id}, day_index={coverage.day_index}"
                        )

            if not date_shifts:
                issues.append("No shift instances were created")

                # Add additional shift template check
                print("\nDiagnosing shift template issue:")
                print("-" * 30)
                with trace_section("Testing shift active_days"):
                    # Check if shift templates exist
                    shift_templates = generator.resources.shifts
                    print(f"Total shift templates: {len(shift_templates)}")

                    # Check shift active_days
                    applicable_shifts = []
                    weekday = test_date.weekday()
                    print(f"Test date {test_date} is weekday {weekday}")

                    for shift in shift_templates:
                        active_days = getattr(shift, "active_days", None)
                        print(f"Shift {shift.id} active_days: {active_days}")

                        if active_days:
                            # Parse active_days into a list of integers
                            try:
                                if isinstance(active_days, str):
                                    active_days_list = []
                                    # Try parsing JSON first
                                    try:
                                        active_days_list = json.loads(active_days)
                                    except json.JSONDecodeError:
                                        # Try comma-separated format
                                        active_days_list = [
                                            int(d.strip())
                                            for d in active_days.split(",")
                                            if d.strip()
                                        ]

                                    print(f"  Parsed active_days: {active_days_list}")
                                    if weekday in active_days_list:
                                        applicable_shifts.append(shift)
                                        print(
                                            f"  ✅ Shift {shift.id} is applicable for weekday {weekday}"
                                        )
                                    else:
                                        print(
                                            f"  ❌ Shift {shift.id} is NOT applicable for weekday {weekday}"
                                        )
                                elif isinstance(active_days, (list, set)):
                                    if weekday in active_days:
                                        applicable_shifts.append(shift)
                                        print(
                                            f"  ✅ Shift {shift.id} is applicable for weekday {weekday}"
                                        )
                                    else:
                                        print(
                                            f"  ❌ Shift {shift.id} is NOT applicable for weekday {weekday}"
                                        )
                            except Exception as e:
                                print(
                                    f"  ⚠️ Error parsing active_days for shift {shift.id}: {e}"
                                )

                    print(
                        f"Applicable shift templates for {test_date}: {len(applicable_shifts)}"
                    )

            if not available_employees:
                issues.append("No available employees were found")

                # Add additional employee check
                print("\nDiagnosing employee availability issue:")
                print("-" * 30)
                with trace_section("Testing employee availability"):
                    # Check if employees exist
                    employees = generator.resources.employees
                    print(f"Total employees: {len(employees)}")

                    # Check how many are active
                    active_employees = [
                        e for e in employees if getattr(e, "is_active", True)
                    ]
                    print(f"Active employees: {len(active_employees)}")

                    # Check if any employees are on leave
                    if generator.availability_checker:
                        on_leave = []
                        for emp in active_employees:
                            if generator.availability_checker.is_employee_on_leave(
                                emp.id, test_date
                            ):
                                on_leave.append(emp.id)

                        print(f"Employees on leave: {len(on_leave)}")
                        if on_leave:
                            print(f"  IDs on leave: {on_leave[:5]}...")
                    else:
                        print("No availability checker available")

            if not shifts_by_type:
                issues.append("No shifts were grouped by type")

            if issues:
                print("\nIdentified issues:")
                for i, issue in enumerate(issues):
                    print(f"{i + 1}. {issue}")
            else:
                print("\nNo fundamental issues identified in the process steps.")
                print("The issue appears to be in the final assignment decision logic.")

            print("\nSuggested next steps:")
            if not issues:
                print(
                    "1. Check the constraint checker to see if it's rejecting all possible assignments"
                )
                print(
                    "2. Try temporarily disabling constraint checks in the distribution manager"
                )
                print(
                    "3. Add more detailed logging in the assign_employees_by_type method"
                )
            else:
                for i, issue in enumerate(issues):
                    print(f"{i + 1}. Fix the '{issue}' problem")

        except Exception as e:
            print(f"❌ Error during scheduler tracing: {str(e)}")
            import traceback

            traceback.print_exc()


if __name__ == "__main__":
    main()
