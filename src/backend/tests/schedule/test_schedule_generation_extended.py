#!/usr/bin/env python
"""
Extended tests for schedule generation with comprehensive validation and edge cases.
This test suite extends the basic schedule generation tests with more detailed validation,
edge cases, and performance metrics.
"""

import sys
import logging
import time
from datetime import datetime, timedelta

from app import create_app
from models.fixed_shift import ShiftTemplate
from models.employee import Employee, EmployeeGroup
from models.settings import Settings
from services.scheduler.generator import ScheduleGenerator
from services.scheduler.validator import ScheduleValidator, ScheduleConfig
from models import db

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def get_next_monday():
    """Get the date of the next Monday."""
    today = datetime.now().date()
    days_ahead = (0 - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7  # If today is Monday, get next Monday
    return today + timedelta(days=days_ahead)


def create_test_data(app_context):
    """Create test data for schedule generation."""
    # Create store settings
    settings = Settings(
        store_opening="08:00",
        store_closing="20:00",
        min_break_duration=60,
        require_keyholder=True,
        min_rest_between_shifts=11,
        max_weekly_hours=40,
    )
    db.session.add(settings)

    # Create shifts
    shifts = [
        ShiftTemplate(
            start_time="08:00",
            end_time="16:00",
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
        ),
        ShiftTemplate(
            start_time="10:00",
            end_time="18:00",
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
        ),
        ShiftTemplate(
            start_time="12:00",
            end_time="20:00",
            duration_hours=8,
            requires_break=True,
            active_days=[0, 1, 2, 3, 4, 5],  # Mon-Sat
        ),
    ]
    for shift in shifts:
        db.session.add(shift)

    # Create employees
    employees = [
        Employee(
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            contracted_hours=40,
            employee_group=EmployeeGroup.VZ,
            is_active=True,
            is_keyholder=True,
        ),
        Employee(
            first_name="Jane",
            last_name="Smith",
            email="jane.smith@example.com",
            contracted_hours=30,
            employee_group=EmployeeGroup.TZ,
            is_active=True,
            is_keyholder=False,
        ),
        Employee(
            first_name="Bob",
            last_name="Johnson",
            email="bob.johnson@example.com",
            contracted_hours=20,
            employee_group=EmployeeGroup.GFB,
            is_active=True,
            is_keyholder=False,
        ),
        Employee(
            first_name="Alice",
            last_name="Williams",
            email="alice.williams@example.com",
            contracted_hours=40,
            employee_group=EmployeeGroup.TL,
            is_active=True,
            is_keyholder=True,
        ),
    ]
    for employee in employees:
        db.session.add(employee)

    db.session.commit()
    return settings, shifts, employees


def test_basic_schedule_generation():
    """Test basic schedule generation for a week."""
    logger.info("=== BASIC SCHEDULE GENERATION TEST ===")

    app = create_app()
    with app.app_context():
        # Create test data
        settings, shifts, employees = create_test_data(app.app_context)

        # Calculate dates for next week (Monday to Sunday)
        start_date = get_next_monday()
        end_date = start_date + timedelta(days=6)

        logger.info(
            f"Testing schedule generation for period: {start_date} to {end_date}"
        )

        # Initialize schedule generator
        generator = ScheduleGenerator()

        # Generate schedules
        start_time = time.time()
        result = generator.generate_schedule(
            start_date, end_date, create_empty_schedules=True
        )
        end_time = time.time()

        # Get the schedules from the result
        schedules = result.get("schedule", [])
        warnings = result.get("warnings", [])
        errors = result.get("errors", [])

        # Log results
        total_schedules = len(schedules)
        empty_schedules = len(
            [s for s in schedules if s.get("is_empty", False) or not s.get("shift_id")]
        )
        assigned_schedules = total_schedules - empty_schedules

        logger.info("Schedule generation completed")
        logger.info(f"Generation time: {end_time - start_time:.2f} seconds")
        logger.info(f"Total schedules: {total_schedules}")
        logger.info(f"Assigned schedules: {assigned_schedules}")
        logger.info(f"Empty schedules: {empty_schedules}")
        logger.info(f"Warnings: {len(warnings)}")
        logger.info(f"Errors: {len(errors)}")

        # Validate the result structure
        assert "schedule" in result, "Result should contain 'schedule' key"
        assert isinstance(schedules, list), "Schedules should be a list"

        return result


def test_edge_case_no_employees():
    """Test schedule generation with no active employees."""
    logger.info("=== EDGE CASE: NO EMPLOYEES TEST ===")

    app = create_app()
    with app.app_context():
        # Create test data
        settings, shifts, employees = create_test_data(app.app_context)

        # Save current employee active status
        original_status = {emp.id: emp.is_active for emp in employees}

        try:
            # Set all employees to inactive
            for emp in employees:
                emp.is_active = False
            db.session.commit()

            # Calculate dates for next week
            start_date = get_next_monday()
            end_date = start_date + timedelta(days=6)

            logger.info(
                f"Testing schedule generation with no active employees: {start_date} to {end_date}"
            )

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Generate schedules
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )

            # Get the schedules from the result
            schedules = result.get("schedule", [])
            warnings = result.get("warnings", [])
            errors = result.get("errors", [])

            # Log results
            logger.info(f"Total schedules: {len(schedules)}")
            logger.info(f"Warnings: {len(warnings)}")
            logger.info(f"Errors: {len(errors)}")

            # Validate the result
            assert len(schedules) == 0, (
                "No schedules should be generated with no active employees"
            )

            return result
        finally:
            # Restore original employee active status
            for emp in employees:
                emp.is_active = original_status.get(emp.id, True)
            db.session.commit()


