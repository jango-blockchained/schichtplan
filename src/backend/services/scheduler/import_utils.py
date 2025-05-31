"""
Centralized import utilities for the scheduler module.

This module provides standardized import functions to handle different
deployment environments and reduce fragile import patterns across
the scheduler components.
"""

import logging
import sys
import os
from typing import Any, Dict, Optional, Tuple, Type

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

logger = logging.getLogger(__name__)


class ImportError(Exception):
    """Custom exception for import failures"""
    pass


class ModelImportError(ImportError):
    """Specific exception for model import failures"""
    pass


def import_models() -> Tuple[Any, ...]:
    """
    Import all required model classes with standardized fallback handling.
    
    Returns:
        Tuple containing: (Employee, ShiftTemplate, Settings, Coverage, db, 
                          Absence, EmployeeAvailability, Schedule, AvailabilityType, EmployeeGroup)
    
    Raises:
        ModelImportError: If all import attempts fail
    """
    import_attempts = [
        # Attempt 1: Common structure (src/backend/...)
        lambda: _import_from_src_backend_models(),
        # Attempt 2: Direct execution where 'models' is in path
        lambda: _import_from_models(),
        # Attempt 3: Standard package layout
        lambda: _import_from_backend_models(),
    ]
    
    errors = []
    
    for attempt_func in import_attempts:
        try:
            result = attempt_func()
            logger.info("Successfully imported models")
            return result
        except ImportError as e:
            errors.append(str(e))
            continue
    
    # All imports failed
    error_msg = f"All model import attempts failed: {'; '.join(errors)}"
    logger.critical(error_msg)
    raise ModelImportError(error_msg)


def _import_from_backend_models():
    """Import from backend.models package"""
    from backend.models import (
        Employee, ShiftTemplate, Settings, Coverage, db,
        Absence, EmployeeAvailability, Schedule
    )
    from backend.models.employee import AvailabilityType, EmployeeGroup
    return (Employee, ShiftTemplate, Settings, Coverage, db,
            Absence, EmployeeAvailability, Schedule, AvailabilityType, EmployeeGroup)


def _import_from_models():
    """Import from models package"""
    from models import (
        Employee, ShiftTemplate, Settings, Coverage, db,
        Absence, EmployeeAvailability, Schedule
    )
    from models.employee import AvailabilityType, EmployeeGroup
    return (Employee, ShiftTemplate, Settings, Coverage, db,
            Absence, EmployeeAvailability, Schedule, AvailabilityType, EmployeeGroup)


def _import_from_src_backend_models():
    """Import from src.backend.models package"""
    from src.backend.models import (
        Employee, ShiftTemplate, Settings, Coverage, db,
        Absence, EmployeeAvailability, Schedule
    )
    from src.backend.models.employee import AvailabilityType, EmployeeGroup
    return (Employee, ShiftTemplate, Settings, Coverage, db,
            Absence, EmployeeAvailability, Schedule, AvailabilityType, EmployeeGroup)


def import_availability_type() -> Type:
    """
    Import AvailabilityType enum with fallback handling.
    
    Returns:
        AvailabilityType enum class
        
    Raises:
        ModelImportError: If all import attempts fail
    """
    import_attempts = [
        lambda: _import_availability_from_models(),
        lambda: _import_availability_from_backend(),
        lambda: _import_availability_from_src_backend(),
    ]
    
    errors = []
    
    for attempt_func in import_attempts:
        try:
            return attempt_func()
        except ImportError as e:
            errors.append(str(e))
            continue
    
    # All imports failed, create fallback
    logger.warning("Creating fallback AvailabilityType enum")
    return _create_fallback_availability_type()


def _import_availability_from_models():
    """Import AvailabilityType from models.employee"""
    from models.employee import AvailabilityType
    return AvailabilityType


def _import_availability_from_backend():
    """Import AvailabilityType from backend.models.employee"""
    from backend.models.employee import AvailabilityType
    return AvailabilityType


def _import_availability_from_src_backend():
    """Import AvailabilityType from src.backend.models.employee"""
    from src.backend.models.employee import AvailabilityType
    return AvailabilityType


def _create_fallback_availability_type():
    """Create a fallback AvailabilityType enum for testing"""
    from enum import Enum
    
    class AvailabilityType(str, Enum):
        """Fallback enum for availability types"""
        AVAILABLE = "AVAILABLE"
        FIXED = "FIXED"
        PREFERRED = "PREFERRED"
        UNAVAILABLE = "UNAVAILABLE"
    
    return AvailabilityType


