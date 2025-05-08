#!/usr/bin/env python3
"""
Database inspection and cleanup script.
"""
import os
import sys

# Add paths
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))
sys.path.append(os.path.join(os.path.dirname(__file__), "src", "backend"))

from src.backend.app import create_app
from src.backend.models import db, Schedule, Employee, ShiftTemplate

# Create the app and push context
app = create_app()

with app.app_context():
    print("\n===== DATABASE INSPECTION =====")
    
    # 1. Basic counts
    schedule_count = Schedule.query.count()
    employee_count = Employee.query.count()
    shift_count = ShiftTemplate.query.count()
    
    print(f"Total schedules in DB: {schedule_count}")
    print(f"Total employees in DB: {employee_count}")
    print(f"Total shifts in DB: {shift_count}")
    
    # 2. Check versions
    versions = [v[0] for v in db.session.query(Schedule.version).distinct().all()]
    print(f"Schedule versions in DB: {versions}")
    
    # 3. Analyze each version
    for version in versions:
        version_count = Schedule.query.filter_by(version=version).count()
        with_shifts = Schedule.query.filter(Schedule.version == version, Schedule.shift_id != None).count()
        without_shifts = Schedule.query.filter(Schedule.version == version, Schedule.shift_id == None).count()
        
        print(f"\nVersion {version}:")
        print(f"  Total schedules: {version_count}")
        print(f"  With shift assignments: {with_shifts} ({(with_shifts/version_count*100) if version_count else 0:.1f}%)")
        print(f"  Without shift assignments: {without_shifts}")
        
        # Sample of schedules for this version
        print("  Sample schedules:")
        sample = Schedule.query.filter_by(version=version).limit(3).all()
        for i, schedule in enumerate(sample):
            print(f"    {i+1}. Employee: {schedule.employee_id}, Date: {schedule.date}, Shift: {schedule.shift_id}")
            
    # 4. Check for orphaned schedules (no employee or shift)
    orphaned = Schedule.query.filter(
        (Schedule.employee_id.notin_(db.session.query(Employee.id))) |
        ((Schedule.shift_id != None) & (Schedule.shift_id.notin_(db.session.query(ShiftTemplate.id))))
    ).count()
    
    print(f"\nOrphaned schedules (invalid employee or shift): {orphaned}")
    
    # 5. Ask about cleanup
    if orphaned > 0 or schedule_count > 0:
        print("\n===== CLEANUP OPTIONS =====")
        print("1. Delete orphaned schedules")
        print("2. Delete a specific version")
        print("3. Delete all schedules")
        print("4. No cleanup needed")
        
        choice = input("\nEnter choice (1-4): ")
        
        if choice == "1" and orphaned > 0:
            # Delete orphaned schedules
            orphaned_schedules = Schedule.query.filter(
                (Schedule.employee_id.notin_(db.session.query(Employee.id))) |
                ((Schedule.shift_id != None) & (Schedule.shift_id.notin_(db.session.query(ShiftTemplate.id))))
            ).all()
            
            for schedule in orphaned_schedules:
                db.session.delete(schedule)
            
            db.session.commit()
            print(f"Deleted {len(orphaned_schedules)} orphaned schedules")
            
        elif choice == "2" and versions:
            # Delete a specific version
            version_to_delete = input(f"Enter version to delete {versions}: ")
            try:
                version_to_delete = int(version_to_delete)
                if version_to_delete in versions:
                    count = Schedule.query.filter_by(version=version_to_delete).count()
                    Schedule.query.filter_by(version=version_to_delete).delete()
                    db.session.commit()
                    print(f"Deleted {count} schedules from version {version_to_delete}")
                else:
                    print("Invalid version, no changes made")
            except ValueError:
                print("Invalid input, no changes made")
                
        elif choice == "3" and schedule_count > 0:
            # Delete all schedules
            confirm = input("Are you sure you want to delete ALL schedules? (yes/no): ")
            if confirm.lower() == "yes":
                Schedule.query.delete()
                db.session.commit()
                print(f"Deleted all {schedule_count} schedules")
            else:
                print("Operation cancelled")
                
        else:
            print("No changes made to the database")
    else:
        print("\nNo issues found, database is clean") 