#!/usr/bin/env python3

import sys
import os
sys.path.insert(0, 'src/backend')

from unittest.mock import MagicMock
from datetime import date, timedelta
from services.scheduler.validator import ScheduleValidator, ScheduleConfig, ValidationError
from services.scheduler.resources import ScheduleResources
from models.employee import EmployeeGroup

def test_contracted_hours():
    print("Starting contracted hours test...")
    
    # Create mock resources
    mock_resources = MagicMock(spec=ScheduleResources)
    
    # Create validator
    validator = ScheduleValidator(mock_resources, test_mode=True)
    
    # Set up mock employees
    mock_employees = []
    for i in range(2):
        mock_employee = MagicMock()
        mock_employee.id = i + 1
        mock_employee.first_name = f"Employee{i + 1}"
        mock_employee.last_name = "Test"
        mock_employee.employee_group = EmployeeGroup.TZ if i == 0 else EmployeeGroup.GFB
        mock_employee.is_keyholder = i == 0  # First employee is a keyholder
        mock_employee.contracted_hours = 30 if i == 0 else 15
        mock_employees.append(mock_employee)
    
    # Set up mock schedules
    mock_schedules = []
    for i in range(5):
        mock_schedule = MagicMock()
        mock_schedule.id = i + 1
        mock_schedule.employee_id = (i % 2) + 1  # Assign to 2 employees
        mock_schedule.date = date(2023, 1, 2) + timedelta(days=i // 2)  # Spread over 3 days
        mock_shift = MagicMock()
        mock_shift.start_time = "09:00"
        mock_shift.end_time = "17:00"
        mock_shift.duration_hours = 8
        mock_shift.requires_keyholder = (i == 0)  # Only first shift requires keyholder
        mock_schedule.shift = mock_shift
        mock_schedules.append(mock_schedule)
    
    # Update resources
    mock_resources.employees = mock_employees
    
    # Mock for self.resources.get_employee
    def get_employee_side_effect(employee_id):
        for emp in mock_employees:
            if emp.id == employee_id:
                return emp
        return None
    
    mock_resources.get_employee = MagicMock(side_effect=get_employee_side_effect)
    
    # Mock for self.resources.get_shift
    def get_shift_side_effect(shift_id):
        mock_shift = MagicMock()
        mock_shift.id = shift_id
        mock_shift.duration_hours = 8.0  # Default 8 hours
        mock_shift.name = f"Shift {shift_id}"
        mock_shift.requires_keyholder = (shift_id == 1)  # First shift requires keyholder
        return mock_shift
    
    mock_resources.get_shift = MagicMock(side_effect=get_shift_side_effect)
    
    print("Setup complete, running validation...")
    
    # Configure validation to only check contracted hours
    config = ScheduleConfig(
        enforce_min_coverage=False,
        enforce_minimum_coverage=False,  # This is the key fix!
        enforce_contracted_hours=True,
        enforce_keyholder=False,
        enforce_keyholder_coverage=False,
        enforce_rest_periods=False,
        enforce_max_shifts=False,
        enforce_max_hours=False,
        enforce_early_late_rules=False,
        enforce_employee_group_rules=False,
        enforce_break_rules=False,
        enforce_consecutive_days=False,
        enforce_weekend_distribution=False,
        enforce_shift_distribution=False,
        enforce_availability=False,
        enforce_qualifications=False,
        enforce_opening_hours=False,
    )
    
    # Set up a schedule with insufficient hours for employee 1
    # Create one shift for employee 1 (8 hours, less than 75% of 30 hours)
    insufficient_schedule = [mock_schedules[0]]
    
    print("Calling validator.validate()...")
    
    # Call validation
    errors = validator.validate(insufficient_schedule, config)
    
    print(f"Validation complete! Found {len(errors)} errors")
    
    # Check errors
    if len(errors) == 1:
        print(f"Error type: {errors[0].error_type}")
        print(f"Error severity: {errors[0].severity}")
        print(f"Error message: {errors[0].message}")
        print("Test PASSED!")
    else:
        print(f"Expected 1 error, got {len(errors)}")
        for error in errors:
            print(f"  - {error.error_type}: {error.message}")
        print("Test FAILED!")

if __name__ == "__main__":
    test_contracted_hours() 