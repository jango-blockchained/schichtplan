#!/usr/bin/env python3
"""
Fix Shift Types

This script fixes inconsistent shift type configurations in the database.
"""

import os
import sys
import logging

# Add parent directories to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
root_dir = os.path.abspath(os.path.join(backend_dir, ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# Configure basic logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("fix_shift_types")

def print_section(title):
    """Print a section title with formatting"""
    print("\n" + "=" * 80)
    print(f" {title} ".center(80, "="))
    print("=" * 80 + "\n")

def normalize_active_days(active_days):
    """Normalize active days to dictionary format."""
    if isinstance(active_days, list):
        # Convert list to dictionary
        result = {}
        for i in range(7):
            result[str(i)] = i in active_days
        return result
    return active_days

def fix_shift_types():
    """Fix shift type inconsistencies and format issues"""
    print_section("FIXING SHIFT TYPES")
    
    # Import Flask app
    try:
        from src.backend.app import create_app
        print("Creating Flask app...")
        app = create_app()
    except ImportError as e:
        logger.error(f"Could not import create_app: {e}")
        return
    
    with app.app_context():
        # Import models
        from models import ShiftTemplate, db
        
        # Get all shifts
        shifts = ShiftTemplate.query.all()
        print(f"Found {len(shifts)} shift templates")
        
        # Show before state
        print("\nCurrent Shift Configuration:")
        for shift in shifts:
            print(f"ID: {shift.id}, Type: {shift.shift_type_id}, Hours: {shift.start_time}-{shift.end_time}")
            print(f"  Active days: {shift.active_days} (type: {type(shift.active_days).__name__})")
        
        # Identify inconsistencies
        inconsistent_shifts = []
        for shift in shifts:
            start_hour = int(shift.start_time.split(':')[0])
            
            # Determine correct type based on start hour
            if start_hour < 10:
                correct_type = "EARLY"
            elif 10 <= start_hour < 14:
                correct_type = "MIDDLE"
            else:
                correct_type = "LATE"
            
            if shift.shift_type_id != correct_type:
                inconsistent_shifts.append({
                    "id": shift.id,
                    "current_type": shift.shift_type_id,
                    "correct_type": correct_type,
                    "hours": f"{shift.start_time}-{shift.end_time}"
                })
        
        if inconsistent_shifts:
            print("\nFound inconsistent shift types:")
            for shift in inconsistent_shifts:
                print(f"  Shift ID {shift['id']}: Currently {shift['current_type']}, "
                      f"should be {shift['correct_type']} based on hours {shift['hours']}")
            
            # Fix inconsistencies
            print("\nFixing inconsistent shift types...")
            for shift_info in inconsistent_shifts:
                shift = ShiftTemplate.query.get(shift_info["id"])
                old_type = shift.shift_type_id
                shift.shift_type_id = shift_info["correct_type"]
                print(f"  Updated Shift ID {shift.id} from {old_type} to {shift.shift_type_id}")
            
            # Commit changes
            db.session.commit()
            print("Changes committed successfully!")
        else:
            print("\nNo inconsistent shift types found.")
        
        # Fix active_days format if needed
        inconsistent_format = False
        for shift in shifts:
            if isinstance(shift.active_days, list):
                inconsistent_format = True
                break
        
        if inconsistent_format:
            print("\nFixing inconsistent active_days formats...")
            for shift in shifts:
                if isinstance(shift.active_days, list):
                    old_format = shift.active_days
                    shift.active_days = normalize_active_days(shift.active_days)
                    print(f"  Updated Shift ID {shift.id} active_days from {old_format} to {shift.active_days}")
            
            # Commit changes
            db.session.commit()
            print("Format changes committed successfully!")
        else:
            print("\nNo inconsistent active_days formats found.")
        
        # Show after state
        print("\nUpdated Shift Configuration:")
        for shift in ShiftTemplate.query.all():
            print(f"ID: {shift.id}, Type: {shift.shift_type_id}, Hours: {shift.start_time}-{shift.end_time}")
            print(f"  Active days: {shift.active_days} (type: {type(shift.active_days).__name__})")

if __name__ == "__main__":
    print_section("SHIFT TYPE FIXER")
    print("This tool fixes inconsistent shift types and active_days formats.")
    
    fix_shift_types()
    
    print("\n" + "=" * 80)
    print(" FIX COMPLETE ".center(80, "="))
    print("=" * 80) 