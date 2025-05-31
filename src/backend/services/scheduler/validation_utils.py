"""
Data validation utilities for the scheduler module.

This module provides comprehensive validation functions for scheduler data
including shift times, coverage rules, employee data, and assignment data.
"""

import logging
import re
from datetime import date, time, datetime
from typing import Any, Dict, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Base exception for validation errors"""
    pass


class ShiftValidationError(ValidationError):
    """Exception for shift-related validation errors"""
    pass


class CoverageValidationError(ValidationError):
    """Exception for coverage-related validation errors"""
    pass


class EmployeeValidationError(ValidationError):
    """Exception for employee-related validation errors"""
    pass


class AssignmentValidationError(ValidationError):
    """Exception for assignment-related validation errors"""
    pass


def validate_time_string(time_str: str, field_name: str = "time") -> bool:
    """
    Validate that a time string is in the correct format (HH:MM).
    
    Args:
        time_str: The time string to validate
        field_name: Name of the field for error messages
        
    Returns:
        True if valid
        
    Raises:
        ValidationError: If the time string is invalid
    """
    if not time_str:
        raise ValidationError(f"{field_name} cannot be empty")
    
    if not isinstance(time_str, str):
        raise ValidationError(f"{field_name} must be a string, got {type(time_str)}")
    
    # Check format HH:MM
    if not re.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', time_str):
        raise ValidationError(f"{field_name} must be in HH:MM format, got '{time_str}'")
    
    # Try to parse to ensure it's a valid time
    try:
        hours, minutes = map(int, time_str.split(':'))
        time(hours, minutes)
    except ValueError as e:
        raise ValidationError(f"Invalid {field_name} '{time_str}': {e}")
    
    return True


def validate_time_range(start_time: str, end_time: str, allow_overnight: bool = True) -> bool:
    """
    Validate that a time range is logical.
    
    Args:
        start_time: Start time string (HH:MM)
        end_time: End time string (HH:MM)
        allow_overnight: Whether to allow overnight shifts (end_time < start_time)
        
    Returns:
        True if valid
        
    Raises:
        ValidationError: If the time range is invalid
    """
    validate_time_string(start_time, "start_time")
    validate_time_string(end_time, "end_time")
    
    start_h, start_m = map(int, start_time.split(':'))
    end_h, end_m = map(int, end_time.split(':'))
    
    start_minutes = start_h * 60 + start_m
    end_minutes = end_h * 60 + end_m
    
    if not allow_overnight and end_minutes <= start_minutes:
        raise ValidationError(f"End time ({end_time}) must be after start time ({start_time})")
    
    # For overnight shifts, we allow end_time < start_time
    if allow_overnight and end_minutes == start_minutes:
        raise ValidationError(f"Start time and end time cannot be the same ({start_time})")
    
    return True


def validate_shift_template(shift_template: Any) -> Dict[str, Any]:
    """
    Validate a shift template object or dictionary.
    
    Args:
        shift_template: Shift template object or dictionary
        
    Returns:
        Dictionary with validation results and normalized data
        
    Raises:
        ShiftValidationError: If validation fails
    """
    errors = []
    warnings = []
    
    # Extract data from object or dict
    if hasattr(shift_template, '__dict__'):
        data = {
            'id': getattr(shift_template, 'id', None),
            'name': getattr(shift_template, 'name', None),
            'start_time': getattr(shift_template, 'start_time', None),
            'end_time': getattr(shift_template, 'end_time', None),
            'shift_type': getattr(shift_template, 'shift_type', None),
            'active_days': getattr(shift_template, 'active_days', None),
            'duration_hours': getattr(shift_template, 'duration_hours', None),
        }
    elif isinstance(shift_template, dict):
        data = shift_template.copy()
    else:
        raise ShiftValidationError(f"Invalid shift template type: {type(shift_template)}")
    
    # Validate required fields
    required_fields = ['id', 'start_time', 'end_time']
    for field in required_fields:
        if not data.get(field):
            errors.append(f"Missing required field: {field}")
    
    # Validate time fields
    if data.get('start_time') and data.get('end_time'):
        try:
            validate_time_range(data['start_time'], data['end_time'])
        except ValidationError as e:
            errors.append(f"Invalid time range: {e}")
    
    # Validate active_days
    if data.get('active_days') is not None:
        if not isinstance(data['active_days'], (list, tuple)):
            errors.append("active_days must be a list or tuple")
        else:
            for day in data['active_days']:
                if not isinstance(day, int) or day < 0 or day > 6:
                    errors.append(f"Invalid day in active_days: {day} (must be 0-6)")
    else:
        warnings.append("active_days is missing - shift may not be scheduled")
    
    # Validate shift_type
    if data.get('shift_type'):
        valid_types = ['EARLY', 'MIDDLE', 'LATE', 'NIGHT', 'STANDARD']
        if data['shift_type'] not in valid_types:
            warnings.append(f"Unusual shift_type: {data['shift_type']}")
    
    # Validate duration_hours if present
    if data.get('duration_hours') is not None:
        try:
            duration = float(data['duration_hours'])
            if duration <= 0 or duration > 24:
                errors.append(f"Invalid duration_hours: {duration} (must be 0-24)")
        except (ValueError, TypeError):
            errors.append(f"duration_hours must be a number, got {type(data['duration_hours'])}")
    
    if errors:
        raise ShiftValidationError(f"Shift template validation failed: {'; '.join(errors)}")
    
    return {
        'valid': True,
        'warnings': warnings,
        'normalized_data': data
    }


def validate_coverage_rule(coverage: Any) -> Dict[str, Any]:
    """
    Validate a coverage rule object or dictionary.
    
    Args:
        coverage: Coverage rule object or dictionary
        
    Returns:
        Dictionary with validation results and normalized data
        
    Raises:
        CoverageValidationError: If validation fails
    """
    errors = []
    warnings = []
    
    # Extract data from object or dict
    if hasattr(coverage, '__dict__'):
        data = {
            'id': getattr(coverage, 'id', None),
            'day_index': getattr(coverage, 'day_index', None),
            'start_time': getattr(coverage, 'start_time', None),
            'end_time': getattr(coverage, 'end_time', None),
            'min_employees': getattr(coverage, 'min_employees', None),
            'max_employees': getattr(coverage, 'max_employees', None),
            'requires_keyholder': getattr(coverage, 'requires_keyholder', False),
        }
    elif isinstance(coverage, dict):
        data = coverage.copy()
    else:
        raise CoverageValidationError(f"Invalid coverage type: {type(coverage)}")
    
    # Validate required fields
    required_fields = ['start_time', 'end_time', 'min_employees']
    for field in required_fields:
        if data.get(field) is None:
            errors.append(f"Missing required field: {field}")
    
    # Validate time fields
    if data.get('start_time') and data.get('end_time'):
        try:
            validate_time_range(data['start_time'], data['end_time'])
        except ValidationError as e:
            errors.append(f"Invalid time range: {e}")
    
    # Validate day_index
    if data.get('day_index') is not None:
        if not isinstance(data['day_index'], int) or data['day_index'] < 0 or data['day_index'] > 6:
            errors.append(f"Invalid day_index: {data['day_index']} (must be 0-6)")
    
    # Validate employee counts
    if data.get('min_employees') is not None:
        try:
            min_emp = int(data['min_employees'])
            if min_emp < 0:
                errors.append(f"min_employees cannot be negative: {min_emp}")
        except (ValueError, TypeError):
            errors.append(f"min_employees must be an integer, got {type(data['min_employees'])}")
    
    if data.get('max_employees') is not None:
        try:
            max_emp = int(data['max_employees'])
            if max_emp < 0:
                errors.append(f"max_employees cannot be negative: {max_emp}")
            elif data.get('min_employees') is not None and max_emp < int(data['min_employees']):
                errors.append(f"max_employees ({max_emp}) cannot be less than min_employees ({data['min_employees']})")
        except (ValueError, TypeError):
            errors.append(f"max_employees must be an integer, got {type(data['max_employees'])}")
    
    # Validate requires_keyholder
    if data.get('requires_keyholder') is not None:
        if not isinstance(data['requires_keyholder'], bool):
            try:
                data['requires_keyholder'] = bool(data['requires_keyholder'])
                warnings.append("Converted requires_keyholder to boolean")
            except (ValueError, TypeError):
                errors.append(f"requires_keyholder must be boolean, got {type(data['requires_keyholder'])}")
    
    if errors:
        raise CoverageValidationError(f"Coverage validation failed: {'; '.join(errors)}")
    
    return {
        'valid': True,
        'warnings': warnings,
        'normalized_data': data
    }


def validate_employee_data(employee: Any) -> Dict[str, Any]:
    """
    Validate employee data object or dictionary.
    
    Args:
        employee: Employee object or dictionary
        
    Returns:
        Dictionary with validation results and normalized data
        
    Raises:
        EmployeeValidationError: If validation fails
    """
    errors = []
    warnings = []
    
    # Extract data from object or dict
    if hasattr(employee, '__dict__'):
        data = {
            'id': getattr(employee, 'id', None),
            'name': getattr(employee, 'name', None),
            'is_active': getattr(employee, 'is_active', True),
            'is_keyholder': getattr(employee, 'is_keyholder', False),
            'employee_group': getattr(employee, 'employee_group', None),
            'contracted_hours': getattr(employee, 'contracted_hours', None),
        }
    elif isinstance(employee, dict):
        data = employee.copy()
    else:
        raise EmployeeValidationError(f"Invalid employee type: {type(employee)}")
    
    # Validate required fields
    required_fields = ['id']
    for field in required_fields:
        if data.get(field) is None:
            errors.append(f"Missing required field: {field}")
    
    # Validate boolean fields
    for bool_field in ['is_active', 'is_keyholder']:
        if data.get(bool_field) is not None:
            if not isinstance(data[bool_field], bool):
                try:
                    data[bool_field] = bool(data[bool_field])
                    warnings.append(f"Converted {bool_field} to boolean")
                except (ValueError, TypeError):
                    errors.append(f"{bool_field} must be boolean, got {type(data[bool_field])}")
    
    # Validate contracted_hours
    if data.get('contracted_hours') is not None:
        try:
            hours = float(data['contracted_hours'])
            if hours < 0 or hours > 80:
                warnings.append(f"Unusual contracted_hours: {hours}")
        except (ValueError, TypeError):
            errors.append(f"contracted_hours must be a number, got {type(data['contracted_hours'])}")
    
    # Validate employee_group
    if data.get('employee_group'):
        valid_groups = ['VZ', 'TZ', 'GFB', 'TL']
        if data['employee_group'] not in valid_groups:
            warnings.append(f"Unusual employee_group: {data['employee_group']}")
    
    if errors:
        raise EmployeeValidationError(f"Employee validation failed: {'; '.join(errors)}")
    
    return {
        'valid': True,
        'warnings': warnings,
        'normalized_data': data
    }


def validate_assignment_data(assignment: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate assignment data dictionary.
    
    Args:
        assignment: Assignment dictionary
        
    Returns:
        Dictionary with validation results and normalized data
        
    Raises:
        AssignmentValidationError: If validation fails
    """
    errors = []
    warnings = []
    data = assignment.copy()
    
    # Validate required fields
    required_fields = ['employee_id', 'shift_id', 'date']
    for field in required_fields:
        if data.get(field) is None:
            errors.append(f"Missing required field: {field}")
    
    # Validate employee_id and shift_id
    for id_field in ['employee_id', 'shift_id']:
        if data.get(id_field) is not None:
            try:
                data[id_field] = int(data[id_field])
            except (ValueError, TypeError):
                errors.append(f"{id_field} must be an integer, got {type(data[id_field])}")
    
    # Validate date
    if data.get('date') is not None:
        if not isinstance(data['date'], date):
            if isinstance(data['date'], str):
                try:
                    data['date'] = date.fromisoformat(data['date'])
                    warnings.append("Converted date string to date object")
                except ValueError:
                    errors.append(f"Invalid date format: {data['date']}")
            else:
                errors.append(f"date must be a date object or ISO string, got {type(data['date'])}")
    
    # Validate time fields if present
    for time_field in ['start_time', 'end_time']:
        if data.get(time_field):
            try:
                validate_time_string(data[time_field], time_field)
            except ValidationError as e:
                errors.append(str(e))
    
    # Validate time range if both times present
    if data.get('start_time') and data.get('end_time'):
        try:
            validate_time_range(data['start_time'], data['end_time'])
        except ValidationError as e:
            errors.append(f"Invalid time range: {e}")
    
    # Validate status
    if data.get('status'):
        valid_statuses = ['PENDING', 'ASSIGNED', 'CONFIRMED', 'CANCELLED', 'EMPTY']
        if data['status'] not in valid_statuses:
            warnings.append(f"Unusual status: {data['status']}")
    
    # Validate version
    if data.get('version') is not None:
        try:
            data['version'] = int(data['version'])
            if data['version'] < 1:
                errors.append(f"version must be positive, got {data['version']}")
        except (ValueError, TypeError):
            errors.append(f"version must be an integer, got {type(data['version'])}")
    
    if errors:
        raise AssignmentValidationError(f"Assignment validation failed: {'; '.join(errors)}")
    
    return {
        'valid': True,
        'warnings': warnings,
        'normalized_data': data
    }