def test_edge_case_no_shifts():
    """Test schedule generation with no active shifts."""
    logger.info("=== EDGE CASE: NO SHIFTS TEST ===")

    app = create_app()
    with app.app_context():
        # Create test data
        settings, shifts, employees = create_test_data(app.app_context)

        # Save current shift active status (via active_days)
        original_active_days = {shift.id: shift.active_days for shift in shifts}

        try:
            # Set all shifts to have no active days
            for shift in shifts:
                shift.active_days = []
            db.session.commit()

            # Calculate dates for next week
            start_date = get_next_monday()
            end_date = start_date + timedelta(days=6)

            logger.info(
                f"Testing schedule generation with no active shifts: {start_date} to {end_date}"
            )

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Generate schedules
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )

            # Get the schedules from the result
            schedules = result.get("schedule", [])
            warnings = result.get("warnings", [])
            errors = result.get("errors", [])

            # Log results
            logger.info(f"Total schedules: {len(schedules)}")
            logger.info(f"Warnings: {len(warnings)}")
            logger.info(f"Errors: {len(errors)}")

            # Validate the result - should have empty schedules for all employees
            empty_schedules = len(
                [
                    s
                    for s in schedules
                    if s.get("is_empty", False) or not s.get("shift_id")
                ]
            )
            assert empty_schedules == len(schedules), (
                "All schedules should be empty with no active shifts"
            )

            return result
        finally:
            # Restore original shift active days
            for shift in shifts:
                shift.active_days = original_active_days.get(shift.id, [])
            db.session.commit()


def test_schedule_with_specific_constraints():
    """Test schedule generation with specific constraints like keyholders and weekly limits."""
    logger.info("=== SCHEDULE WITH SPECIFIC CONSTRAINTS TEST ===")

    app = create_app()
    with app.app_context():
        # Create test data
        settings, shifts, employees = create_test_data(app.app_context)

        # Save original settings
        original_settings = {
            "require_keyholder": settings.require_keyholder,
            "max_weekly_hours": settings.max_weekly_hours,
            "min_rest_between_shifts": settings.min_rest_between_shifts,
        }

        try:
            # Update settings with stricter constraints
            settings.require_keyholder = True
            settings.max_weekly_hours = 30  # Stricter weekly hour limit
            settings.min_rest_between_shifts = 12  # Longer rest period
            db.session.commit()

            # Calculate dates for next week
            start_date = get_next_monday()
            end_date = start_date + timedelta(days=6)

            logger.info(
                f"Testing schedule generation with constraints: {start_date} to {end_date}"
            )

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Generate schedules
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )

            # Get the schedules from the result
            schedules = result.get("schedule", [])
            warnings = result.get("warnings", [])
            errors = result.get("errors", [])

            # Log results
            total_schedules = len(schedules)
            empty_schedules = len(
                [
                    s
                    for s in schedules
                    if s.get("is_empty", False) or not s.get("shift_id")
                ]
            )
            assigned_schedules = total_schedules - empty_schedules

            logger.info("Schedule generation with constraints completed")
            logger.info(f"Total schedules: {total_schedules}")
            logger.info(f"Assigned schedules: {assigned_schedules}")
            logger.info(f"Empty schedules: {empty_schedules}")
            logger.info(f"Warnings: {len(warnings)}")
            logger.info(f"Errors: {len(errors)}")

            # Check for keyholder constraint warnings
            keyholder_warnings = [w for w in warnings if "keyholder" in str(w).lower()]
            logger.info(f"Keyholder-related warnings: {len(keyholder_warnings)}")

            # Check for hours constraint warnings
            hours_warnings = [w for w in warnings if "hours" in str(w).lower()]
            logger.info(f"Hours-related warnings: {len(hours_warnings)}")

            # Check for rest time constraint warnings
            rest_warnings = [w for w in warnings if "rest" in str(w).lower()]
            logger.info(f"Rest time-related warnings: {len(rest_warnings)}")

            return result
        finally:
            # Restore original settings
            for key, value in original_settings.items():
                setattr(settings, key, value)
            db.session.commit()


