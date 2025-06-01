#!/usr/bin/env python
"""
Test script to verify that the scheduler now correctly matches shifts to coverage intervals.
"""

import os
import sys
from datetime import date

# Add the parent directories to path to resolve imports
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
src_dir = os.path.abspath(os.path.join(backend_dir, ".."))
root_dir = os.path.abspath(os.path.join(src_dir, ".."))
sys.path.insert(0, root_dir)
sys.path.insert(0, src_dir)
sys.path.insert(0, backend_dir)

# Import Flask and create app context
from backend.app import create_app
from backend.services.scheduler.generator import ScheduleGenerator

app = create_app()

def test_coverage_matching():
    """Test that shifts are matched to coverage intervals correctly"""
    
    with app.app_context():
        # Create scheduler
        generator = ScheduleGenerator()
        
        # Test date - Monday
        test_date = date(2025, 1, 6)  # Monday
        
        print(f"\nTesting coverage matching for {test_date} (Monday)")
        print("=" * 60)
        
        # Test _process_coverage
        coverage_by_interval = generator._process_coverage(test_date)
        print(f"\nCoverage intervals found: {len(coverage_by_interval)}")
        for interval, requirements in coverage_by_interval.items():
            for req in requirements:
                print(f"  {interval}: {req['min_employees']} employees required")
        
        # Test _create_date_shifts
        date_shifts = generator._create_date_shifts(test_date)
        print(f"\nShifts created: {len(date_shifts)}")
        for shift in date_shifts:
            print(f"  Shift {shift['shift_id']}: {shift['start_time']}-{shift['end_time']} ({shift['shift_type']}) - Coverage: {shift.get('coverage_interval', 'N/A')}, Min employees: {shift.get('min_employees', 'N/A')}")
        
        # Test with different dates
        test_date2 = date(2025, 1, 11)  # Saturday
        print(f"\n\nTesting coverage matching for {test_date2} (Saturday)")
        print("=" * 60)
        
        coverage_by_interval2 = generator._process_coverage(test_date2)
        print(f"\nCoverage intervals found: {len(coverage_by_interval2)}")
        for interval, requirements in coverage_by_interval2.items():
            for req in requirements:
                print(f"  {interval}: {req['min_employees']} employees required")
        
        date_shifts2 = generator._create_date_shifts(test_date2)
        print(f"\nShifts created: {len(date_shifts2)}")
        for shift in date_shifts2:
            print(f"  Shift {shift['shift_id']}: {shift['start_time']}-{shift['end_time']} ({shift['shift_type']}) - Coverage: {shift.get('coverage_interval', 'N/A')}, Min employees: {shift.get('min_employees', 'N/A')}")
        
        # Test full generation for a single day
        print(f"\n\nTesting full generation for {test_date}")
        print("=" * 60)
        
        try:
            result = generator.generate_schedule(
                start_date=test_date,
                end_date=test_date,
                version=999,  # Test version
            )
            
            print(f"Generation result:")
            print(f"  Total schedules: {result.get('total_schedules', 0)}")
            print(f"  Filled shifts: {result.get('filled_shifts_count', 0)}")
            print(f"  Errors: {len(result.get('errors', []))}")
            
            if result.get('schedules'):
                # Group by shift type
                by_shift = {}
                for schedule in result['schedules']:
                    if schedule.get('shift_id'):
                        shift_key = f"{schedule.get('shift_start', 'N/A')}-{schedule.get('shift_end', 'N/A')}"
                        if shift_key not in by_shift:
                            by_shift[shift_key] = 0
                        by_shift[shift_key] += 1
                
                print(f"\nAssignments by shift time:")
                for shift_time, count in sorted(by_shift.items()):
                    print(f"  {shift_time}: {count} employees")
        
        except Exception as e:
            print(f"Error during generation: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_coverage_matching() 