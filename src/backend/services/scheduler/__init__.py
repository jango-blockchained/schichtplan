"""
Scheduler service for Schichtplan.
Handles all schedule generation and management.
"""

from .availability import AvailabilityChecker
from .config import SchedulerConfig
from .constraints import ConstraintChecker
from .distribution import DistributionManager
from .generator import ScheduleGenerationError, ScheduleGenerator
from .logging_utils import ProcessTracker
from .resources import ScheduleResourceError, ScheduleResources
from .serialization import ScheduleSerializer
from .utility import (
    calculate_duration,
    calculate_rest_hours,
    is_early_shift,
    is_late_shift,
    requires_keyholder,
    shifts_overlap,
    time_overlaps,
    time_to_minutes,
)
from .validator import ScheduleConfig, ScheduleValidator, ValidationError

__all__ = [
    "ScheduleGenerator",
    "ScheduleGenerationError",
    "SchedulerConfig",
    "ConstraintChecker",
    "AvailabilityChecker",
    "DistributionManager",
    "ScheduleSerializer",
    "ProcessTracker",
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
