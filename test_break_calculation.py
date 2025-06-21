#!/usr/bin/env python3
"""
Test script to verify the new auto-calculation break duration logic.
"""

import sys
import os
sys.path.append('/home/jango/Git/maike2/schichtplan')

from src.backend.models.schedule import Schedule
from src.backend.models.fixed_shift import ShiftTemplate
from src.backend.models.employee import Employee
from src.backend.models.settings import Settings
from src.backend.models import db
from src.backend.app import create_app
from datetime import datetime, date

def test_break_calculation():
    """Test the new break duration calculation logic"""
    print("Testing break duration calculation...")
    
    # Create app context
    app = create_app()
    
    with app.app_context():
        # Create test employee
        employee = Employee()
        employee.first_name = "Test"
        employee.last_name = "Employee"
        employee.email = "test@example.com"
        employee.is_keyholder = False  # Start with non-keyholder
        
        # Create a test schedule (need to provide required parameters)
        schedule = Schedule(
            employee_id=1,  # We'll mock the employee relationship
            shift_id=None,  # Will be set per test
            date=date.today()
        )
        
        # Mock the employee relationship
        schedule.employee = employee
        
        # Test 1: Regular shift without keyholder
        print("\n--- Test 1: Regular 8-hour shift (non-keyholder) ---")
        shift_template = ShiftTemplate(
            start_time="09:00",
            end_time="17:00"
        )
        shift_template.duration_hours = 8.0
        shift_template.requires_break = True
        
        # Mock the shift relationship
        schedule.shift = shift_template
        schedule.shift_id = 1
        
        # Calculate break duration
        break_duration = schedule.calculate_auto_break_duration()
        print(f"Break duration for 8-hour non-keyholder shift: {break_duration} minutes")
        print(f"Expected: 30 minutes")
        
        # Test 2: Keyholder shift
        print("\n--- Test 2: Keyholder 8-hour shift ---")
        employee.is_keyholder = True
        break_duration = schedule.calculate_auto_break_duration()
        print(f"Break duration for 8-hour keyholder shift: {break_duration} minutes")
        print(f"Expected: 35 minutes (30 + 5 keyholder time)")
        
        # Test 3: Short shift (6 hours)
        print("\n--- Test 3: Regular 6-hour shift (non-keyholder) ---")
        employee.is_keyholder = False
        shift_template.start_time = "09:00"
        shift_template.end_time = "15:00"
        shift_template.duration_hours = 6.0
        break_duration = schedule.calculate_auto_break_duration()
        print(f"Break duration for 6-hour non-keyholder shift: {break_duration} minutes")
        print(f"Expected: 0 minutes (no break required)")
        
        # Test 4: Keyholder short shift (6 hours)
        print("\n--- Test 4: Keyholder 6-hour shift ---")
        employee.is_keyholder = True
        break_duration = schedule.calculate_auto_break_duration()
        print(f"Break duration for 6-hour keyholder shift: {break_duration} minutes")
        print(f"Expected: 5 minutes (0 + 5 keyholder time)")
        
        # Test 5: No shift assigned
        print("\n--- Test 5: No shift assigned ---")
        schedule.shift = None
        schedule.shift_id = None
        break_duration = schedule.calculate_auto_break_duration()
        print(f"Break duration for no shift: {break_duration} minutes")
        print(f"Expected: 0 minutes")
        
        print("\n--- Tests completed ---")

if __name__ == "__main__":
    test_break_calculation()