def create_mock_models() -> Dict[str, Type]:
    """
    Create mock model classes for testing when real models are unavailable.
    
    Returns:
        Dictionary mapping model names to mock classes
    """
    from datetime import date
    
    class MockSettings:
        """Fallback Settings class for when imports fail"""
        def __init__(self):
            self.special_days = {}
            self.special_hours = {}
            self.id = 0

    class MockCoverage:
        """Fallback Coverage class for when imports fail"""
        def __init__(self):
            self.id = 0
            self.day_index = 0
            self.start_time = "09:00"
            self.end_time = "17:00"
            self.min_employees = 1
            self.max_employees = 3
            self.requires_keyholder = False

        @staticmethod
        def query():
            class MockQuery:
                @staticmethod
                def all():
                    return []
            return MockQuery()

    class MockEmployee:
        """Fallback Employee class for when imports fail"""
        def __init__(self):
            self.id = 0
            self.name = "Mock Employee"
            self.is_keyholder = False
            self.is_active = True
            self.employee_group = None
            self.contracted_hours = 40.0

        @staticmethod
        def query():
            class MockQuery:
                @staticmethod
                def filter_by(**kwargs):
                    class MockFilterResult:
                        @staticmethod
                        def all():
                            return []
                    return MockFilterResult()
            return MockQuery()

    class MockShiftTemplate:
        """Fallback ShiftTemplate class for when imports fail"""
        def __init__(self):
            self.id = 0
            self.name = "Mock Shift"
            self.start_time = "09:00"
            self.end_time = "17:00"
            self.active_days = [0, 1, 2, 3, 4]
            self.shift_type = "STANDARD"
            self.duration_hours = 8.0

        @staticmethod
        def query():
            class MockQuery:
                @staticmethod
                def all():
                    return []
            return MockQuery()

    class MockAbsence:
        """Fallback Absence class for when imports fail"""
        def __init__(self):
            self.id = 0
            self.employee_id = 0
            self.start_date = date.today()
            self.end_date = date.today()

        @staticmethod
        def query():
            class MockQuery:
                @staticmethod
                def all():
                    return []
            return MockQuery()

    class MockEmployeeAvailability:
        """Fallback EmployeeAvailability class for when imports fail"""
        def __init__(self):
            self.id = 0
            self.employee_id = 0
            self.day_of_week = 0
            self.hour = 9
            self.is_available = True
            self.availability_type = None

        @staticmethod
        def query():
            class MockQuery:
                @staticmethod
                def all():
                    return []
            return MockQuery()

    class MockSchedule:
        """Fallback Schedule class for when imports fail"""
        def __init__(self):
            self.id = 0
            self.employee_id = 0
            self.shift_id = 0
            self.date = date.today()
            self.status = "DRAFT"
            self.version = 1

        @staticmethod
        def query():
            class MockQuery:
                @staticmethod
                def all():
                    return []
            return MockQuery()

    class MockEmployeeGroup:
        """Fallback EmployeeGroup enum for when imports fail"""
        VZ = "VZ"  # Full-time
        TZ = "TZ"  # Part-time
        GFB = "GFB"  # Mini-job
        TL = "TL"  # Team leader

    class MockDb:
        """Fallback database session for when imports fail"""
        class session:
            @staticmethod
            def add(obj):
                pass

            @staticmethod
            def commit():
                pass

            @staticmethod
            def rollback():
                pass

    return {
        'Settings': MockSettings,
        'Coverage': MockCoverage,
        'Employee': MockEmployee,
        'ShiftTemplate': MockShiftTemplate,
        'Absence': MockAbsence,
        'EmployeeAvailability': MockEmployeeAvailability,
        'Schedule': MockSchedule,
        'EmployeeGroup': MockEmployeeGroup,
        'db': MockDb,
        'AvailabilityType': _create_fallback_availability_type(),
    }


def safe_import_models(use_mocks_on_failure: bool = True) -> Tuple[Any, ...]:
    """
    Safely import models with optional fallback to mocks.
    
    Args:
        use_mocks_on_failure: If True, return mock classes when real imports fail
        
    Returns:
        Tuple of model classes (real or mock)
        
    Raises:
        ModelImportError: If imports fail and use_mocks_on_failure is False
    """
    try:
        return import_models()
    except ModelImportError:
        if use_mocks_on_failure:
            logger.warning("Using mock models due to import failure")
            mocks = create_mock_models()
            return (
                mocks['Employee'], mocks['ShiftTemplate'], mocks['Settings'],
                mocks['Coverage'], mocks['db'], mocks['Absence'],
                mocks['EmployeeAvailability'], mocks['Schedule'],
                mocks['AvailabilityType'], mocks['EmployeeGroup']
            )
        else:
            raise


def get_flask_app_context():
    """Get Flask application context if available"""
    try:
        from flask import current_app
        return current_app
    except (ImportError, RuntimeError):
        logger.warning("Flask application context not available")
        return None


def validate_imports():
    """Validate that all required imports are working"""
    try:
        models = import_models()
        availability_type = import_availability_type()
        logger.info("All imports validated successfully")
        return True
    except Exception as e:
        logger.error(f"Import validation failed: {e}")
        return False 