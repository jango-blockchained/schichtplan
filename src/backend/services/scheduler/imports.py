"""
Centralized import utility for scheduler modules.

This module provides a single, consistent way to import model classes and other
dependencies across all scheduler modules, eliminating the fragile try-except
import patterns scattered throughout the codebase.
"""

import logging
import sys
import os
from typing import Any, Optional, TYPE_CHECKING

# Add parent directories to path if needed
current_dir = os.path.dirname(os.path.abspath(__file__))
src_backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if src_backend_dir not in sys.path:
    sys.path.insert(0, src_backend_dir)

logger = logging.getLogger(__name__)

# Global variables to store imported classes
_models_imported = False
_import_error = None

# Model classes (will be set during import)
Employee = None
ShiftTemplate = None
Settings = None
Coverage = None
db = None
Absence = None
EmployeeAvailability = None
Schedule = None
ScheduleAssignment = None
AvailabilityType = None
EmployeeGroup = None


def _attempt_imports():
    """Attempt to import all required model classes using different import paths."""
    global _models_imported, _import_error
    global Employee, ShiftTemplate, Settings, Coverage, db, Absence
    global EmployeeAvailability, Schedule, ScheduleAssignment, AvailabilityType, EmployeeGroup
    
    if _models_imported:
        return True
    
    import_attempts = [
        # Attempt 1: Standard src.backend structure
        lambda: _import_from_src_backend(),
        # Attempt 2: Direct backend structure
        lambda: _import_from_backend(),
        # Attempt 3: Direct models structure
        lambda: _import_from_models(),
    ]
    
    for attempt_func in import_attempts:
        try:
            attempt_func()
            _models_imported = True
            logger.info("Successfully imported all model classes")
            return True
        except ImportError as e:
            _import_error = e
            continue
    
    # All attempts failed
    logger.error(f"All import attempts failed. Last error: {_import_error}")
    _create_mock_classes()
    _models_imported = True
    return False


def _import_from_src_backend():
    """Import from src.backend structure."""
    global Employee, ShiftTemplate, Settings, Coverage, db, Absence
    global EmployeeAvailability, Schedule, ScheduleAssignment, AvailabilityType, EmployeeGroup
    
    from src.backend.models import (
        Employee, ShiftTemplate, Settings, Coverage, db, Absence, EmployeeAvailability
    )
    from src.backend.models.schedule import Schedule, ScheduleAssignment
    from src.backend.models.employee import AvailabilityType, EmployeeGroup


def _import_from_backend():
    """Import from backend structure."""
    global Employee, ShiftTemplate, Settings, Coverage, db, Absence
    global EmployeeAvailability, Schedule, ScheduleAssignment, AvailabilityType, EmployeeGroup
    
    from backend.models import (
        Employee, ShiftTemplate, Settings, Coverage, db, Absence, EmployeeAvailability
    )
    from backend.models.schedule import Schedule, ScheduleAssignment
    from backend.models.employee import AvailabilityType, EmployeeGroup


def _import_from_models():
    """Import from models structure."""
    global Employee, ShiftTemplate, Settings, Coverage, db, Absence
    global EmployeeAvailability, Schedule, ScheduleAssignment, AvailabilityType, EmployeeGroup
    
    from models import (
        Employee, ShiftTemplate, Settings, Coverage, db, Absence, EmployeeAvailability
    )
    from models.schedule import Schedule, ScheduleAssignment
    from models.employee import AvailabilityType, EmployeeGroup