def test_schedule_validation():
    """Test the schedule validation functionality separately."""
    logger.info("=== SCHEDULE VALIDATION TEST ===")

    app = create_app()
    with app.app_context():
        # Create test data
        settings, shifts, employees = create_test_data(app.app_context)

        # Calculate dates for next week
        start_date = get_next_monday()
        end_date = start_date + timedelta(days=6)

        logger.info(
            f"Testing schedule validation for period: {start_date} to {end_date}"
        )

        # Generate a schedule first
        generator = ScheduleGenerator()
        result = generator.generate_schedule(
            start_date, end_date, create_empty_schedules=True
        )

        # Get the schedules from the result
        schedules = result.get("schedule", [])

        # Create a validator and config
        config = ScheduleConfig.from_settings(settings)
        validator = ScheduleValidator(generator.resources)

        # Validate the schedule
        validation_errors = validator.validate(schedules, config)

        # Log validation results
        logger.info(
            f"Validation complete with {len(validation_errors)} errors/warnings"
        )
        for i, error in enumerate(validation_errors[:10]):  # Show first 10
            logger.info(f"  {i + 1}. {error.severity}: {error.message}")

        if len(validation_errors) > 10:
            logger.info(f"  ... and {len(validation_errors) - 10} more")

        return validation_errors


def test_performance_scaling():
    """Test schedule generation performance with different date ranges."""
    logger.info("=== PERFORMANCE SCALING TEST ===")

    app = create_app()
    with app.app_context():
        # Create test data
        settings, shifts, employees = create_test_data(app.app_context)

        # Test with different date ranges
        date_ranges = [(1, "1 day"), (7, "1 week"), (14, "2 weeks"), (30, "1 month")]

        results = []

        for days, label in date_ranges:
            start_date = get_next_monday()
            end_date = start_date + timedelta(days=days - 1)

            logger.info(f"Testing performance for {label} ({start_date} to {end_date})")

            # Initialize schedule generator
            generator = ScheduleGenerator()

            # Generate schedules and measure time
            start_time = time.time()
            result = generator.generate_schedule(
                start_date, end_date, create_empty_schedules=True
            )
            end_time = time.time()

            # Calculate metrics
            generation_time = end_time - start_time
            schedules = result.get("schedule", [])
            schedules_per_second = (
                len(schedules) / generation_time if generation_time > 0 else 0
            )

            logger.info(f"  Generation time: {generation_time:.2f} seconds")
            logger.info(f"  Total schedules: {len(schedules)}")
            logger.info(f"  Schedules per second: {schedules_per_second:.2f}")

            results.append(
                {
                    "range": label,
                    "days": days,
                    "time": generation_time,
                    "schedules": len(schedules),
                    "schedules_per_second": schedules_per_second,
                }
            )

        # Compare results
        logger.info("Performance comparison:")
        for result in results:
            logger.info(
                f"  {result['range']}: {result['time']:.2f}s for {result['schedules']} schedules ({result['schedules_per_second']:.2f} schedules/s)"
            )

        return results


def run_all_tests():
    """Run all schedule generation tests."""
    logger.info("Starting extended schedule generation tests...")

    tests = [
        ("Basic Schedule Generation", test_basic_schedule_generation),
        ("Edge Case: No Employees", test_edge_case_no_employees),
        ("Edge Case: No Shifts", test_edge_case_no_shifts),
        ("Schedule with Specific Constraints", test_schedule_with_specific_constraints),
        ("Schedule Validation", test_schedule_validation),
        ("Performance Scaling", test_performance_scaling),
    ]

    results = {}

    for name, test_func in tests:
        logger.info(f"\nRunning test: {name}")
        try:
            result = test_func()
            results[name] = {"status": "Success", "result": result}
            logger.info(f"Test '{name}' completed successfully")
        except Exception as e:
            logger.error(f"Test '{name}' failed: {str(e)}")
            results[name] = {"status": "Failed", "error": str(e)}

    # Print summary
    logger.info("\n=== TEST SUMMARY ===")
    for name, result in results.items():
        status = result["status"]
        logger.info(f"{name}: {status}")

    return results


if __name__ == "__main__":
    run_all_tests()
