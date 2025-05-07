#!/usr/bin/env python
"""
Diagnostic script to investigate why shifts are not being assigned.
This script checks all the components that affect shift assignment:
- Shift templates configuration
- Active days for shifts
- Coverage requirements
- Employee availability and constraints
"""

import sys
import os
import traceback
from datetime import date, datetime, timedelta
import logging
import json

# Add the parent directories to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("shift_diagnostic")

def setup_app():
    """Set up the Flask app and return the app context"""
    try:
        # Now do the imports
        from backend.app import create_app
        
        print("Creating Flask application...")
        app = create_app()
        return app
    except Exception as e:
        logger.error(f"Error setting up app: {str(e)}")
        traceback.print_exc()
        sys.exit(1)

def check_shift_templates(db):
    """Check shift templates for configuration issues"""
    from backend.models import ShiftTemplate
    
    print("\n--- CHECKING SHIFT TEMPLATES ---")
    shifts = ShiftTemplate.query.all()
    print(f"Found {len(shifts)} shift templates")
    
    if not shifts:
        print("ERROR: No shift templates found. This will prevent schedule generation.")
        return False
    
    all_shifts_valid = True
    
    # Map for day of week indices
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    for i, shift in enumerate(shifts, 1):
        print(f"\nShift #{i}:")
        print(f"  ID: {shift.id}")
        print(f"  Type: {shift.shift_type.value if hasattr(shift, 'shift_type') and shift.shift_type else 'MISSING'}")
        print(f"  Start time: {shift.start_time}")
        print(f"  End time: {shift.end_time}")
        print(f"  Duration: {shift.duration_hours} hours")
        print(f"  Requires break: {shift.requires_break}")
        
        # Check active days
        if hasattr(shift, 'active_days') and shift.active_days:
            active_day_names = [day_names[day] for day in shift.active_days if 0 <= day < 7]
            print(f"  Active days: {shift.active_days} ({', '.join(active_day_names)})")
        else:
            print(f"  Active days: None or empty - THIS SHIFT WILL NEVER BE SCHEDULED")
            all_shifts_valid = False
        
        # Check for issues
        issues = []
        if not shift.start_time:
            issues.append("Missing start time")
        if not shift.end_time:
            issues.append("Missing end time")
        if not hasattr(shift, 'shift_type') or not shift.shift_type:
            issues.append("Missing shift type")
        if shift.duration_hours is None:
            issues.append("Missing duration")
        elif shift.duration_hours <= 0:
            issues.append(f"Invalid duration: {shift.duration_hours}")
        if not hasattr(shift, 'active_days') or not shift.active_days:
            issues.append("No active days defined - shift will never be used")
        
        if issues:
            print("  ISSUES FOUND:")
            for issue in issues:
                print(f"    - {issue}")
            all_shifts_valid = False
    
    return all_shifts_valid

def check_coverage(db):
    """Check coverage requirements"""
    from backend.models import Coverage
    
    print("\n--- CHECKING COVERAGE REQUIREMENTS ---")
    coverage = Coverage.query.all()
    print(f"Found {len(coverage)} coverage requirements")
    
    if not coverage:
        print("ERROR: No coverage requirements found. This will prevent schedule generation.")
        return False
    
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    coverage_by_day = {}
    
    for day_idx in range(7):
        day_coverage = Coverage.query.filter_by(day_index=day_idx).all()
        day_name = day_names[day_idx]
        coverage_by_day[day_name] = day_coverage
        
        print(f"\n{day_name}: {len(day_coverage)} coverage blocks")
        for i, cov in enumerate(day_coverage, 1):
            print(f"  Block #{i}:")
            print(f"    Time: {cov.start_time} - {cov.end_time}")
            print(f"    Employees: min={cov.min_employees}, max={cov.max_employees}")
            print(f"    Requires keyholder: {getattr(cov, 'requires_keyholder', False)}")
            
            if cov.min_employees == 0:
                print("    WARNING: min_employees is 0 - no employees will be scheduled")
    
    return True

