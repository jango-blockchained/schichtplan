"""
Data validation utilities for the scheduler module.

This module provides comprehensive validation for all data structures used
in the scheduling system, ensuring data integrity and catching issues early.
"""

import logging
from datetime import date, time, datetime
from typing import Any, Dict, List, Optional, Union, Tuple
import re

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Custom exception for validation failures"""
    pass


class DataValidator:
    """Comprehensive data validator for scheduler components"""
    
    def __init__(self, logger_instance: Optional[logging.Logger] = None):
        self.logger = logger_instance or logger
    
    def validate_shift_template(self, shift_template: Any) -> Tuple[bool, List[str]]:
        """
        Validate a shift template object or dictionary.
        
        Args:
            shift_template: ShiftTemplate object or dictionary
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        try:
            # Check required fields
            required_fields = ['id', 'start_time', 'end_time']
            for field in required_fields:
                if not self._has_field(shift_template, field):
                    errors.append(f"Missing required field: {field}")
            
            # Validate time fields
            start_time = self._get_field(shift_template, 'start_time')
            end_time = self._get_field(shift_template, 'end_time')
            
            if start_time and not self._is_valid_time_string(start_time):
                errors.append(f"Invalid start_time format: {start_time}")
            
            if end_time and not self._is_valid_time_string(end_time):
                errors.append(f"Invalid end_time format: {end_time}")
            
            # Validate time range
            if start_time and end_time:
                if not self._is_valid_time_range(start_time, end_time):
                    errors.append(f"Invalid time range: {start_time} to {end_time}")
            
            # Validate active_days if present
            active_days = self._get_field(shift_template, 'active_days')
            if active_days is not None:
                if not self._is_valid_active_days(active_days):
                    errors.append(f"Invalid active_days format: {active_days}")
            
            # Validate shift_type if present
            shift_type = self._get_field(shift_template, 'shift_type')
            if shift_type and not isinstance(shift_type, str):
                errors.append(f"shift_type must be a string: {shift_type}")
            
        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
        
        return len(errors) == 0, errors
    
    def validate_employee(self, employee: Any) -> Tuple[bool, List[str]]:
        """
        Validate an employee object or dictionary.
        
        Args:
            employee: Employee object or dictionary
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        try:
            # Check required fields
            required_fields = ['id']
            for field in required_fields:
                if not self._has_field(employee, field):
                    errors.append(f"Missing required field: {field}")
            
            # Validate contracted_hours if present
            contracted_hours = self._get_field(employee, 'contracted_hours')
            if contracted_hours is not None:
                if not isinstance(contracted_hours, (int, float)) or contracted_hours < 0:
                    errors.append(f"Invalid contracted_hours: {contracted_hours}")
            
            # Validate is_active if present
            is_active = self._get_field(employee, 'is_active')
            if is_active is not None and not isinstance(is_active, bool):
                errors.append(f"is_active must be boolean: {is_active}")
            
            # Validate is_keyholder if present
            is_keyholder = self._get_field(employee, 'is_keyholder')
            if is_keyholder is not None and not isinstance(is_keyholder, bool):
                errors.append(f"is_keyholder must be boolean: {is_keyholder}")
            
        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
        
        return len(errors) == 0, errors
    
    def validate_coverage(self, coverage: Any) -> Tuple[bool, List[str]]:
        """
        Validate a coverage object or dictionary.
        
        Args:
            coverage: Coverage object or dictionary
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        try:
            # Check required fields
            required_fields = ['start_time', 'end_time', 'min_employees']
            for field in required_fields:
                if not self._has_field(coverage, field):
                    errors.append(f"Missing required field: {field}")
            
            # Validate time fields
            start_time = self._get_field(coverage, 'start_time')
            end_time = self._get_field(coverage, 'end_time')
            
            if start_time and not self._is_valid_time_string(start_time):
                errors.append(f"Invalid start_time format: {start_time}")
            
            if end_time and not self._is_valid_time_string(end_time):
                errors.append(f"Invalid end_time format: {end_time}")
            
            # Validate time range
            if start_time and end_time:
                if not self._is_valid_time_range(start_time, end_time):
                    errors.append(f"Invalid time range: {start_time} to {end_time}")
            
            # Validate employee counts
            min_employees = self._get_field(coverage, 'min_employees')
            max_employees = self._get_field(coverage, 'max_employees')
            
            if min_employees is not None:
                if not isinstance(min_employees, int) or min_employees < 0:
                    errors.append(f"Invalid min_employees: {min_employees}")
            
            if max_employees is not None:
                if not isinstance(max_employees, int) or max_employees < 0:
                    errors.append(f"Invalid max_employees: {max_employees}")
                
                if min_employees is not None and max_employees < min_employees:
                    errors.append(f"max_employees ({max_employees}) cannot be less than min_employees ({min_employees})")
            
        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
        
        return len(errors) == 0, errors
    
    def validate_assignment(self, assignment: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate an assignment dictionary.
        
        Args:
            assignment: Assignment dictionary
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        try:
            # Check required fields
            required_fields = ['employee_id', 'shift_id', 'date']
            for field in required_fields:
                if field not in assignment:
                    errors.append(f"Missing required field: {field}")
            
            # Validate employee_id
            employee_id = assignment.get('employee_id')
            if employee_id is not None and not isinstance(employee_id, int):
                errors.append(f"employee_id must be an integer: {employee_id}")
            
            # Validate shift_id
            shift_id = assignment.get('shift_id')
            if shift_id is not None and not isinstance(shift_id, int):
                errors.append(f"shift_id must be an integer: {shift_id}")
            
            # Validate date
            assignment_date = assignment.get('date')
            if assignment_date is not None:
                if not isinstance(assignment_date, date):
                    errors.append(f"date must be a date object: {assignment_date}")
            
            # Validate time fields if present
            for time_field in ['start_time', 'end_time']:
                time_value = assignment.get(time_field)
                if time_value and not self._is_valid_time_string(time_value):
                    errors.append(f"Invalid {time_field} format: {time_value}")
            
            # Validate status if present
            status = assignment.get('status')
            if status and not isinstance(status, str):
                errors.append(f"status must be a string: {status}")
            
            # Validate version if present
            version = assignment.get('version')
            if version is not None and not isinstance(version, int):
                errors.append(f"version must be an integer: {version}")
            
        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
        
        return len(errors) == 0, errors
    
    def validate_assignments_list(self, assignments: List[Dict[str, Any]]) -> Tuple[bool, List[str]]:
        """
        Validate a list of assignments.
        
        Args:
            assignments: List of assignment dictionaries
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        all_errors = []
        
        if not isinstance(assignments, list):
            return False, ["assignments must be a list"]
        
        for i, assignment in enumerate(assignments):
            is_valid, errors = self.validate_assignment(assignment)
            if not is_valid:
                for error in errors:
                    all_errors.append(f"Assignment {i}: {error}")
        
        return len(all_errors) == 0, all_errors
    
    def _has_field(self, obj: Any, field: str) -> bool:
        """Check if object has a field (works for both objects and dicts)"""
        if isinstance(obj, dict):
            return field in obj and obj[field] is not None
        else:
            return hasattr(obj, field) and getattr(obj, field) is not None
    
    def _get_field(self, obj: Any, field: str) -> Any:
        """Get field value from object or dict"""
        if isinstance(obj, dict):
            return obj.get(field)
        else:
            return getattr(obj, field, None)
    
    def _is_valid_time_string(self, time_str: str) -> bool:
        """Validate time string format (HH:MM)"""
        if not isinstance(time_str, str):
            return False
        
        # Check format with regex
        pattern = r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
        if not re.match(pattern, time_str):
            return False
        
        # Try to parse as time
        try:
            hours, minutes = map(int, time_str.split(':'))
            time(hours, minutes)
            return True
        except ValueError:
            return False
    
    def _is_valid_time_range(self, start_time: str, end_time: str) -> bool:
        """Validate that end_time is after start_time"""
        try:
            start_h, start_m = map(int, start_time.split(':'))
            end_h, end_m = map(int, end_time.split(':'))
            
            start_minutes = start_h * 60 + start_m
            end_minutes = end_h * 60 + end_m
            
            # Handle overnight shifts (end time next day)
            if end_minutes <= start_minutes:
                end_minutes += 24 * 60  # Add 24 hours
            
            return end_minutes > start_minutes
        except (ValueError, AttributeError):
            return False
    
    def _is_valid_active_days(self, active_days: Any) -> bool:
        """Validate active_days format"""
        if active_days is None:
            return True  # None is acceptable
        
        if isinstance(active_days, str):
            # Try to parse as comma-separated string
            try:
                days = [int(d.strip()) for d in active_days.split(',') if d.strip()]
                return all(0 <= day <= 6 for day in days)
            except ValueError:
                return False
        
        if isinstance(active_days, list):
            return all(isinstance(day, int) and 0 <= day <= 6 for day in active_days)
        
        return False
    
    def validate_resources(self, resources: Any) -> Tuple[bool, List[str]]:
        """
        Validate a resources object.
        
        Args:
            resources: ScheduleResources object
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        try:
            # Check if resources object exists
            if not resources:
                errors.append("Resources object is None or empty")
                return False, errors
            
            # Validate employees
            if hasattr(resources, 'employees'):
                employees = resources.employees
                if employees is not None:
                    if not isinstance(employees, list):
                        errors.append("employees must be a list")
                    else:
                        for i, employee in enumerate(employees):
                            is_valid, emp_errors = self.validate_employee(employee)
                            if not is_valid:
                                for error in emp_errors:
                                    errors.append(f"Employee {i}: {error}")
            
            # Validate shift templates
            if hasattr(resources, 'shift_templates'):
                shift_templates = resources.shift_templates
                if shift_templates is not None:
                    if not isinstance(shift_templates, list):
                        errors.append("shift_templates must be a list")
                    else:
                        for i, shift_template in enumerate(shift_templates):
                            is_valid, shift_errors = self.validate_shift_template(shift_template)
                            if not is_valid:
                                for error in shift_errors:
                                    errors.append(f"ShiftTemplate {i}: {error}")
            
            # Validate coverage
            if hasattr(resources, 'coverage'):
                coverage_list = resources.coverage
                if coverage_list is not None:
                    if not isinstance(coverage_list, list):
                        errors.append("coverage must be a list")
                    else:
                        for i, coverage in enumerate(coverage_list):
                            is_valid, cov_errors = self.validate_coverage(coverage)
                            if not is_valid:
                                for error in cov_errors:
                                    errors.append(f"Coverage {i}: {error}")
            
        except Exception as e:
            errors.append(f"Resources validation error: {str(e)}")
        
        return len(errors) == 0, errors
    
    def log_validation_results(self, validation_type: str, is_valid: bool, errors: List[str]):
        """Log validation results"""
        if is_valid:
            self.logger.info(f"{validation_type} validation passed")
        else:
            self.logger.error(f"{validation_type} validation failed:")
            for error in errors:
                self.logger.error(f"  - {error}")


def validate_shift_assignment_data(assignment_data: Dict[str, Any]) -> bool:
    """
    Quick validation function for shift assignment data.
    
    Args:
        assignment_data: Dictionary containing assignment information
        
    Returns:
        True if valid, False otherwise
    """
    validator = DataValidator()
    is_valid, errors = validator.validate_assignment(assignment_data)
    
    if not is_valid:
        logger.warning(f"Invalid assignment data: {errors}")
    
    return is_valid


def validate_time_data_completeness(assignments: List[Dict[str, Any]]) -> Tuple[bool, List[str]]:
    """
    Validate that all assignments have complete time data.
    
    Args:
        assignments: List of assignment dictionaries
        
    Returns:
        Tuple of (all_complete, list_of_missing_data_descriptions)
    """
    missing_data = []
    
    for i, assignment in enumerate(assignments):
        assignment_id = assignment.get('id', f'index_{i}')
        
        if not assignment.get('start_time'):
            missing_data.append(f"Assignment {assignment_id}: missing start_time")
        
        if not assignment.get('end_time'):
            missing_data.append(f"Assignment {assignment_id}: missing end_time")
        
        if not assignment.get('date'):
            missing_data.append(f"Assignment {assignment_id}: missing date")
    
    return len(missing_data) == 0, missing_data 