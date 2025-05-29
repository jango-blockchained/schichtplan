#!/usr/bin/env python
"""
Scheduler Companion Utility
===========================

A comprehensive tool for diagnosing and fixing issues with the scheduling system.
This utility consolidates all the insights and fixes we've developed.

Features:
- Database connection checking
- Resource validation (employees, shifts, coverage)
- Shift template active_days repair
- Manual assignment creation for testing
- Scheduler execution testing
- Diagnostic reporting
"""

import os
import sys
import json
import sqlite3
import argparse
import traceback
from datetime import date, datetime, timedelta, time
from typing import List, Any, Optional, Tuple
import logging  # Import logging module

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
root_dir = os.path.abspath(os.path.join(backend_dir, "../.."))
sys.path.insert(0, root_dir)

logging.basicConfig(level=logging.DEBUG)  # Set root logger to DEBUG


# Create mock versions of the database models for direct usage
class MockEmployee:
    """Mock implementation of Employee model"""

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class MockShiftTemplate:
    """Mock implementation of ShiftTemplate model"""

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class MockCoverage:
    """Mock implementation of Coverage model"""

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


# Database helper functions
def get_connection(db_path: str) -> Tuple[sqlite3.Connection, sqlite3.Cursor]:
    """Connect to the database and return connection and cursor"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # This enables column access by name
    cursor = conn.cursor()
    return conn, cursor


def check_database(db_path: str) -> bool:
    """Check if the database exists and has the required tables"""
    if not os.path.exists(db_path):
        print(f"Database file not found at {db_path}")
        return False

    try:
        conn, cursor = get_connection(db_path)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]

        required_tables = ["employees", "shifts", "coverage", "schedules"]
        missing_tables = [table for table in required_tables if table not in tables]

        if missing_tables:
            print(f"Missing required tables: {', '.join(missing_tables)}")
            return False

        # Count records in each table
        counts = {}
        for table in required_tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cursor.fetchone()[0]

        print("Database contains:")
        for table, count in counts.items():
            print(f"- {table}: {count} records")

        conn.close()
        return True

    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False


def check_active_days(db_path: str) -> bool:
    """Check if shift templates have valid active_days"""
    try:
        conn, cursor = get_connection(db_path)

        # Get shift templates with missing or empty active_days
        cursor.execute("""
            SELECT id, active_days 
            FROM shifts 
            WHERE active_days IS NULL OR active_days = '' OR active_days = '[]'
        """)
        problematic_shifts = cursor.fetchall()

        if problematic_shifts:
            print(
                f"Found {len(problematic_shifts)} shifts with missing or empty active_days."
            )
            return False
        else:
            print("All shift templates have active_days configured.")
            return True

    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False
    finally:
        conn.close()


def fix_active_days(db_path: str) -> bool:
    """Fix shift templates with missing or empty active_days"""
    try:
        conn, cursor = get_connection(db_path)

        # Get shift templates with missing or empty active_days
        cursor.execute("""
            SELECT id, active_days 
            FROM shifts 
            WHERE active_days IS NULL OR active_days = '' OR active_days = '[]'
        """)
        problematic_shifts = cursor.fetchall()

        if not problematic_shifts:
            print("No shifts need fixing - all have active_days configured.")
            return True

        print(f"Fixing {len(problematic_shifts)} shift templates...")

        # Update each problematic shift
        fixed_count = 0
        for shift in problematic_shifts:
            shift_id = shift[0]
            # Set to all days of the week (0-6)
            new_active_days = json.dumps([0, 1, 2, 3, 4, 5, 6])

            cursor.execute(
                "UPDATE shifts SET active_days = ? WHERE id = ?",
                (new_active_days, shift_id),
            )
            fixed_count += 1
            print(f"  - Fixed Shift {shift_id}: active_days set to {new_active_days}")

        if fixed_count > 0:
            conn.commit()
            print(f"Successfully fixed {fixed_count} shift templates.")
            return True

        return False

    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False
    finally:
        conn.close()


def create_test_assignments(db_path: str, test_date: date) -> bool:
    """Create test assignments for a specific date"""
    try:
        conn, cursor = get_connection(db_path)

        # Check if employees and shifts exist
        cursor.execute("SELECT COUNT(*) FROM employees WHERE is_active = 1")
        employee_count = cursor.fetchone()[0]
        if employee_count == 0:
            print("No active employees found. Cannot create assignments.")
            return False

        cursor.execute("SELECT COUNT(*) FROM shifts")
        shift_count = cursor.fetchone()[0]
        if shift_count == 0:
            print("No shifts found. Cannot create assignments.")
            return False

        # Get all active employees
        cursor.execute("SELECT id FROM employees WHERE is_active = 1 LIMIT 10")
        employees = [row[0] for row in cursor.fetchall()]

        # Get all shifts
        cursor.execute("SELECT id FROM shifts")
        shifts = [row[0] for row in cursor.fetchall()]

        # Delete any existing assignments for this date (to avoid duplicates)
        print(f"Deleting existing assignments for {test_date}...")
        cursor.execute("DELETE FROM schedules WHERE date = ?", (test_date.isoformat(),))
        deleted_count = cursor.rowcount
        print(f"Deleted {deleted_count} existing assignments")

        # Create assignments - distribute employees across shifts
        assignments_created = 0

        # Get highest existing ID to avoid conflicts
        cursor.execute("SELECT COALESCE(MAX(id), 0) FROM schedules")
        max_id = cursor.fetchone()[0]
        next_id = max_id + 1

        # For each shift, assign 2-3 employees
        for i, shift_id in enumerate(shifts):
            # Calculate how many employees to assign to this shift (2-3)
            employees_to_assign = min(3, len(employees))

            # Get the employees for this shift (rotating through the list)
            shift_employees = employees[:employees_to_assign]

            # Rotate the employee list for the next shift
            employees = (
                employees[employees_to_assign:] + employees[:employees_to_assign]
            )

            for employee_id in shift_employees:
                try:
                    cursor.execute(
                        """
                        INSERT INTO schedules (
                            id, employee_id, shift_id, date, status, created_at, updated_at, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            next_id,
                            employee_id,
                            shift_id,
                            test_date.isoformat(),
                            "PENDING",
                            datetime.now().isoformat(),
                            datetime.now().isoformat(),
                            1,
                        ),
                    )
                    next_id += 1
                    assignments_created += 1
                    print(
                        f"Created assignment: Employee {employee_id} to Shift {shift_id}"
                    )
                except sqlite3.Error as e:
                    print(f"Error creating assignment: {e}")

        # Commit the transaction
        if assignments_created > 0:
            conn.commit()
            print(
                f"Successfully created {assignments_created} test assignments for {test_date}"
            )

            # Get assignment distribution by shift type
            cursor.execute(
                """
                SELECT shifts.shift_type, COUNT(*) as count
                FROM schedules 
                JOIN shifts ON schedules.shift_id = shifts.id
                WHERE schedules.date = ?
                GROUP BY shifts.shift_type
                """,
                (test_date.isoformat(),),
            )
            distribution = cursor.fetchall()

            if distribution:
                print("Assignment distribution by shift type:")
                for shift_type, count in distribution:
                    print(f"  {shift_type}: {count} assignments")

            return True
        else:
            conn.rollback()
            print("No assignments were created")
            return False

    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
        return False
    finally:
        conn.close()