def check_employees(db):
    """Check employee configuration"""
    from backend.models import Employee
    
    print("\n--- CHECKING EMPLOYEES ---")
    employees = Employee.query.all()
    active_employees = [e for e in employees if getattr(e, 'is_active', False)]
    keyholders = [e for e in active_employees if getattr(e, 'is_keyholder', False)]
    
    print(f"Total employees: {len(employees)}")
    print(f"Active employees: {len(active_employees)}")
    print(f"Keyholders: {len(keyholders)}")
    
    if not active_employees:
        print("ERROR: No active employees found. This will prevent schedule generation.")
        return False
    
    if not keyholders:
        print("WARNING: No keyholders found. This may prevent scheduling shifts requiring keyholders.")
    
    # Check employee groups and contracted hours
    for i, emp in enumerate(active_employees[:5], 1):
        print(f"\nEmployee #{i} (ID: {emp.id}):")
        print(f"  Name: {getattr(emp, 'first_name', '')} {getattr(emp, 'last_name', '')}")
        print(f"  Group: {getattr(emp, 'employee_group', 'Unknown')}")
        print(f"  Keyholder: {getattr(emp, 'is_keyholder', False)}")
        print(f"  Contracted hours: {getattr(emp, 'contracted_hours', 'Unknown')}")
    
    if len(active_employees) > 5:
        print(f"... and {len(active_employees) - 5} more active employees")
    
    return True

def check_employee_availability(db, test_date=None):
    """Check employee availability for a specific date"""
    from backend.models import Employee, EmployeeAvailability, Absence
    
    if not test_date:
        # Use next Monday as test date
        today = date.today()
        days_ahead = (0 - today.weekday()) % 7
        test_date = today + timedelta(days=days_ahead)
    
    print(f"\n--- CHECKING EMPLOYEE AVAILABILITY FOR {test_date} (Weekday: {test_date.weekday()}) ---")
    
    # Check absences
    absences = Absence.query.filter(
        Absence.start_date <= test_date,
        Absence.end_date >= test_date
    ).all()
    
    print(f"Employees on leave for {test_date}: {len(absences)}")
    for absence in absences:
        print(f"  Employee ID {absence.employee_id}: {absence.start_date} to {absence.end_date}")
    
    # Check availability records
    employees = Employee.query.filter_by(is_active=True).all()
    employee_ids = [e.id for e in employees]
    
    availability_records = EmployeeAvailability.query.filter(
        EmployeeAvailability.employee_id.in_(employee_ids),
        EmployeeAvailability.day_of_week == test_date.weekday()
    ).all()
    
    print(f"Availability records for day {test_date.weekday()}: {len(availability_records)}")
    
    # Check each employee's availability
    for employee in employees[:5]:  # Check first 5 for brevity
        employee_records = [r for r in availability_records if r.employee_id == employee.id]
        
        if not employee_records:
            print(f"  Employee ID {employee.id}: No explicit availability records (assumed available)")
        else:
            unavailable_hours = [f"{r.start_hour}:00-{r.end_hour}:00" for r in employee_records 
                                if hasattr(r, 'availability_type') and r.availability_type == 'UNAVAILABLE']
            
            if unavailable_hours:
                print(f"  Employee ID {employee.id}: Unavailable during {', '.join(unavailable_hours)}")
            else:
                print(f"  Employee ID {employee.id}: Has {len(employee_records)} availability records, all available")
    
    return True

def check_scheduler_config(db):
    """Check scheduler configuration settings"""
    from backend.models import Settings
    
    print("\n--- CHECKING SCHEDULER CONFIGURATION ---")
    settings = Settings.query.first()
    
    if not settings:
        print("WARNING: No settings found in database. Default values will be used.")
        return True
    
    print("Scheduler settings:")
    print(f"  Min hours between shifts: {getattr(settings, 'min_hours_between_shifts', 'Not set')}")
    print(f"  Max consecutive days: {getattr(settings, 'max_consecutive_days', 'Not set')}")
    
    constraint_issues = []
    
    # Check for potentially restrictive constraints
    if hasattr(settings, 'min_hours_between_shifts') and settings.min_hours_between_shifts > 12:
        constraint_issues.append(f"min_hours_between_shifts is set to {settings.min_hours_between_shifts} hours, which may be too restrictive")
        
    if hasattr(settings, 'max_consecutive_days') and settings.max_consecutive_days < 3:
        constraint_issues.append(f"max_consecutive_days is set to {settings.max_consecutive_days}, which may be too restrictive")
    
    if constraint_issues:
        print("\nPotentially restrictive constraints found:")
        for issue in constraint_issues:
            print(f"  - {issue}")
    
    return True

