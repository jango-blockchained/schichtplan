#!/usr/bin/env python
"""
Script to directly create schedules in the database using the models.
This avoids API interface issues and deals with day indexing directly.
"""

import os
import sys
import json
from datetime import datetime, timedelta, date

# Set Flask environment variables
os.environ['FLASK_APP'] = 'src.backend.run'
os.environ['FLASK_ENV'] = 'development'

# Import Flask and models
from flask import Flask
from src.backend.app import create_app
from src.backend.models import (
    db, Employee, ShiftTemplate, Coverage, Schedule, 
    ScheduleStatus, ScheduleVersionMeta
)

def create_schedule_entries(start_date, end_date):
    """Create schedule entries directly in the database."""
    # Get all employees, preferring active ones with keyholder status first
    employees = Employee.query.filter_by(is_active=True).order_by(
        Employee.is_keyholder.desc()
    ).all()
    
    if not employees:
        print("No active employees found in the database.")
        return False
    
    # Get all shift templates
    templates = ShiftTemplate.query.all()
    if not templates:
        print("No shift templates found in the database.")
        return False
    
    # Get coverage requirements
    coverages = Coverage.query.all()
    if not coverages:
        print("No coverage requirements found in the database.")
        return False
    
    # Organize coverage by day_index
    coverage_by_day = {}
    for c in coverages:
        day_idx = c.day_index
        if day_idx not in coverage_by_day:
            coverage_by_day[day_idx] = []
        coverage_by_day[day_idx].append(c)
    
    # Create a new schedule version
    version = 1
    version_meta = ScheduleVersionMeta.query.order_by(ScheduleVersionMeta.version.desc()).first()
    if version_meta:
        version = version_meta.version + 1
    
    new_version = ScheduleVersionMeta(
        version=version,
        created_at=datetime.utcnow(),
        created_by=None,
        status=ScheduleStatus.DRAFT,
        date_range_start=start_date,
        date_range_end=end_date,
        notes="Auto-generated schedule"
    )
    db.session.add(new_version)
    db.session.flush()  # Make sure version_id is available
    
    print(f"Creating schedule version {version} for {start_date} to {end_date}")
    
    # Track created entries
    created_schedules = 0
    assigned_employees = set()
    
    # Create schedule entries for each day
    current_date = start_date
    while current_date <= end_date:
        # Map weekday to coverage day_index (Monday = 0, Sunday = 6)
        weekday = current_date.weekday()  # 0 = Monday, 6 = Sunday
        
        # Skip Sunday (no coverage for day 6)
        if weekday == 6:
            current_date += timedelta(days=1)
            continue
        
        # Get coverage for this day
        day_coverages = coverage_by_day.get(weekday, [])
        
        print(f"Processing {current_date} (weekday {weekday})")
        print(f"  Found {len(day_coverages)} coverage requirements")
        
        # Process each coverage requirement
        for coverage in day_coverages:
            # Find matching shift templates for this coverage time
            matching_templates = []
            for template in templates:
                # Check if template is active for this weekday
                # Convert weekday to string index for template
                # Monday (0) -> "1", Sunday (6) -> "0"
                template_day_key = str((weekday + 1) % 7)
                
                is_active = template.active_days.get(template_day_key, False)
                if not is_active:
                    continue
                
                # Check if template time overlaps with coverage time
                template_start = datetime.strptime(template.start_time, "%H:%M").time()
                template_end = datetime.strptime(template.end_time, "%H:%M").time()
                coverage_start = datetime.strptime(coverage.start_time, "%H:%M").time()
                coverage_end = datetime.strptime(coverage.end_time, "%H:%M").time()
                
                # Simple overlap check
                if (template_start <= coverage_end and template_end >= coverage_start):
                    matching_templates.append(template)
            
            print(f"  Coverage {coverage.id} ({coverage.start_time}-{coverage.end_time}): {len(matching_templates)} matching templates")
            
            # Assign employees to shifts
            for i in range(min(coverage.min_employees, len(employees))):
                # Find an available employee
                assigned = False
                for emp in employees:
                    if emp.id in assigned_employees:
                        continue  # Skip already assigned employees for this day
                    
                    # Check if employee is a keyholder if required
                    if coverage.requires_keyholder and not emp.is_keyholder:
                        continue
                    
                    # Select best matching template
                    if matching_templates:
                        template = matching_templates[0]  # Simplistic choice
                        
                        # Create schedule entry
                        schedule = Schedule(
                            employee_id=emp.id,
                            shift_id=template.id,
                            date=current_date,
                            version=version,
                            status=ScheduleStatus.DRAFT,
                            shift_type=template.shift_type
                        )
                        db.session.add(schedule)
                        created_schedules += 1
                        assigned_employees.add(emp.id)
                        assigned = True
                        
                        print(f"  Assigned {emp.first_name} {emp.last_name} to {template.shift_type} shift")
                        break
                
                if not assigned:
                    print(f"  Could not find suitable employee for coverage {coverage.id}")
        
        # Clear assigned employees for next day
        assigned_employees.clear()
        
        # Move to next day
        current_date += timedelta(days=1)
    
    # Commit all changes
    try:
        db.session.commit()
        print(f"Successfully created {created_schedules} schedule entries")
        return True
    except Exception as e:
        db.session.rollback()
        print(f"Error creating schedule: {str(e)}")
        return False

def main():
    """Main entry point."""
    # Get date range from command line
    if len(sys.argv) > 2:
        try:
            start_date = datetime.strptime(sys.argv[1], "%Y-%m-%d").date()
            end_date = datetime.strptime(sys.argv[2], "%Y-%m-%d").date()
        except ValueError:
            print("Invalid date format. Please use YYYY-MM-DD.")
            return
    else:
        # Use current week
        today = datetime.now().date()
        start_date = today - timedelta(days=today.weekday())  # Monday
        end_date = start_date + timedelta(days=6)  # Sunday
    
    print(f"Using date range: {start_date} to {end_date}")
    
    # Create Flask app
    app = create_app()
    
    with app.app_context():
        success = create_schedule_entries(start_date, end_date)
        
        if success:
            print("\nSchedule created successfully!")
        else:
            print("\nFailed to create schedule.")

if __name__ == "__main__":
    main() 