def load_resources_from_db(db_path: str) -> Tuple[List[Any], List[Any], List[Any]]:
    """Load resources from the database"""
    try:
        conn, cursor = get_connection(db_path)

        # Load employees
        cursor.execute("""
            SELECT id, employee_id, first_name, last_name, contracted_hours, 
                   employee_group, is_keyholder, is_active
            FROM employees
            WHERE is_active = 1
        """)
        employees = []
        for row in cursor.fetchall():
            emp = MockEmployee(
                id=row["id"],
                employee_id=row["employee_id"],
                first_name=row["first_name"],
                last_name=row["last_name"],
                contracted_hours=row["contracted_hours"],
                employee_group=row["employee_group"],
                is_keyholder=bool(row["is_keyholder"]),
                is_active=bool(row["is_active"]),
                name=f"{row['first_name']} {row['last_name']}",
            )
            employees.append(emp)

        # Load shifts
        cursor.execute("""
            SELECT id, start_time, end_time, duration_hours, 
                   shift_type, active_days, shift_type_id
            FROM shifts
        """)
        shifts = []
        for row in cursor.fetchall():
            # Parse active_days
            days_list = None
            if row["active_days"]:
                try:
                    days_list = json.loads(row["active_days"])
                except (json.JSONDecodeError, ValueError):
                    days_list = []

            shift = MockShiftTemplate(
                id=row["id"],
                start_time=row["start_time"],
                end_time=row["end_time"],
                duration_hours=row["duration_hours"],
                shift_type=row["shift_type"],
                shift_type_id=row["shift_type_id"],
                active_days=days_list,
            )
            shifts.append(shift)

        # Load coverage
        cursor.execute("""
            SELECT id, day_index, start_time, end_time, 
                   min_employees, max_employees
            FROM coverage
        """)
        coverage_records = []
        for row in cursor.fetchall():
            coverage = MockCoverage(
                id=row["id"],
                day_index=row["day_index"],
                start_time=row["start_time"],
                end_time=row["end_time"],
                min_employees=row["min_employees"],
                max_employees=row["max_employees"],
            )
            coverage_records.append(coverage)

        return employees, shifts, coverage_records

    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return [], [], []
    finally:
        conn.close()


