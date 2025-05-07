#!/usr/bin/env python
"""
Script to diagnose why shifts aren't being assigned by checking how
shifts align with coverage blocks in the distribution system.
This shows how the ScheduleGenerator processes coverage and shifts.
"""

import sys
import os
import logging
from datetime import datetime, date, timedelta

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("distribution_check")

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, '../../..'))
sys.path.insert(0, backend_dir)

def check_coverage_shift_distribution():
    """Check how coverage requirements are processed and matched with shifts"""
    # Import necessary modules in function to ensure proper path resolution
    from backend.app import create_app
    from backend.models import ShiftTemplate, Coverage, Employee
    
    # Create app and run within context
    app = create_app()
    
    with app.app_context():
        # Step 1: Simulate how ScheduleGenerator._coverage_applies_to_date and _shift_applies_to_date work
        print("=================================================================")
        print("           SCHEDULE DISTRIBUTION DIAGNOSTICS TOOL                ")
        print("=================================================================")
        
        # Use a specific date for testing
        test_date = date.today() + timedelta(days=1)  # tomorrow
        print(f"Testing distribution for date: {test_date} (Weekday: {test_date.weekday()})")
        
        # Get all shifts and coverage
        shifts = ShiftTemplate.query.all()
        coverages = Coverage.query.all()
        employees = Employee.query.filter_by(is_active=True).all()
        
        print(f"\nFound {len(shifts)} shift templates")
        print(f"Found {len(coverages)} coverage blocks")
        print(f"Found {len(employees)} active employees")
        
        # Check which shifts are active on this day
        print("\n--- ACTIVE SHIFTS FOR TEST DATE ---")
        active_shifts = []
        for shift in shifts:
            if hasattr(shift, 'active_days') and shift.active_days and test_date.weekday() in shift.active_days:
                print(f"Shift #{shift.id}: {shift.start_time}-{shift.end_time} (active)")
                active_shifts.append(shift)
            else:
                print(f"Shift #{shift.id}: {shift.start_time}-{shift.end_time} (inactive - not scheduled for this day)")
        
        # Check coverage blocks for this day
        print("\n--- COVERAGE REQUIREMENTS FOR TEST DATE ---")
        applicable_coverage = []
        for coverage in coverages:
            if coverage.day_index == test_date.weekday():
                print(f"Coverage: day={coverage.day_index}, time={coverage.start_time}-{coverage.end_time}, min={coverage.min_employees}")
                applicable_coverage.append(coverage)
        
        if not applicable_coverage:
            print("No coverage requirements found for this day!")
            return
            
        if not active_shifts:
            print("No active shifts found for this day!")
            return
        
        # Step 2: Simulate how the DistributionManager processes these
        from backend.services.scheduler.generator import ScheduleGenerator
        from backend.services.scheduler.resources import ScheduleResources
        from backend.services.scheduler.config import SchedulerConfig
        
        print("\n--- SHIFT-COVERAGE ALIGNMENT ANALYSIS ---")
        
        # For each coverage block, find shifts that could possibly fulfill it
        for coverage in applicable_coverage:
            print(f"\nAnalyzing coverage block: {coverage.start_time}-{coverage.end_time}")
            
            # This is essentially what the distribution manager does:
            # 1. Find shifts that can fulfill this coverage
            suitable_shifts = []
            for shift in active_shifts:
                # Check if the shift overlaps with the coverage block
                # We don't need exact match - just overlap
                shift_start_hour, shift_start_min = map(int, shift.start_time.split(':'))
                shift_end_hour, shift_end_min = map(int, shift.end_time.split(':'))
                cov_start_hour, cov_start_min = map(int, coverage.start_time.split(':'))
                cov_end_hour, cov_end_min = map(int, coverage.end_time.split(':'))
                
                # Convert to minutes for easier comparison
                shift_start_mins = shift_start_hour * 60 + shift_start_min
                shift_end_mins = shift_end_hour * 60 + shift_end_min
                cov_start_mins = cov_start_hour * 60 + cov_start_min
                cov_end_mins = cov_end_hour * 60 + cov_end_min
                
                # A shift is suitable if it overlaps with the coverage period
                # This means the shift starts before coverage ends and ends after coverage starts
                if shift_start_mins < cov_end_mins and shift_end_mins > cov_start_mins:
                    overlap_percent = min(shift_end_mins, cov_end_mins) - max(shift_start_mins, cov_start_mins)
                    overlap_percent = overlap_percent / (cov_end_mins - cov_start_mins) * 100
                    suitable_shifts.append((shift, overlap_percent))
                    print(f"  Shift #{shift.id} ({shift.start_time}-{shift.end_time}) covers {overlap_percent:.1f}% of this block")
            
            if not suitable_shifts:
                print("  No suitable shifts found to cover this block!")
            else:
                print(f"  Found {len(suitable_shifts)} potentially suitable shifts")
        
        # Step 3: Check how coverage gets translated to shift needs in the generator
        print("\n--- MISMATCH DETECTION ---")
        
        # Check if start and end times exactly match between shifts and coverage
        exact_matches = []
        for coverage in applicable_coverage:
            matched = False
            for shift in active_shifts:
                if shift.start_time == coverage.start_time and shift.end_time == coverage.end_time:
                    exact_matches.append((coverage, shift))
                    matched = True
            
            if not matched:
                print(f"Coverage block {coverage.start_time}-{coverage.end_time} has no exact matching shift")
                # Find closest matches
                print("  Closest shifts:")
                for shift in active_shifts:
                    print(f"    Shift #{shift.id}: {shift.start_time}-{shift.end_time}")
        
        if exact_matches:
            print(f"Found {len(exact_matches)} exact matches between coverage blocks and shifts")
            for coverage, shift in exact_matches:
                print(f"  Coverage {coverage.start_time}-{coverage.end_time} matches Shift #{shift.id}")
        
        print("\n--- KEY FINDINGS ---")
        
        # Based on ScheduleGenerator._process_coverage method logic
        # Check if shifts will be rejected because their times don't match coverage exactly
        if not exact_matches:
            print("The problem is likely that NO shifts match coverage blocks EXACTLY in time.")
            print("In the current implementation, the generator does the following:")
            print("1. For each day, it creates all active shifts")
            print("2. It then filters these to keep only shifts that EXACTLY match coverage times")
            print("3. If no shifts match the coverage times exactly, no assignments will be made")
            
            print("\nPOSSIBLE SOLUTIONS:")
            print("1. Modify your shift templates to match coverage block times exactly")
            print("2. Update the scheduler code to consider overlapping shifts, not just exact matches")
            print("   - Look for the '_generate_assignments_for_date' method in ScheduleGenerator")
        else:
            # Must be another issue
            print("Shifts and coverage blocks do align correctly. The issue may be:")
            print("1. Employee availability - check if employees are available during these times")
            print("2. Constraints preventing assignment - check scheduler logs for constraint violations")
            print("3. Code logic issue in the distribution manager")
        
        print("\n--- RECOMMENDATION ---")
        if not exact_matches:
            # Create a fix suggestion for users
            print("To fix this issue without changing the code, you should either:")
            print("1. Update your coverage block times to match your existing shifts:")
            for shift in active_shifts:
                print(f"   - Add coverage block for day {test_date.weekday()} from {shift.start_time} to {shift.end_time}")
            
            print("\n2. OR update your shift templates to match your coverage blocks:")
            for coverage in applicable_coverage:
                print(f"   - Add/modify shift template with times from {coverage.start_time} to {coverage.end_time}")
        
if __name__ == "__main__":
    check_coverage_shift_distribution() 