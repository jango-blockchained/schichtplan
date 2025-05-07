#!/usr/bin/env python
"""
Debug script to investigate why shifts aren't being assigned in the distribution process.
This helps identify issues with the distribution manager's assignment logic.
"""

import os
import sys
import logging
from datetime import date, timedelta

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, '../..'))
root_dir = os.path.abspath(os.path.join(backend_dir, '../..'))
src_dir = os.path.abspath(os.path.join(backend_dir, '..'))
sys.path.insert(0, root_dir)
sys.path.insert(0, src_dir)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("distribution_debug")

def main():
    """Main function for debugging shift distribution"""
    print("=" * 80)
    print("SHIFT DISTRIBUTION DEBUGGING TOOL")
    print("=" * 80)
    print("This tool inspects the distribution process to find why shifts aren't being assigned.\n")

    # Import necessary modules
    try:
        from backend.app import create_app
        from backend.models import db, Employee, ShiftTemplate, Coverage, EmployeeAvailability
        from backend.services.scheduler.generator import ScheduleGenerator
        from backend.services.scheduler.distribution import DistributionManager
        print("✅ Successfully imported required modules")
    except ImportError as e:
        print(f"❌ Error importing modules: {e}")
        return

    # Create app context
    print("Creating Flask application...")
    app = create_app()
    with app.app_context():
        # Make sure DB is initialized
        print(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
        
        # Verify database connection
        try:
            # Explicitly check if tables exist
            table_names = db.engine.table_names()
            print(f"Connected to database. Available tables: {', '.join(table_names)}")
        except Exception as e:
            print(f"❌ Database connection error: {e}")
            return
            
        # Collect diagnostic information
        print("\n1. CHECKING DATABASE RECORDS")
        print("-" * 40)
        
        employees = Employee.query.filter_by(is_active=True).all()
        shifts = ShiftTemplate.query.all()
        coverage = Coverage.query.all()
        
        print(f"Active employees: {len(employees)}")
        print(f"Shift templates: {len(shifts)}")
        print(f"Coverage records: {len(coverage)}")
        
        # Check active_days in shift templates
        print("\n2. CHECKING SHIFT TEMPLATE CONFIGURATION")
        print("-" * 40)
        for shift in shifts:
            active_days = shift.active_days if hasattr(shift, 'active_days') else None
            print(f"Shift ID: {shift.id}, Type: {shift.shift_type}, Active days: {active_days}")
            if not active_days or not isinstance(active_days, (list, set, str)) or len(str(active_days)) == 0:
                print(f"  ⚠️ WARNING: Shift {shift.id} has no active_days configured!")
        
        # Check distribution manager configuration
        print("\n3. ANALYZING DISTRIBUTION PROCESS")
        print("-" * 40)
        
        # Create a schedule generator for a small test period
        generator = ScheduleGenerator()
        start_date = date.today() + timedelta(days=1)  # Tomorrow
        end_date = start_date + timedelta(days=1)      # Day after tomorrow
        
        # Get distribution manager directly
        dist_manager = generator.distribution_manager
        
        # Try to get available employees for each day
        print("\nAvailable employees by date:")
        test_date = start_date
        while test_date <= end_date:
            available_emps = dist_manager.get_available_employees(test_date)
            print(f"Date: {test_date} - Available employees: {len(available_emps)}")
            test_date += timedelta(days=1)
        
        # Test if keyholders are available
        keyholders = [emp for emp in employees if emp.is_keyholder]
        print(f"\nFound {len(keyholders)} keyholders in the system")
        
        # Check availability by shift type for one test date
        print("\nAvailability for each shift type on test date:")
        test_date = start_date
        for shift_type in ["EARLY", "MIDDLE", "LATE"]:
            type_shifts = [s for s in shifts if s.shift_type == shift_type]
            
            if dist_manager.availability_checker:
                # Count employees available for each shift type
                available_for_type = 0
                for emp in employees:
                    for shift in type_shifts:
                        is_available, avail_type = dist_manager.availability_checker.is_employee_available(
                            emp.id, test_date, shift
                        )
                        if is_available:
                            available_for_type += 1
                            break
                
                print(f"Type {shift_type}: {available_for_type} employees available for {len(type_shifts)} shifts")
            else:
                print(f"Type {shift_type}: Cannot check availability (availability_checker not available)")
        
        # Test actual assignment process with sample data
        print("\n4. TESTING ASSIGNMENT PROCESS")
        print("-" * 40)
        
        # Get shift instances for the test date
        date_shifts = generator._create_date_shifts(test_date)
        print(f"Created {len(date_shifts)} shift instances for {test_date}")
        
        # Calculate shift needs for the test date
        shift_needs = generator._process_coverage(test_date)
        print(f"Coverage needs for {test_date}: {shift_needs}")
        
        # Test distribution
        try:
            assignments = dist_manager.assign_employees_with_distribution(
                test_date, date_shifts, shift_needs
            )
            print(f"Assignments generated: {len(assignments)}")
            
            if assignments:
                print("Sample assignments:")
                for i, assignment in enumerate(assignments[:5]):  # Show first 5 assignments
                    employee_id = assignment.get('employee_id')
                    shift_id = assignment.get('shift_id')
                    print(f"  {i+1}. Employee {employee_id} assigned to Shift {shift_id}")
            else:
                print("⚠️ No assignments were generated. Checking reasons...")
                
                # Check if keyholder assignment worked
                try:
                    keyholder_assignments = dist_manager.assign_keyholders(test_date, date_shifts)
                    print(f"Keyholder assignments attempted: {len(keyholder_assignments)}")
                except Exception as e:
                    print(f"Error in keyholder assignment: {str(e)}")
                
                # Check distribution for each shift type
                for shift_type in ["EARLY", "MIDDLE", "LATE"]:
                    type_shifts = [s for s in date_shifts if s.get('shift_type') == shift_type]
                    if not type_shifts:
                        print(f"No shifts found for type {shift_type}")
                        continue
                    
                    # Get available employees
                    available_employees = dist_manager.get_available_employees(test_date, type_shifts)
                    print(f"Type {shift_type}: {len(available_employees)} employees available for {len(type_shifts)} shifts")
                    
                    if available_employees:
                        try:
                            type_assignments = dist_manager.assign_employees_by_type(
                                test_date, type_shifts, available_employees, shift_type
                            )
                            print(f"Type {shift_type} assignments: {len(type_assignments)}")
                        except Exception as e:
                            print(f"Error assigning employees for type {shift_type}: {str(e)}")
                    else:
                        print(f"⚠️ No available employees for shift type {shift_type}!")
        except Exception as e:
            print(f"❌ Error in distribution process: {str(e)}")

if __name__ == "__main__":
    main() 