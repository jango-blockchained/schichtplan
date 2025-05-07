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
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, '../..'))
root_dir = os.path.abspath(os.path.join(backend_dir, '../..'))
sys.path.insert(0, root_dir)

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
        
        required_tables = ['employees', 'shifts', 'coverage', 'schedules']
        missing_tables = [table for table in required_tables if table not in tables]
        
        if missing_tables:
            print(f"Missing required tables: {', '.join(missing_tables)}")
            return False
        
        # Count records in each table
        counts = {}
        for table in required_tables:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cursor.fetchone()[0]
        
        print(f"Database contains:")
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
            print(f"Found {len(problematic_shifts)} shifts with missing or empty active_days.")
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
                (new_active_days, shift_id)
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
            employees = employees[employees_to_assign:] + employees[:employees_to_assign]
            
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
                            'PENDING',
                            datetime.now().isoformat(),
                            datetime.now().isoformat(),
                            1
                        )
                    )
                    next_id += 1
                    assignments_created += 1
                    print(f"Created assignment: Employee {employee_id} to Shift {shift_id}")
                except sqlite3.Error as e:
                    print(f"Error creating assignment: {e}")
        
        # Commit the transaction
        if assignments_created > 0:
            conn.commit()
            print(f"Successfully created {assignments_created} test assignments for {test_date}")
            
            # Get assignment distribution by shift type
            cursor.execute("""
                SELECT shifts.shift_type, COUNT(*) as count
                FROM schedules 
                JOIN shifts ON schedules.shift_id = shifts.id
                WHERE schedules.date = ?
                GROUP BY shifts.shift_type
                """, (test_date.isoformat(),))
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
                id=row['id'],
                employee_id=row['employee_id'],
                first_name=row['first_name'],
                last_name=row['last_name'],
                contracted_hours=row['contracted_hours'],
                employee_group=row['employee_group'],
                is_keyholder=bool(row['is_keyholder']),
                is_active=bool(row['is_active']),
                name=f"{row['first_name']} {row['last_name']}"
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
            if row['active_days']:
                try:
                    days_list = json.loads(row['active_days'])
                except (json.JSONDecodeError, TypeError):
                    try:
                        days_list = [int(day.strip()) for day in row['active_days'].split(',') if day.strip()]
                    except:
                        days_list = []
            
            shift = MockShiftTemplate(
                id=row['id'],
                start_time=row['start_time'],
                end_time=row['end_time'],
                duration_hours=row['duration_hours'],
                shift_type=row['shift_type'],
                shift_type_id=row['shift_type_id'],
                active_days=days_list
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
                id=row['id'],
                day_index=row['day_index'],
                start_time=row['start_time'],
                end_time=row['end_time'],
                min_employees=row['min_employees'],
                max_employees=row['max_employees']
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
        
        # Create custom resource container
        class CustomScheduleResources:
            def __init__(self, employees, shifts, coverage):
                self.employees = employees
                self.shifts = shifts
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
                """Mock implementation - all employees are available"""
                return True, "AVL"
            
            def get_employee_preferred_shifts(self, employee_id):
                """Mock implementation - no preferred shifts"""
                return []
            
            def get_employee_avoided_shifts(self, employee_id):
                """Mock implementation - no avoided shifts"""
                return []
        
        # Import scheduler components
        print("\nInitializing scheduler components...")
        from backend.services.scheduler.generator import ScheduleGenerator
        
        # Create resources
        resources = CustomScheduleResources(employees, shifts, coverage)
        print("Created custom resource container")
        
        # Create scheduler
        generator = ScheduleGenerator(resources=resources)
        print("Created ScheduleGenerator")
        
        # Test coverage processing
        print(f"\nTesting coverage processing for {test_date}...")
        shift_needs = generator._process_coverage(test_date)
        if shift_needs:
            print(f"Coverage needs: {shift_needs}")
        else:
            print("No coverage needs found for this date!")
            
            # Check if coverage exists for this day
            day_index = test_date.weekday() + 1
            if day_index == 7:  # Convert Sunday (6) to 0
                day_index = 0
                
            matching_coverage = [cov for cov in coverage if cov.day_index == day_index]
            print(f"Coverage records for day {day_index}: {len(matching_coverage)}")
            if matching_coverage:
                print("Sample coverage:")
                for i, cov in enumerate(matching_coverage[:3]):
                    print(f"  {i+1}. ID={cov.id}, Time={cov.start_time}-{cov.end_time}, Min={cov.min_employees}")
        
        # Test shift creation
        print(f"\nTesting shift creation for {test_date}...")
        date_shifts = generator._create_date_shifts(test_date)
        if date_shifts:
            print(f"Created {len(date_shifts)} shift instances")
            print("Sample shift instances:")
            for i, shift in enumerate(date_shifts[:3]):
                print(f"  {i+1}. Shift {shift.get('shift_id')}: {shift.get('shift_type')}, {shift.get('start_time')}-{shift.get('end_time')}")
        else:
            print("No shift instances created for this date!")
            
            # Check if any shifts are configured for this day
            weekday = test_date.weekday()
            matching_shifts = [s for s in shifts if hasattr(s, 'active_days') and s.active_days and weekday in s.active_days]
            print(f"Shifts configured for weekday {weekday}: {len(matching_shifts)}")
            if matching_shifts:
                print("Sample shifts:")
                for i, shift in enumerate(matching_shifts[:3]):
                    print(f"  {i+1}. ID={shift.id}, Type={shift.shift_type}, Active days={shift.active_days}")
        
        # If we have shifts and coverage, test distribution
        if date_shifts and shift_needs:
            # Test employee availability
            print("\nTesting employee availability...")
            available_employees = generator.distribution_manager.get_available_employees(test_date)
            print(f"Available employees: {len(available_employees)}")
            
            # Test distribution
            print("\nTesting employee distribution...")
            assignments = generator.distribution_manager.assign_employees_with_distribution(
                test_date, date_shifts, shift_needs
            )
            
            if assignments:
                print(f"Generated {len(assignments)} assignments")
                print("Sample assignments:")
                for i, assignment in enumerate(assignments[:5]):
                    emp_id = assignment.get('employee_id')
                    shift_id = assignment.get('shift_id')
                    print(f"  {i+1}. Employee {emp_id} assigned to Shift {shift_id}")
            else:
                print("No assignments were generated by the distribution manager.")
                print("This suggests a problem with the assignment algorithm.")
        
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
        cursor.execute("""
            SELECT COUNT(*) FROM schedules WHERE date = ?
        """, (test_date.isoformat(),))
        assignment_count = cursor.fetchone()[0]
        
        if assignment_count > 0:
            print(f"✅ Found {assignment_count} assignments for {test_date}")
            
            # Check shift distribution
            cursor.execute("""
                SELECT shifts.shift_type, COUNT(*) as count
                FROM schedules 
                JOIN shifts ON schedules.shift_id = shifts.id
                WHERE schedules.date = ?
                GROUP BY shifts.shift_type
            """, (test_date.isoformat(),))
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
        print("⚠️ No assignments for test date: Run with --create-assignments to create test data.")
    
    if db_ok and active_days_ok and assignment_count > 0:
        print("✅ All checks passed. Scheduler appears to be properly configured.")
    
    print("\nRecommended actions:")
    if not active_days_ok:
        print("1. Fix shift active_days configuration")
    if assignment_count == 0:
        print(f"2. Create test assignments for {test_date}")
    
    print("\nDiagnostic complete.")

def main():
    """Main function to parse arguments and run the appropriate action"""
    parser = argparse.ArgumentParser(description="Scheduler Companion Utility")
    
    # Add arguments
    parser.add_argument("--check", action="store_true", help="Check for configuration issues")
    parser.add_argument("--fix-active-days", action="store_true", help="Fix shift template active_days")
    parser.add_argument("--create-assignments", action="store_true", help="Create test assignments")
    parser.add_argument("--test-components", action="store_true", help="Test scheduler components")
    parser.add_argument("--diagnostic", action="store_true", help="Run comprehensive diagnostic")
    parser.add_argument("--date", type=str, help="Date to use for testing (YYYY-MM-DD format)")
    
    args = parser.parse_args()
    
    # Find the database file
    db_path = os.path.join(root_dir, "src/instance/app.db")
    
    # Determine the test date
    if args.date:
        try:
            test_date = date.fromisoformat(args.date)
        except ValueError:
            print(f"Invalid date format: {args.date}. Use YYYY-MM-DD.")
            return
    else:
        test_date = date.today()
    
    print(f"Using database: {db_path}")
    print(f"Using test date: {test_date}")
    
    # Run the requested actions
    if args.check:
        print("\nCHECKING CONFIGURATION")
        print("=" * 40)
        db_ok = check_database(db_path)
        active_days_ok = check_active_days(db_path)
        
        if db_ok and active_days_ok:
            print("✅ All configuration checks passed.")
        else:
            print("⚠️ Some configuration checks failed. See above for details.")
    
    if args.fix_active_days:
        print("\nFIXING SHIFT ACTIVE_DAYS")
        print("=" * 40)
        fix_active_days(db_path)
    
    if args.create_assignments:
        print("\nCREATING TEST ASSIGNMENTS")
        print("=" * 40)
        create_test_assignments(db_path, test_date)
    
    if args.test_components:
        print("\nTESTING SCHEDULER COMPONENTS")
        print("=" * 40)
        test_scheduler_components(db_path, test_date)
    
    if args.diagnostic:
        run_diagnostic(db_path, test_date)
    
    # If no arguments provided, show help
    if not any([args.check, args.fix_active_days, args.create_assignments, 
                args.test_components, args.diagnostic]):
        parser.print_help()

if __name__ == "__main__":
    main() 