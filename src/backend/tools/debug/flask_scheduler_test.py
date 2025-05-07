#!/usr/bin/env python
"""
Flask-enabled scheduler test.
This script runs the scheduler inside a Flask application context and
combines our previous test approach with proper database access.
"""

import os
import sys
import json
from datetime import date, datetime, timedelta

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, '../..'))
root_dir = os.path.abspath(os.path.join(backend_dir, '../..'))
sys.path.insert(0, root_dir)

def main():
    """Main function to run the scheduler test in Flask context"""
    print("=" * 80)
    print("FLASK-ENABLED SCHEDULER TEST")
    print("=" * 80)
    print("This script runs the scheduler inside a Flask application context.\n")
    
    try:
        # Import Flask app and create app context
        from src.backend.app import create_app
        print("Creating Flask application...")
        app = create_app()
        
        # Run everything inside the app context
        with app.app_context():
            print("\n1. SETTING UP TEST")
            print("-" * 40)
            
            # Import models and scheduler components
            from src.backend.models import Employee, ShiftTemplate, Coverage, db
            from src.backend.services.scheduler.resources import ScheduleResources
            from src.backend.services.scheduler.generator import ScheduleGenerator
            
            # Check database state
            employee_count = Employee.query.filter_by(is_active=True).count()
            shift_count = ShiftTemplate.query.count()
            coverage_count = Coverage.query.count()
            
            print(f"Database state:")
            print(f"  Active employees: {employee_count}")
            print(f"  Shift templates: {shift_count}")
            print(f"  Coverage records: {coverage_count}")
            
            # Check if shift active_days need fixing
            print("\nChecking shift active_days...")
            shifts_needing_update = ShiftTemplate.query.filter(
                (ShiftTemplate.active_days.is_(None)) | 
                (ShiftTemplate.active_days == '') |
                (ShiftTemplate.active_days == '[]')
            ).all()
            
            if shifts_needing_update:
                print(f"Found {len(shifts_needing_update)} shifts with missing active_days. Fixing...")
                for shift in shifts_needing_update:
                    shift.active_days = [0, 1, 2, 3, 4, 5, 6]  # All days of week
                    print(f"  Updated shift {shift.id}: {shift.active_days}")
                db.session.commit()
                print("Shift templates updated.")
            else:
                print("All shift templates have active_days configured.")
            
            # Set up a test date
            test_date = date(2025, 5, 10)  # Saturday (weekday 5)
            print(f"\nTest date: {test_date} (Weekday: {test_date.weekday()})")
            
            # Create scheduler resources
            print("\n2. INITIALIZING SCHEDULER")
            print("-" * 40)
            
            # Create resources and initialize scheduler
            resources = ScheduleResources()
            print("Created ScheduleResources")
            
            # Force load resources from database
            resources.load()
            print(f"Loaded resources:")
            print(f"  Employees: {len(resources.employees)}")
            print(f"  Shifts: {len(resources.shifts)}")
            print(f"  Coverage: {len(resources.coverage)}")
            
            # Create scheduler
            generator = ScheduleGenerator(resources=resources)
            print("Created ScheduleGenerator")
            
            # Test individual components
            print("\n3. TESTING SCHEDULER COMPONENTS")
            print("-" * 40)
            
            # Test coverage processing
            shift_needs = generator._process_coverage(test_date)
            print(f"Coverage needs result: {shift_needs}")
            
            # Test shift creation
            date_shifts = generator._create_date_shifts(test_date)
            print(f"Date shifts created: {len(date_shifts)}")
            if date_shifts:
                print(f"First date shift: Type={date_shifts[0].get('shift_type')}, Hours={date_shifts[0].get('duration_hours')}")
            
            # Test availability and assignment
            if date_shifts:
                available_employees = generator.distribution_manager.get_available_employees(test_date)
                print(f"Available employees: {len(available_employees)}")
                
                # Test assignment process
                print("\nTesting distribution...")
                assignments = generator.distribution_manager.assign_employees_with_distribution(
                    test_date, date_shifts, shift_needs
                )
                print(f"Generated assignments: {len(assignments)}")
                
                if assignments:
                    print("\nSample assignments:")
                    for i, assignment in enumerate(assignments[:3]):
                        emp_id = assignment.get('employee_id')
                        shift_id = assignment.get('shift_id')
                        print(f"  {i+1}. Employee {emp_id} assigned to Shift {shift_id}")
            
            # Generate full schedule
            print("\n4. GENERATING FULL SCHEDULE")
            print("-" * 40)
            
            result = generator.generate_schedule(
                start_date=test_date,
                end_date=test_date,
                create_empty_schedules=True
            )
            
            # Analyze result
            schedule = result.get('schedule', [])
            assignments = [entry for entry in schedule if entry.get('employee_id') is not None]
            
            print(f"Schedule generation complete:")
            print(f"  Total entries: {len(schedule)}")
            print(f"  Assignments: {len(assignments)}")
            
            if assignments:
                print("\nSuccessfully generated schedule with assignments!")
                print("Sample assignments:")
                for i, entry in enumerate(assignments[:3]):
                    employee_id = entry.get('employee_id')
                    shift_id = entry.get('shift_id')
                    entry_date = entry.get('date')
                    print(f"  {i+1}. Employee {employee_id} assigned to Shift {shift_id} on {entry_date}")
            else:
                print("\nNo assignments were generated in the schedule.")
                
                # Check for errors
                errors = result.get('errors', [])
                warnings = result.get('warnings', [])
                if errors:
                    print("\nErrors during schedule generation:")
                    for error in errors:
                        print(f"  - {error}")
                if warnings:
                    print("\nWarnings during schedule generation:")
                    for warning in warnings:
                        print(f"  - {warning}")
            
            # Show metrics
            metrics = result.get('metrics', {})
            if metrics:
                fairness = metrics.get('fairness_metrics', {})
                print("\nDistribution metrics:")
                print(f"  Total shifts: {metrics.get('total_shifts', 0)}")
                print(f"  Type distribution: {metrics.get('overall_percentages', {})}")
                print(f"  Fairness score: {fairness.get('equity_score', 0)}")
            
            print("\nScheduler test completed.")
        
    except Exception as e:
        print(f"❌ Error during scheduler test: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 