def validate_batch_data(data_list: List[Any], validator_func: callable, 
                       continue_on_error: bool = True) -> Dict[str, Any]:
    """
    Validate a batch of data items using the specified validator function.
    
    Args:
        data_list: List of data items to validate
        validator_func: Function to use for validation
        continue_on_error: Whether to continue validation after errors
        
    Returns:
        Dictionary with batch validation results
    """
    results = {
        'total_items': len(data_list),
        'valid_items': [],
        'invalid_items': [],
        'warnings': [],
        'errors': []
    }
    
    for i, item in enumerate(data_list):
        try:
            validation_result = validator_func(item)
            results['valid_items'].append({
                'index': i,
                'item': item,
                'result': validation_result
            })
            if validation_result.get('warnings'):
                results['warnings'].extend([
                    f"Item {i}: {warning}" for warning in validation_result['warnings']
                ])
        except ValidationError as e:
            error_info = {
                'index': i,
                'item': item,
                'error': str(e)
            }
            results['invalid_items'].append(error_info)
            results['errors'].append(f"Item {i}: {e}")
            
            if not continue_on_error:
                break
    
    results['success_rate'] = len(results['valid_items']) / results['total_items'] if results['total_items'] > 0 else 0
    
    return results


def log_validation_results(results: Dict[str, Any], logger_instance: Optional[logging.Logger] = None):
    """
    Log validation results in a structured format.
    
    Args:
        results: Validation results dictionary
        logger_instance: Logger to use (defaults to module logger)
    """
    log = logger_instance or logger
    
    if results.get('valid'):
        log.info("Validation passed")
        if results.get('warnings'):
            for warning in results['warnings']:
                log.warning(f"Validation warning: {warning}")
    else:
        log.error("Validation failed")
        if results.get('errors'):
            for error in results['errors']:
                log.error(f"Validation error: {error}")
    
    # For batch results
    if 'total_items' in results:
        log.info(f"Batch validation: {len(results['valid_items'])}/{results['total_items']} items valid "
                f"(success rate: {results['success_rate']:.1%})")
        
        if results['invalid_items']:
            log.warning(f"{len(results['invalid_items'])} items failed validation")
            for invalid_item in results['invalid_items'][:5]:  # Log first 5 errors
                log.error(f"Item {invalid_item['index']}: {invalid_item['error']}")
            
            if len(results['invalid_items']) > 5:
                log.error(f"... and {len(results['invalid_items']) - 5} more validation errors") 