def test_scheduler_components(db_path: str, test_date: date) -> None:
    """Test scheduler components directly"""
    try:
        # Load resources
        print("\nLoading resources from database...")
        employees, shifts, coverage = load_resources_from_db(db_path)

        print(f"Loaded {len(employees)} employees")
        print(f"Loaded {len(shifts)} shifts")
        print(f"Loaded {len(coverage)} coverage records")

        # Import scheduler components first to get types
        print("\nInitializing scheduler components...")
        from src.backend.services.scheduler.generator import ScheduleGenerator
        from src.backend.services.scheduler.resources import ScheduleResources
        from typing import Any

        # Configure logging for scheduler components
        logging.getLogger("schedule").setLevel(logging.DEBUG)
        logging.getLogger("app").setLevel(logging.DEBUG)
        logging.getLogger("error").setLevel(logging.DEBUG)

        # Create custom resource container that inherits from ScheduleResources
        class CustomScheduleResources(ScheduleResources):
            def __init__(
                self, employees, shifts, coverage, logger=None
            ):  # Add logger parameter
                self.employees = employees
                self.shifts = shifts
                self.coverage = coverage
                self.settings = {}
                self.availabilities = []
                self.resources_loaded = True
                self.verification_passed = True
                self.logger = logger or logging.getLogger(__name__)  # Store logger
                self.coverage = coverage
                self.settings = {}
                self.availabilities = []
                self.resources_loaded = True
                self.verification_passed = True

            def load(self):
                """No-op implementation"""
                pass

            def verify_loaded_resources(self):
                """Always return True for testing"""
                return True

            def get_employee(self, employee_id):
                """Find employee by ID"""
                for employee in self.employees:
                    if employee.id == employee_id:
                        return employee
                return None

            def get_shift(self, shift_id):
                """Find shift by ID"""
                for shift in self.shifts:
                    if shift.id == shift_id:
                        return shift
                return None

            def is_employee_on_leave(self, employee_id, date_to_check):
                """Mock implementation - no employees are on leave"""
                return False

            def is_employee_available(self, employee_id, date_to_check, shift):
                """Mock implementation - check availability based on mock data"""
                # Add logging for input parameters
                self.logger.debug(
                    f"[MockResources] is_employee_available called for employee_id={employee_id}, date={date_to_check}, shift_type={getattr(shift, 'shift_type', 'N/A')}, shift_time={getattr(shift, 'start_time', 'N/A')}-{getattr(shift, 'end_time', 'N/A')}"
                )

                day_of_week = date_to_check.weekday()

                # Convert shift times to comparable format (e.g., total minutes from midnight)
                # Assuming shift start/end times are strings like 'HH:MM'
                try:
                    shift_start_minutes = int(
                        shift.start_time.split(":")[0]
                    ) * 60 + int(shift.start_time.split(":")[1])
                    shift_end_minutes = int(shift.end_time.split(":")[0]) * 60 + int(
                        shift.end_time.split(":")[1]
                    )
                except AttributeError:
                    self.logger.error(
                        f"[MockResources] AttributeError parsing shift times: {getattr(shift, 'start_time', 'N/A')}-{getattr(shift, 'end_time', 'N/A')}"
                    )
                    return False, "ERROR: Shift time parsing failed"

                # Check mock availabilities
                for avail in self.availabilities:
                    # Ensure the availability record has the necessary keys/attributes
                    if not all(
                        key in avail
                        for key in [
                            "employee_id",
                            "day_of_week",
                            "start_time",
                            "end_time",
                        ]
                    ):
                        self.logger.warning(
                            f"[MockResources] Skipping invalid availability record (missing keys): {avail}"
                        )
                        continue  # Skip malformed availability records

                    if (
                        avail["employee_id"] == employee_id
                        and avail["day_of_week"] == day_of_week
                    ):
                        self.logger.debug(
                            f"[MockResources]   Processing availability record: {avail}"
                        )  # Log availability record before try block
                        try:
                            # Add detailed logging for availability data and parsed times *before* comparison
                            self.logger.debug(
                                f"[MockResources]   Checking availability record details: start={avail['start_time']}, end={avail['end_time']}, type={avail.get('availability_type', 'AVAILABLE')}"
                            )

                            avail_start_minutes = int(
                                avail["start_time"].split(":")[0]
                            ) * 60 + int(avail["start_time"].split(":")[1])
                            avail_end_minutes = int(
                                avail["end_time"].split(":")[0]
                            ) * 60 + int(avail["end_time"].split(":")[1])
                            avail_type = avail.get("availability_type", "AVAILABLE")

                            # Add detailed logging for parsed times
                            self.logger.debug(
                                f"[MockResources]   Parsed availability times: {avail_start_minutes}-{avail_end_minutes} min, Type: {avail_type}"
                            )

                            # Add detailed logging for comparison values
                            self.logger.debug(
                                f"[MockResources]   Comparing shift {shift.start_time}-{shift.end_time} ({shift_start_minutes}-{shift_end_minutes} min) with availability {avail['start_time']}-{avail['end_time']} ({avail_start_minutes}-{avail_end_minutes} min)"
                            )

                            # Check for overlap between shift time and availability time
                            # An overlap exists if the shift starts before the availability ends AND the shift ends after the availability starts
                            # Explicitly cast to int before comparison to rule out subtle type issues
                            shift_start_minutes_int = int(shift_start_minutes)
                            shift_end_minutes_int = int(shift_end_minutes)
                            avail_start_minutes_int = int(avail_start_minutes)
                            avail_end_minutes_int = int(avail_end_minutes)

                            # Check for overlap: two intervals [a, b) and [c, d) overlap if a < d and c < b
                            if (
                                shift_start_minutes_int < avail_end_minutes_int
                                and shift_end_minutes_int > avail_start_minutes_int
                            ):
                                self.logger.debug(
                                    f"[MockResources]   Standard interval overlap found! Employee {employee_id} is {avail_type}"
                                )
                                return (
                                    True,
                                    avail_type,
                                )  # Found overlapping availability
                        except (ValueError, TypeError, KeyError) as e:
                            self.logger.error(
                                f"[MockResources] Error processing availability times for record {avail}: {e}"
                            )  # Log the error and the record
                            continue  # Skip this availability record but continue checking others

                # If no overlapping availability is found after checking all records for the employee/day
                return False, "UNAVAILABLE"  # No availability found for this shift/date

            def get_employee_availability(
                self, employee_id: int, day_of_week: int
            ) -> List[Any]:
                """Mock implementation: Get availability for a specific day of the week.
                Returns records matching employee_id and day_of_week.
                """
                # Add logging for input parameters
                self.logger.debug(
                    f"[MockResources] get_employee_availability called for employee_id={employee_id}, day_of_week={day_of_week}"
                )

                # Filter self.availabilities based on employee_id and day_of_week
                # Ensure consistent attribute access (using get for safety or checking hasattr)
                matching_availabilities = [
                    avail
                    for avail in self.availabilities
                    if avail.get("employee_id") == employee_id
                    and avail.get("day_of_week") == day_of_week
                ]
                # Add logging for returned data (careful not to log too much)
                # logging.debug(f"[MockResources] get_employee_availability returning {len(matching_availabilities)} records") # Avoid logging actual data yet
                # Let's log a summary instead
                matching_availabilities = [
                    avail
                    for avail in self.availabilities
                    if avail.get("employee_id") == employee_id
                    and avail.get("day_of_week") == day_of_week
                ]
                self.logger.debug(
                    f"[MockResources] get_employee_availability returning {len(matching_availabilities)} records for employee {employee_id} on day {day_of_week}"
                )

                return matching_availabilities

            def get_employee_preferred_shifts(self, employee_id):
                """Mock implementation - no preferred shifts"""
                return []

            def get_employee_avoided_shifts(self, employee_id):
                """Mock implementation - no avoided shifts"""
                return []

        # Create resources
        # Add some mock availability data to test get_employee_availability
        # Data format should align with what DistributionManager expects, likely including time intervals or matching shift times.
        # Adding availability for employees 1, 2, 3 across the coverage intervals for weekdays (0-4).
        # Refining mock data to align more closely with potential shift/coverage mapping
        mock_availabilities = [
            # Employee 1: Available for EARLY and MIDDLE shifts/intervals Monday-Friday
            {
                "employee_id": 1,
                "day_of_week": 0,
                "start_time": "09:00",
                "end_time": "14:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers EARLY shift",
            },
            {
                "employee_id": 1,
                "day_of_week": 0,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers MIDDLE shift",
            },
            {
                "employee_id": 1,
                "day_of_week": 1,
                "start_time": "09:00",
                "end_time": "14:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers EARLY shift",
            },
            {
                "employee_id": 1,
                "day_of_week": 1,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers MIDDLE shift",
            },
            {
                "employee_id": 1,
                "day_of_week": 2,
                "start_time": "09:00",
                "end_time": "14:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers EARLY shift",
            },
            {
                "employee_id": 1,
                "day_of_week": 2,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers MIDDLE shift",
            },
            {
                "employee_id": 1,
                "day_of_week": 3,
                "start_time": "09:00",
                "end_time": "14:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers EARLY shift",
            },
            {
                "employee_id": 1,
                "day_of_week": 3,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers MIDDLE shift",
            },
            {
                "employee_id": 1,
                "day_of_week": 4,
                "start_time": "09:00",
                "end_time": "14:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers EARLY shift",
            },
            {
                "employee_id": 1,
                "day_of_week": 4,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers MIDDLE shift",
            },
            # Employee 2: Available for MIDDLE and LATE shifts/intervals Monday-Friday
            {
                "employee_id": 2,
                "day_of_week": 0,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers MIDDLE shift",
            },
            {
                "employee_id": 2,
                "day_of_week": 0,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers LATE shift",
            },
            {
                "employee_id": 2,
                "day_of_week": 1,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers MIDDLE shift",
            },
            {
                "employee_id": 2,
                "day_of_week": 1,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers LATE shift",
            },
            {
                "employee_id": 2,
                "day_of_week": 2,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers MIDDLE shift",
            },
            {
                "employee_id": 2,
                "day_of_week": 2,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers LATE shift",
            },
            {
                "employee_id": 2,
                "day_of_week": 3,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers MIDDLE shift",
            },
            {
                "employee_id": 2,
                "day_of_week": 3,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers LATE shift",
            },
            {
                "employee_id": 2,
                "day_of_week": 4,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers MIDDLE shift",
            },
            {
                "employee_id": 2,
                "day_of_week": 4,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers LATE shift",
            },
            # Employee 3: Available for LATE shifts/intervals Monday-Friday
            {
                "employee_id": 3,
                "day_of_week": 0,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers LATE shift",
            },
            {
                "employee_id": 3,
                "day_of_week": 1,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers LATE shift",
            },
            {
                "employee_id": 3,
                "day_of_week": 2,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers LATE shift",
            },
            {
                "employee_id": 3,
                "day_of_week": 3,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers LATE shift",
            },
            {
                "employee_id": 3,
                "day_of_week": 4,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "AVAILABLE",
                "notes": "Covers LATE shift",
            },
            # Add some fixed availability for employee 4 (covers all intervals Monday-Tuesday)
            {
                "employee_id": 4,
                "day_of_week": 0,
                "start_time": "00:00",
                "end_time": "23:59",
                "availability_type": "FIXED",
            },
            {
                "employee_id": 4,
                "day_of_week": 1,
                "start_time": "00:00",
                "end_time": "23:59",
                "availability_type": "FIXED",
            },
            # Add some preferred availability for employee 5 (covers middle on Wednesday)
            {
                "employee_id": 5,
                "day_of_week": 2,
                "start_time": "11:00",
                "end_time": "16:00",
                "availability_type": "PREFERRED",
            },
            # Add some preferred availability for employee 6 (covers late on Thursday)
            {
                "employee_id": 6,
                "day_of_week": 3,
                "start_time": "15:00",
                "end_time": "20:00",
                "availability_type": "PREFERRED",
            },
        ]
        resources = CustomScheduleResources(
            employees, shifts, coverage, logger=logging.getLogger("schedule")
        )
        resources.availabilities = mock_availabilities  # Assign mock data

        print("Created custom resource container with refined mock availability data")

        # Create scheduler
        generator = ScheduleGenerator(resources=resources)
        print("Created ScheduleGenerator")

        # Test shift creation for the date
        print(f"\nTesting shift creation for {test_date}...")
        date_shifts = generator._create_date_shifts(test_date)
        if date_shifts:
            print(f"Created {len(date_shifts)} shift instances")
            print("Sample shift instances:")
            for i, shift in enumerate(date_shifts[:3]):
                print(
                    f"  {i + 1}. Shift {shift.get('shift_id')}: {shift.get('shift_type')}, {shift.get('start_time')}-{shift.get('end_time')}"
                )
        else:
            print("No shift instances created for this date!")

            # Check if any shifts are configured for this day
            weekday = test_date.weekday()
            # Use a safer approach for checking active_days that avoids SQLAlchemy operator issues
            matching_shifts = []
            for s in shifts:
                try:
                    # This handles both regular lists and SQLAlchemy column objects
                    if hasattr(s, "active_days") and s.active_days:
                        active_days = s.active_days
                        # Convert to list if it's a string representation
                        if isinstance(active_days, str):
                            try:
                                active_days = json.loads(active_days)
                            except (json.JSONDecodeError, ValueError):
                                active_days = []

                        # Now check if weekday is in the list
                        if weekday in active_days:
                            matching_shifts.append(s)
                except Exception as e:
                    print(f"Error checking shift active_days: {e}")
                    continue

            print(f"Shifts configured for weekday {weekday}: {len(matching_shifts)}")
            if matching_shifts:
                print("Sample shifts:")
                for i, shift in enumerate(matching_shifts[:3]):
                    print(
                        f"  {i + 1}. ID={shift.id}, Type={shift.shift_type}, Active days={shift.active_days}"
                    )

        # Test assignment generation for the date
        print(f"\nTesting assignment generation for {test_date}...")
        try:
            # Create a wrapper function to handle the parameter passing issues
            def test_generate_assignments():
                # Use try-except to handle possible errors in the internal method call
                try:
                    return generator._generate_assignments_for_date(test_date)
                except TypeError as e:
                    # If there's a parameter mismatch, try with the correct keyword
                    if "missing 1 required positional argument" in str(e):
                        return generator._generate_assignments_for_date(
                            current_date=test_date
                        )
                except Exception as e:
                    print(f"Error generating assignments: {e}")
                    return None

            # Call the wrapper function
            assignments = test_generate_assignments()

            if assignments:
                print(f"Generated {len(assignments)} assignments")
                print("Sample assignments:")
                for i, assignment in enumerate(assignments[:5]):
                    emp_id = assignment.get("employee_id")
                    shift_id = assignment.get("shift_id")
                    print(f"  {i + 1}. Employee {emp_id} assigned to Shift {shift_id}")
            else:
                print("No assignments were generated for this date.")

                # Try to get coverage needs for intervals to diagnose the issue
                from src.backend.services.scheduler.coverage_utils import (
                    get_required_staffing_for_interval,
                )

                # Check coverage for a typical interval
                interval_start_time = time(9, 0)  # 9:00 AM
                needs = get_required_staffing_for_interval(
                    target_date=test_date,
                    interval_start_time=interval_start_time,
                    resources=resources,
                    interval_duration_minutes=15,
                )

                print(f"\nCoverage needs for interval {interval_start_time}:")
                print(f"  min_employees: {needs.get('min_employees', 0)}")
                print(f"  employee_types: {needs.get('employee_types', set())}")
                print(f"  requires_keyholder: {needs.get('requires_keyholder', False)}")

                # Check for day-specific coverage
                day_index = test_date.weekday()
                matching_coverage = [
                    cov
                    for cov in coverage
                    if hasattr(cov, "day_index") and cov.day_index == day_index
                ]
                print(f"Coverage records for day {day_index}: {len(matching_coverage)}")
                if matching_coverage:
                    print("Sample coverage:")
                    for i, cov in enumerate(matching_coverage[:3]):
                        print(
                            f"  {i + 1}. ID={cov.id}, Time={cov.start_time}-{cov.end_time}, Min={cov.min_employees}"
                        )
                else:
                    print("No coverage found for this day of the week.")

        except Exception as e:
            print(f"Error generating assignments: {e}")
            traceback.print_exc()

        print("\nScheduler component testing complete.")

    except Exception as e:
        print(f"Error during scheduler component test: {e}")
        traceback.print_exc()