def test_schedule_generator(app, start_date=None, end_date=None):
    """Test the schedule generator with detailed logging"""
    from backend.services.scheduler import ScheduleGenerator
    import logging
    
    # Set up dates
    if not start_date:
        today = date.today()
        # Start on next Monday
        days_ahead = (0 - today.weekday()) % 7
        start_date = today + timedelta(days=days_ahead)
    
    if not end_date:
        end_date = start_date + timedelta(days=2)  # Just test 3 days
    
    print(f"\n--- TESTING SCHEDULE GENERATOR ({start_date} to {end_date}) ---")
    
    # Set up logging to see the schedule generation process
    logging.getLogger('backend.services.scheduler').setLevel(logging.DEBUG)
    
    # Create and run the schedule generator
    generator = ScheduleGenerator()
    
    # Run the generation
    print("Generating schedule...")
    result = generator.generate_schedule(start_date=start_date, end_date=end_date)
    
    # Analyze results
    schedule = result.get("schedule", [])
    print(f"Generated {len(schedule)} schedule entries")
    
    # Check for entries with shifts
    entries_with_shifts = [e for e in schedule if e.get("shift_id")]
    print(f"Entries with assigned shifts: {len(entries_with_shifts)}")
    print(f"Empty entries: {len(schedule) - len(entries_with_shifts)}")
    
    # Check if we got 0 assignments
    if len(entries_with_shifts) == 0:
        print("\nWARNING: No shifts were assigned! Potential causes:")
        print("  1. Shift templates don't have active_days set for these dates")
        print("  2. No coverage requirements for these dates/days of week")
        print("  3. No employees available (check leave/absence records)")
        print("  4. Constraint violations prevent assignments (rest periods, consecutive days)")
    
    # Check warnings and errors
    warnings = result.get("warnings", [])
    errors = result.get("errors", [])
    
    print(f"\nWarnings: {len(warnings)}")
    for i, warning in enumerate(warnings[:5]):
        print(f"  Warning {i+1}: {warning.get('message')} ({warning.get('type')})")
    
    print(f"\nErrors: {len(errors)}")
    for i, error in enumerate(errors[:5]):
        print(f"  Error {i+1}: {error.get('message')} ({error.get('type')})")
    
    return len(entries_with_shifts) > 0

def check_date_shift_matches(app, test_date=None):
    """Check if shifts and coverage requirements match for a specific date"""
    from backend.models import ShiftTemplate, Coverage
    
    if not test_date:
        # Use next Monday as test date
        today = date.today()
        days_ahead = (0 - today.weekday()) % 7
        test_date = today + timedelta(days=days_ahead)
    
    day_index = test_date.weekday()
    print(f"\n--- CHECKING SHIFT AND COVERAGE ALIGNMENT FOR {test_date} (Weekday: {day_index}) ---")
    
    # Get all shifts
    all_shifts = ShiftTemplate.query.all()
    
    # Find shifts active on this day
    active_shifts = []
    for shift in all_shifts:
        if hasattr(shift, 'active_days') and shift.active_days and day_index in shift.active_days:
            active_shifts.append(shift)
    
    print(f"Shifts active on day {day_index} ({len(active_shifts)}/{len(all_shifts)}):")
    for shift in active_shifts:
        print(f"  Shift {shift.id}: {shift.start_time}-{shift.end_time}")
    
    # Get coverage for this day
    coverage_blocks = Coverage.query.filter_by(day_index=day_index).all()
    print(f"Coverage blocks for day {day_index} ({len(coverage_blocks)}):")
    for coverage in coverage_blocks:
        print(f"  Coverage: {coverage.start_time}-{coverage.end_time}, min={coverage.min_employees}")
    
    # Check for potential mismatches
    has_mismatches = False
    if not active_shifts:
        print("  ERROR: No shifts are active for this day!")
        has_mismatches = True
    
    if not coverage_blocks:
        print("  ERROR: No coverage requirements for this day!")
        has_mismatches = True
    
    # Check if shift times align with coverage times
    if active_shifts and coverage_blocks:
        for coverage in coverage_blocks:
            matching_shifts = [s for s in active_shifts 
                             if s.start_time == coverage.start_time and s.end_time == coverage.end_time]
            
            if not matching_shifts:
                print(f"  WARNING: No shifts match coverage block {coverage.start_time}-{coverage.end_time}")
                has_mismatches = True
                
                # Find closest matches for debugging
                print("  Closest matches:")
                for shift in active_shifts:
                    print(f"    Shift {shift.id}: {shift.start_time}-{shift.end_time}")
    
    if not has_mismatches:
        print("  Good news! Shifts and coverage requirements appear to be aligned for this day.")
    
    return not has_mismatches