def _create_mock_classes():
    """Create mock classes when all imports fail."""
    global Employee, ShiftTemplate, Settings, Coverage, db, Absence
    global EmployeeAvailability, Schedule, ScheduleAssignment, AvailabilityType, EmployeeGroup
    
    logger.warning("Creating mock classes due to import failures")
    
    class MockAvailabilityType:
        """Mock enum for AvailabilityType"""
        AVAILABLE = "AVAILABLE"
        PREFERRED = "PREFERRED"
        UNAVAILABLE = "UNAVAILABLE"
        FIXED = "FIXED"
        
        @classmethod
        def value(cls):
            return cls.AVAILABLE
    
    class MockEmployeeGroup:
        """Mock enum for EmployeeGroup"""
        VZ = "VZ"  # Full-time
        TZ = "TZ"  # Part-time
        GFB = "GFB"  # Mini-job
        TL = "TL"  # Team leader
    
    class MockEmployee:
        """Mock Employee class"""
        def __init__(self):
            self.id = 0
            self.name = "Mock Employee"
            self.is_keyholder = False
            self.is_active = True
            self.employee_group = None
            self.contracted_hours = 40.0
            self.preferences = {}
            self.availability = []
        
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
        """Mock ShiftTemplate class"""
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
    
    class MockSettings:
        """Mock Settings class"""
        def __init__(self):
            self.special_days = {}
            self.special_hours = {}
            self.id = 0
    
    class MockCoverage:
        """Mock Coverage class"""
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
    
    class MockAbsence:
        """Mock Absence class"""
        def __init__(self):
            self.id = 0
            self.employee_id = 0
            self.start_date = None
            self.end_date = None
        
        @staticmethod
        def query():
            class MockQuery:
                @staticmethod
                def all():
                    return []
            return MockQuery()
    
    class MockEmployeeAvailability:
        """Mock EmployeeAvailability class"""
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
        """Mock Schedule class"""
        def __init__(self):
            self.id = 0
            self.employee_id = 0
            self.shift_id = 0
            self.date = None
            self.status = "DRAFT"
            self.version = 1
        
        @staticmethod
        def query():
            class MockQuery:
                @staticmethod
                def all():
                    return []
            return MockQuery()
    
    class MockScheduleAssignment:
        """Mock ScheduleAssignment class"""
        def __init__(self, **kwargs):
            self.id = 0
            self.employee_id = kwargs.get('employee_id', 0)
            self.shift_id = kwargs.get('shift_id', 0)
            self.date = kwargs.get('date')
            self.status = kwargs.get('status', 'PENDING')
            self.version = kwargs.get('version', 1)
            self.start_time = kwargs.get('start_time')
            self.end_time = kwargs.get('end_time')
            self.shift_type = kwargs.get('shift_type')
            self.break_start = kwargs.get('break_start')
            self.break_end = kwargs.get('break_end')
            self.notes = kwargs.get('notes')
    
    class MockDb:
        """Mock database class"""
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
            
            @staticmethod
            def bulk_save_objects(objects):
                pass
    
    # Assign mock classes
    Employee = MockEmployee
    ShiftTemplate = MockShiftTemplate
    Settings = MockSettings
    Coverage = MockCoverage
    db = MockDb
    Absence = MockAbsence
    EmployeeAvailability = MockEmployeeAvailability
    Schedule = MockSchedule
    ScheduleAssignment = MockScheduleAssignment
    AvailabilityType = MockAvailabilityType
    EmployeeGroup = MockEmployeeGroup


def get_models():
    """
    Get all imported model classes.
    
    Returns:
        tuple: (Employee, ShiftTemplate, Settings, Coverage, db, Absence, 
                EmployeeAvailability, Schedule, ScheduleAssignment, AvailabilityType, EmployeeGroup)
    """
    _attempt_imports()
    return (
        Employee, ShiftTemplate, Settings, Coverage, db, Absence,
        EmployeeAvailability, Schedule, ScheduleAssignment, AvailabilityType, EmployeeGroup
    )


def get_employee_model():
    """Get the Employee model class."""
    _attempt_imports()
    return Employee


def get_shift_template_model():
    """Get the ShiftTemplate model class."""
    _attempt_imports()
    return ShiftTemplate


def get_availability_type():
    """Get the AvailabilityType enum."""
    _attempt_imports()
    return AvailabilityType


def get_employee_group():
    """Get the EmployeeGroup enum."""
    _attempt_imports()
    return EmployeeGroup


def get_schedule_assignment_model():
    """Get the ScheduleAssignment model class."""
    _attempt_imports()
    return ScheduleAssignment


def get_database():
    """Get the database instance."""
    _attempt_imports()
    return db


def is_using_mocks():
    """Check if we're using mock classes due to import failures."""
    _attempt_imports()
    return _import_error is not None


# Initialize imports when module is loaded
_attempt_imports() 