def run_diagnostic(db_path: str, test_date: date) -> None:
    """Run a comprehensive diagnostic on the scheduling system"""
    print("=" * 80)
    print("SCHEDULER DIAGNOSTIC REPORT")
    print("=" * 80)
    print(f"Date: {datetime.now()}")
    print(f"Test date: {test_date}")
    print(f"Database: {db_path}")
    print("=" * 80)

    # Check database
    print("\n1. DATABASE CHECK")
    print("-" * 40)
    db_ok = check_database(db_path)
    if not db_ok:
        print("❌ Database check failed. Further diagnostics may not be accurate.")
    else:
        print("✅ Database check passed.")

    # Check shift active_days
    print("\n2. SHIFT ACTIVE DAYS CHECK")
    print("-" * 40)
    active_days_ok = check_active_days(db_path)
    if not active_days_ok:
        print("⚠️ Some shifts are missing active_days configuration.")
        print("   Run with --fix-active-days to automatically repair.")
    else:
        print("✅ Shift active_days check passed.")

    # Test scheduler components
    print("\n3. SCHEDULER COMPONENT TEST")
    print("-" * 40)
    test_scheduler_components(db_path, test_date)

    # Check existing assignments
    print("\n4. ASSIGNMENT CHECK")
    print("-" * 40)
    try:
        conn, cursor = get_connection(db_path)

        # Check for assignments on the test date
        cursor.execute(
            """
            SELECT COUNT(*) FROM schedules WHERE date = ?
        """,
            (test_date.isoformat(),),
        )
        assignment_count = cursor.fetchone()[0]

        if assignment_count > 0:
            print(f"✅ Found {assignment_count} assignments for {test_date}")

            # Check shift distribution
            cursor.execute(
                """
                SELECT shifts.shift_type, COUNT(*) as count
                FROM schedules 
                JOIN shifts ON schedules.shift_id = shifts.id
                WHERE schedules.date = ?
                GROUP BY shifts.shift_type
            """,
                (test_date.isoformat(),),
            )
            distribution = cursor.fetchall()

            if distribution:
                print("Assignment distribution by shift type:")
                for shift_type, count in distribution:
                    print(f"  {shift_type}: {count} assignments")
        else:
            print(f"⚠️ No assignments found for {test_date}")
            print("   Run with --create-assignments to create test assignments.")

        conn.close()
    except sqlite3.Error as e:
        print(f"❌ Error checking assignments: {e}")

    print("\nDIAGNOSTIC SUMMARY")
    print("=" * 40)
    if not db_ok:
        print("❌ Database issue detected: Check database file and permissions.")
    if not active_days_ok:
        print("⚠️ Shift active_days issue: Run with --fix-active-days to repair.")
    if assignment_count == 0:
        print(
            "⚠️ No assignments for test date: Run with --create-assignments to create test data."
        )

    if db_ok and active_days_ok and assignment_count > 0:
        print("✅ All checks passed. Scheduler appears to be properly configured.")

    print("\nRecommended actions:")
    if not active_days_ok:
        print("1. Fix shift active_days configuration")
    if assignment_count == 0:
        print(f"2. Create test assignments for {test_date}")

    print("\nDiagnostic complete.")