def run_diagnostic():
    """Run the complete diagnostic"""
    print("=================================================================")
    print("               SHIFT ASSIGNMENT DIAGNOSTIC TOOL                 ")
    print("=================================================================")
    
    app = setup_app()
    
    with app.app_context():
        from backend.models import db
        
        all_checks_passed = True
        
        # Step 1: Check shift templates
        shift_templates_ok = check_shift_templates(db)
        all_checks_passed = all_checks_passed and shift_templates_ok
        
        # Step 2: Check coverage
        coverage_ok = check_coverage(db)
        all_checks_passed = all_checks_passed and coverage_ok
        
        # Step 3: Check employees
        employees_ok = check_employees(db)
        all_checks_passed = all_checks_passed and employees_ok
        
        # Step 4: Check scheduler config
        config_ok = check_scheduler_config(db)
        all_checks_passed = all_checks_passed and config_ok
        
        # Step 5: Check date-shift matches
        date_shift_matches_ok = check_date_shift_matches(app)
        all_checks_passed = all_checks_passed and date_shift_matches_ok
        
        # Step 6: Check employee availability
        availability_ok = check_employee_availability(db)
        all_checks_passed = all_checks_passed and availability_ok
        
        # Step 7: Test schedule generator
        generator_ok = test_schedule_generator(app)
        all_checks_passed = all_checks_passed and generator_ok
        
        print("\n=================================================================")
        print("                     DIAGNOSTIC SUMMARY                          ")
        print("=================================================================")
        print(f"Shift Templates: {'✅ OK' if shift_templates_ok else '❌ Issues Found'}")
        print(f"Coverage Requirements: {'✅ OK' if coverage_ok else '❌ Issues Found'}")
        print(f"Employee Configuration: {'✅ OK' if employees_ok else '❌ Issues Found'}")
        print(f"Scheduler Configuration: {'✅ OK' if config_ok else '❌ Issues Found'}")
        print(f"Date-Shift Alignment: {'✅ OK' if date_shift_matches_ok else '❌ Issues Found'}")
        print(f"Employee Availability: {'✅ OK' if availability_ok else '❌ Issues Found'}")
        print(f"Schedule Generation: {'✅ Shifts Assigned' if generator_ok else '❌ No Shifts Assigned'}")
        
        if not all_checks_passed:
            print("\nISSUES WERE DETECTED! Please review the detailed output above.")
            print("\nPOSSIBLE SOLUTIONS:")
            
            if not shift_templates_ok:
                print("- Ensure all shift templates have active_days set")
                print("- Make sure shift templates have valid times and duration")
            
            if not coverage_ok:
                print("- Create coverage requirements for each day of the week")
                print("- Ensure coverage blocks have min_employees > 0")
            
            if not employees_ok:
                print("- Make sure there are active employees in the database")
                print("- Designate some employees as keyholders")
            
            if not date_shift_matches_ok:
                print("- Ensure shift templates and coverage requirements align")
                print("- Make sure shifts are active on the days they're needed")
            
            if not generator_ok:
                print("- Review the schedule generator logs for specific errors")
                print("- Check if constraints are too restrictive (rest periods, consecutive days)")
        else:
            print("\nAll checks passed! If you're still experiencing issues, please check:")
            print("- The diagnostic log file for detailed messages")
            print("- Database connection and consistency")
            print("- Application server logs for any errors")

if __name__ == "__main__":
    run_diagnostic() 