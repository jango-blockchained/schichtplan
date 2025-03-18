"""
Scheduler service for Schichtplan.
Handles all schedule generation and management.
"""

from .generator import ScheduleGenerator, ScheduleGenerationError
from .config import SchedulerConfig
from .constraints import ConstraintChecker
from .availability import AvailabilityChecker
from .distribution import DistributionManager
from .serialization import ScheduleSerializer
from .logging_utils import LoggingManager
from .resources import ScheduleResources, ScheduleResourceError
from .validator import ScheduleValidator, ValidationError, ScheduleConfig
from .utility import (
    is_early_shift,
    is_late_shift,
    requires_keyholder,
    time_to_minutes,
    shifts_overlap,
    time_overlaps,
    calculate_duration,
    calculate_rest_hours,
)

__all__ = [
    "ScheduleGenerator",
    "ScheduleGenerationError",
    "SchedulerConfig",
    "ConstraintChecker",
    "AvailabilityChecker",
    "DistributionManager",
    "ScheduleSerializer",
    "LoggingManager",
    "ScheduleResources",
    "ScheduleResourceError",
    "ScheduleValidator",
    "ValidationError",
    "ScheduleConfig",
    "is_early_shift",
    "is_late_shift",
    "requires_keyholder",
    "time_to_minutes",
    "shifts_overlap",
    "time_overlaps",
    "calculate_duration",
    "calculate_rest_hours",
]
