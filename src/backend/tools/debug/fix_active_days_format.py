#!/usr/bin/env python3
"""
Fix Active Days Format

This script ensures active_days is in the correct format (list of integers) for the scheduler.
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
logger = logging.getLogger("fix_active_days_format")

def print_section(title):
    """Print a section title with formatting"""
    print("\n" + "=" * 80)
    print(f" {title} ".center(80, "="))
    print("=" * 80 + "\n")

def convert_dict_to_list(active_days_dict):
    """Convert active_days from dict format {"0": True, ...} to list format [0, 1, ...]"""
    if not isinstance(active_days_dict, dict):
        return active_days_dict
    
    result = []
    for day, is_active in active_days_dict.items():
        if is_active:
            try:
                day_int = int(day)
                if 0 <= day_int <= 6:  # Ensure it's a valid day of week
                    result.append(day_int)
            except (ValueError, TypeError):
                pass
    
    return sorted(result)

def fix_active_days_format():
    """Fix active_days format to ensure it's a list of integers"""
    print_section("FIXING ACTIVE DAYS FORMAT")
    
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
        print("\nCurrent Shift Active Days:")
        for shift in shifts:
            print(f"ID: {shift.id}, Type: {shift.shift_type_id}, Active days: {shift.active_days} (type: {type(shift.active_days).__name__})")
        
        # Identify and fix dictionary format
        fixed_count = 0
        for shift in shifts:
            if isinstance(shift.active_days, dict):
                old_format = shift.active_days
                new_format = convert_dict_to_list(shift.active_days)
                shift.active_days = new_format
                print(f"  Fixed Shift ID {shift.id}: {old_format} -> {new_format}")
                fixed_count += 1
        
        # Commit changes
        if fixed_count > 0:
            db.session.commit()
            print(f"\nSuccessfully converted {fixed_count} shifts to list format.")
        else:
            print("\nNo shifts needed fixing.")
        
        # Show after state
        print("\nUpdated Shift Active Days:")
        for shift in ShiftTemplate.query.all():
            print(f"ID: {shift.id}, Type: {shift.shift_type_id}, Active days: {shift.active_days} (type: {type(shift.active_days).__name__})")

if __name__ == "__main__":
    print_section("ACTIVE DAYS FORMAT FIXER")
    print("This tool converts active_days from dictionary format to list format for the scheduler.")
    
    fix_active_days_format()
    
    print("\n" + "=" * 80)
    print(" FIX COMPLETE ".center(80, "="))
    print("=" * 80) 