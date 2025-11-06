#!/usr/bin/env python3
"""
Script to verify the split week and availability features are properly configured.
"""

import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.backend.app import create_app
from src.backend.models import Settings, EmployeeAvailability, Employee
from src.backend.models import db
from datetime import datetime


def check_settings():
    """Check if settings table has the required fields."""
    print("=" * 80)
    print("CHECKING SETTINGS")
    print("=" * 80)
    
    app = create_app()
    with app.app_context():
        settings = Settings.query.first()
        
        if not settings:
            print("⚠️  No settings found in database")
            print("   Creating default settings...")
            settings = Settings()
            db.session.add(settings)
            db.session.commit()
            settings = Settings.query.first()
        
        print(f"✓ Settings found (ID: {settings.id})")
        print(f"  - week_weekend_start: {settings.week_weekend_start}")
        print(f"  - week_month_boundary_mode: {settings.week_month_boundary_mode}")
        
        if settings.week_month_boundary_mode == "split_by_month":
            print("  ✓ Split week mode is ENABLED")
        else:
            print("  ℹ️  Split week mode is DISABLED (currently: {})".format(settings.week_month_boundary_mode))
            print("     To enable, set week_month_boundary_mode to 'split_by_month' in settings")
        
        return settings


def check_availability_data():
    """Check if there is any availability data in the database."""
    print("\n" + "=" * 80)
    print("CHECKING AVAILABILITY DATA")
    print("=" * 80)
    
    app = create_app()
    with app.app_context():
        availabilities = EmployeeAvailability.query.all()
        employees_with_availability = db.session.query(EmployeeAvailability.employee_id).distinct().all()
        total_employees = Employee.query.count()
        
        print(f"Total availability records: {len(availabilities)}")
        print(f"Employees with availability data: {len(employees_with_availability)} / {total_employees}")
        
        if len(availabilities) == 0:
            print("\n⚠️  No availability data found")
            print("   The hover modal will show 'Keine Verfügbarkeiten' for all employees")
            print("   To test with data, use the Enhanced Availability Modal to add availabilities")
        else:
            print("\n✓ Availability data exists")
            
            # Show sample availability data
            if len(availabilities) > 0:
                print("\nSample availability records (first 5):")
                for avail in availabilities[:5]:
                    employee = Employee.query.get(avail.employee_id)
                    employee_name = f"{employee.last_name}, {employee.first_name}" if employee else "Unknown"
                    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                    day_name = day_names[avail.day_of_week] if 0 <= avail.day_of_week < 7 else "Unknown"
                    print(f"  - {employee_name} ({day_name} {avail.hour:02d}:00): {avail.availability_type} "
                          f"({'Available' if avail.is_available else 'Unavailable'})")
        
        return len(availabilities)


def check_week_segments():
    """Check if week segment functionality is accessible."""
    print("\n" + "=" * 80)
    print("CHECKING WEEK SEGMENT FUNCTIONALITY")
    print("=" * 80)
    
    from src.backend.utils.week_utils import (
        get_current_week_identifier,
        get_week_from_identifier,
        get_week_segments,
        MonthBoundaryMode
    )
    
    app = create_app()
    with app.app_context():
        # Get current week
        current_week = get_current_week_identifier()
        print(f"Current week identifier: {current_week}")
        
        week_info = get_week_from_identifier(current_week)
        print(f"  Start: {week_info.start_date}")
        print(f"  End: {week_info.end_date}")
        print(f"  Spans months: {week_info.spansMonths}")
        
        if week_info.spans_months:
            print(f"  Months: {', '.join(week_info.months)}")
            
            # Test split mode
            segments_split = get_week_segments(week_info, MonthBoundaryMode.SPLIT_ON_MONTH)
            print(f"\n  Split mode segments: {len(segments_split)}")
            for seg in segments_split:
                print(f"    - Segment {seg.segment_number}/{seg.total_segments}: "
                      f"{seg.start_date} to {seg.end_date} ({seg.month} {seg.year})")
        else:
            print("  ℹ️  Current week does not span months")
            print("     Navigate to a week at month end to test split functionality")
        
        # Test with keep intact mode
        segments_intact = get_week_segments(week_info, MonthBoundaryMode.KEEP_INTACT)
        print(f"\n  Keep intact mode segments: {len(segments_intact)}")
        for seg in segments_intact:
            print(f"    - Full week: {seg.start_date} to {seg.end_date}")


def main():
    """Run all checks."""
    print("\n" + "=" * 80)
    print("SPLIT WEEK & AVAILABILITY FEATURE VERIFICATION")
    print("=" * 80)
    print()
    
    try:
        # Check settings
        settings = check_settings()
        
        # Check availability data
        avail_count = check_availability_data()
        
        # Check week segments
        check_week_segments()
        
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print()
        print("Backend verification complete!")
        print()
        print("Next steps:")
        print("1. Start the application: ./start.sh")
        print("2. Navigate to Schedule page")
        print("3. Test hover over employee names (see TESTING_GUIDE.md)")
        print("4. Enable split week mode in settings if desired")
        print("5. Navigate to week spanning months to test split functionality")
        
        if avail_count == 0:
            print()
            print("⚠️  Remember to add availability data to test the hover modal:")
            print("   - Use 'Hinzufügen' → 'Verfügbarkeit (Fest)' in the Schedule page")
            print("   - Or use the Enhanced Availability Modal")
        
        print()
        
    except Exception as e:
        print(f"\n❌ Error during verification: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