def test_assignment_persistence(
    db_path: str, test_date: date, accumulated_ids_list: List[int]
) -> bool:
    """
    Tests if assignments are correctly saved to the DB for a single date
    and appends created IDs to the accumulated list.
    Returns True if successful for this date, False otherwise.
    """
    print(f"\n--- Testing Assignment Persistence for {test_date} ---")
    created_assignment_ids_for_this_date: List[int] = []
    conn = None
    success_for_this_date = False
    try:
        conn, cursor = get_connection(db_path)

        # 1. Define test assignments
        cursor.execute("SELECT id FROM employees WHERE is_active = 1 LIMIT 1")
        employee_row = cursor.fetchone()
        if not employee_row:
            print(
                f"❌ No active employees found for {test_date}. Skipping persistence test for this date."
            )
            return False
        test_employee_id = employee_row[0]

        cursor.execute("SELECT id FROM shifts LIMIT 1")
        shift_row = cursor.fetchone()
        if not shift_row:
            print(
                f"❌ No shifts found for {test_date}. Skipping persistence test for this date."
            )
            return False
        test_shift_id = shift_row[0]

        cursor.execute("SELECT COALESCE(MAX(id), 0) FROM schedules")
        max_id = cursor.fetchone()[0]
        next_id = max_id + 1

        test_assignments_data = [
            {
                "id": next_id,
                "employee_id": test_employee_id,
                "shift_id": test_shift_id,
                "date": test_date.isoformat(),
                "status": "PERSISTENCE_TEST",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "version": 999,
            }
        ]

        print(
            f"Attempting to create {len(test_assignments_data)} test assignment(s) for {test_date}..."
        )
        for assignment_data in test_assignments_data:
            try:
                cursor.execute(
                    """
                    INSERT INTO schedules (
                        id, employee_id, shift_id, date, status, created_at, updated_at, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        assignment_data["id"],
                        assignment_data["employee_id"],
                        assignment_data["shift_id"],
                        assignment_data["date"],
                        assignment_data["status"],
                        assignment_data["created_at"],
                        assignment_data["updated_at"],
                        assignment_data["version"],
                    ),
                )
                created_assignment_ids_for_this_date.append(assignment_data["id"])
                print(
                    f"  ✅ Created test assignment ID: {assignment_data['id']} for {test_date}"
                )
            except sqlite3.Error as e:
                print(f"  ❌ Error creating test assignment for {test_date}: {e}")
                conn.rollback()
                return False  # Stop for this date if creation fails

        if not created_assignment_ids_for_this_date:
            print(f"No test assignments were created for {test_date}.")
            return False

        conn.commit()
        print(f"Test assignment(s) for {test_date} committed.")

        # 2. Verify assignments
        print(f"Verifying test assignment(s) for {test_date}...")
        verified_count = 0
        for assignment_id in created_assignment_ids_for_this_date:
            cursor.execute(
                "SELECT id, employee_id, shift_id, date, status, version FROM schedules WHERE id = ?",
                (assignment_id,),
            )
            row = cursor.fetchone()
            if row:
                original_data = next(
                    item
                    for item in test_assignments_data
                    if item["id"] == assignment_id
                )
                if (
                    row["employee_id"] == original_data["employee_id"]
                    and row["shift_id"] == original_data["shift_id"]
                    and row["date"] == original_data["date"]
                    and row["status"] == original_data["status"]
                    and row["version"] == original_data["version"]
                ):
                    print(
                        f"  ✅ Verified assignment ID: {assignment_id} for {test_date}."
                    )
                    verified_count += 1
                else:
                    print(
                        f"  ❌ Verification failed for assignment ID: {assignment_id} on {test_date}. Data mismatch."
                    )
            else:
                print(
                    f"  ❌ Verification failed. Assignment ID: {assignment_id} for {test_date} not found."
                )

        if verified_count == len(created_assignment_ids_for_this_date):
            print(
                f"✅ All test assignments for {test_date} successfully created and verified."
            )
            accumulated_ids_list.extend(
                created_assignment_ids_for_this_date
            )  # Add to main list
            success_for_this_date = True
        else:
            print(
                f"❌ Verification issues for {test_date}: {verified_count}/{len(created_assignment_ids_for_this_date)} verified."
            )
            # Optionally, decide if partially successful tests should still have their IDs added for reversal
            # For now, only adding if all are verified for this date.

    except sqlite3.Error as e:
        print(f"❌ Database error during persistence test for {test_date}: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"❌ Unexpected error for {test_date}: {e}")
        traceback.print_exc()
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()
        print(f"--- Finished Assignment Persistence Test for {test_date} ---")

    return success_for_this_date


def ask_and_reverse_assignments(db_path: str, assignment_ids: List[int]):
    """
    Asks the user if they want to delete the specified assignments and does so if confirmed.
    """
    if not assignment_ids:
        print("No assignment IDs provided for reversal.")
        return

    print("-" * 40)
    user_input = (
        input(
            f"Do you want to reverse/delete the {len(assignment_ids)} test assignment(s) created? (yes/no): "
        )
        .strip()
        .lower()
    )

    if user_input == "yes":
        conn = None
        try:
            conn, cursor = get_connection(db_path)
            placeholders = ",".join("?" for _ in assignment_ids)
            sql = f"DELETE FROM schedules WHERE id IN ({placeholders})"

            cursor.execute(sql, assignment_ids)
            deleted_count = cursor.rowcount
            conn.commit()

            if deleted_count == len(assignment_ids):
                print(f"✅ Successfully deleted {deleted_count} test assignment(s).")
            elif deleted_count > 0:
                print(
                    f"⚠️ Deleted {deleted_count} assignment(s), but expected to delete {len(assignment_ids)}."
                )
            else:
                print(
                    "❌ No test assignments were deleted. They might have been removed by another process or did not exist."
                )

        except sqlite3.Error as e:
            print(f"❌ Database error during assignment reversal: {e}")
            if conn:
                conn.rollback()
        except Exception as e:
            print(f"❌ An unexpected error occurred during reversal: {e}")
            traceback.print_exc()
        finally:
            if conn:
                conn.close()
    else:
        print("Test assignments were NOT reversed and remain in the database.")
    print("-" * 40)


def main():
    """Main function to parse arguments and run the appropriate action"""
    parser = argparse.ArgumentParser(description="Scheduler Companion Utility")

    # Add arguments
    parser.add_argument(
        "--check", action="store_true", help="Check for configuration issues"
    )
    parser.add_argument(
        "--fix-active-days", action="store_true", help="Fix shift template active_days"
    )
    parser.add_argument(
        "--create-assignments", action="store_true", help="Create test assignments"
    )
    parser.add_argument(
        "--test-components", action="store_true", help="Test scheduler components"
    )
    parser.add_argument(
        "--diagnostic", action="store_true", help="Run comprehensive diagnostic"
    )
    # parser.add_argument("--date", type=str, help="Date to use for testing (YYYY-MM-DD format)") # Removed
    parser.add_argument(
        "--start-date",
        type=str,
        help="Start date for testing (YYYY-MM-DD format). Defaults to today if not specified.",
    )
    parser.add_argument(
        "--end-date",
        type=str,
        help="End date for testing (YYYY-MM-DD format). If provided, creates a range with start-date.",
    )
    parser.add_argument(
        "--test-assignment-persistence",
        action="store_true",
        help="Test assignment creation, DB save, and offer reversal",
    )

    args = parser.parse_args()

    # Find the database file
    db_path = os.path.join(root_dir, "src/instance/app.db")

    # Determine the test date(s)
    dates_to_process: List[date] = []

    start_date_obj: Optional[date] = None
    end_date_obj: Optional[date] = None

    if args.start_date:
        try:
            start_date_obj = date.fromisoformat(args.start_date)
        except ValueError:
            print(f"Invalid start-date format: {args.start_date}. Use YYYY-MM-DD.")
            return

    if args.end_date:
        try:
            end_date_obj = date.fromisoformat(args.end_date)
        except ValueError:
            print(f"Invalid end-date format: {args.end_date}. Use YYYY-MM-DD.")
            return

    if start_date_obj and end_date_obj:
        if end_date_obj < start_date_obj:
            print("Error: End date cannot be before start date.")
            return
        current_date_in_loop = start_date_obj
        while current_date_in_loop <= end_date_obj:
            dates_to_process.append(current_date_in_loop)
            current_date_in_loop += timedelta(days=1)
    elif start_date_obj:
        dates_to_process.append(start_date_obj)
    else:  # Neither start_date nor end_date provided, default to today
        dates_to_process.append(date.today())

    if not dates_to_process:
        print("No dates selected for processing.")
        return

    print(f"Using database: {db_path}")
    if len(dates_to_process) == 1:
        print(f"Processing for date: {dates_to_process[0]}")
    else:
        print(
            f"Processing for date range: {dates_to_process[0]} to {dates_to_process[-1]}"
        )

    # Run the requested actions
    # Note: Some actions like diagnostic might run multiple times if a range is selected.
    # Consider if this is desired or if they should only run for the start_date.
    # For now, they will run for each date in dates_to_process if their flag is set.

    all_accumulated_assignment_ids: List[int] = []

    for current_test_date in dates_to_process:
        print(f"\n=== Processing actions for date: {current_test_date} ===")
        if args.check:  # This will run for each date in range
            print("\nCHECKING CONFIGURATION")
            print("=" * 40)
            db_ok = check_database(db_path)
            active_days_ok = check_active_days(
                db_path
            )  # This check is not date-specific
            if db_ok and active_days_ok:
                print("✅ All configuration checks passed.")
            else:
                print("⚠️ Some configuration checks failed.")

        if (
            args.fix_active_days
        ):  # Not date-specific, will run multiple times if in range
            print("\nFIXING SHIFT ACTIVE_DAYS")
            print("=" * 40)
            fix_active_days(db_path)

        if args.create_assignments:  # Date-specific
            print("\nCREATING TEST ASSIGNMENTS")
            print("=" * 40)
            create_test_assignments(db_path, current_test_date)

        if args.test_components:  # Date-specific
            print("\nTESTING SCHEDULER COMPONENTS")
            print("=" * 40)
            test_scheduler_components(db_path, current_test_date)

        if args.diagnostic:  # Date-specific
            run_diagnostic(db_path, current_test_date)

        if args.test_assignment_persistence:  # Date-specific
            test_assignment_persistence(
                db_path, current_test_date, all_accumulated_assignment_ids
            )

    # After processing all dates, handle reversal if assignments were created
    if args.test_assignment_persistence and all_accumulated_assignment_ids:
        print("\n=== End of Date Range Processing ===")
        ask_and_reverse_assignments(db_path, all_accumulated_assignment_ids)
    elif args.test_assignment_persistence:  # Flag was set but no IDs accumulated
        print(
            "\nNo assignments were created by the persistence test across the date range."
        )

    # If no arguments provided, show help
    if not any(
        getattr(args, arg)
        for arg in vars(args)
        if arg not in ["start_date", "end_date"]
    ):
        parser.print_help()


if __name__ == "__main__":
    main()
