"""
Week-based version creation service for the Schichtplan application.

This service handles the creation and management of week-based schedule versions,
integrating with the existing scheduling system.
"""

from datetime import date, datetime
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from ..models.schedule import Schedule, ScheduleVersionMeta, ScheduleStatus
from ..models import db
from ..utils.week_utils import (
    WeekInfo, 
    WeekRange, 
    MonthBoundaryMode,
    get_iso_week_info,
    get_week_from_identifier,
    create_week_identifier,
    handle_month_boundary,
    get_current_week_identifier
)
from ..utils.version_utils import (
    parse_version_identifier,
    version_identifier_to_date_range,
    date_range_to_week_identifier
)
from ..utils.logger import get_logger

logger = get_logger(__name__)


class WeekVersionService:
    """Service for managing week-based schedule versions."""
    
    def __init__(self, session: Optional[Session] = None):
        self.session = session or db.session    
    def create_week_version(
        self,
        week_identifier: str,
        base_version: Optional[int] = None,
        month_boundary_mode: MonthBoundaryMode = MonthBoundaryMode.KEEP_INTACT,
        notes: Optional[str] = None,
        create_empty_schedules: bool = True
    ) -> ScheduleVersionMeta:
        """
        Create a new week-based version.
        
        Args:
            week_identifier: Week identifier like "2024-W15"
            base_version: Base version to copy from (optional)
            month_boundary_mode: How to handle month boundaries
            notes: Optional notes for the version
            create_empty_schedules: Whether to create empty schedule entries
            
        Returns:
            Created ScheduleVersionMeta object
        """
        try:
            # Parse week identifier and get date range
            week_info = get_week_from_identifier(week_identifier)
            
            # Handle month boundaries
            date_periods = handle_month_boundary(week_info, month_boundary_mode)
            start_date = date_periods[0][0]
            end_date = date_periods[-1][1]
            
            # Get next version number
            max_version = self._get_next_version_number()
            
            logger.info(f"Creating week version {max_version} for {week_identifier}")
            
            # Create version metadata
            version_meta = ScheduleVersionMeta(
                version=max_version,
                created_at=datetime.utcnow(),
                status=ScheduleStatus.DRAFT,
                date_range_start=start_date,
                date_range_end=end_date,
                base_version=base_version,
                notes=notes or f"Week-based version for {week_identifier}",
                week_identifier=week_identifier,
                month_boundary_mode=month_boundary_mode.value,
                is_week_based=True
            )
            
            self.session.add(version_meta)
            self.session.flush()  # Get the ID
            
            # Copy schedules from base version if specified
            if base_version:
                self._copy_schedules_from_base(max_version, base_version, start_date, end_date)
            elif create_empty_schedules:
                self._create_empty_schedules(max_version, start_date, end_date)
            
            self.session.commit()
            logger.info(f"Successfully created week version {max_version}")
            
            return version_meta
            
        except Exception as e:
            self.session.rollback()
            logger.error(f"Error creating week version: {str(e)}")
            raise
    
    def _get_next_version_number(self) -> int:
        """Get the next available version number."""
        max_schedule_version = self.session.query(
            db.func.max(Schedule.version)
        ).scalar() or 0
        
        max_meta_version = self.session.query(
            db.func.max(ScheduleVersionMeta.version)
        ).scalar() or 0
        
        return max(max_schedule_version, max_meta_version) + 1
    
    def get_version_by_week(self, week_identifier: str) -> Optional[ScheduleVersionMeta]:
        """Get version metadata by week identifier."""
        return self.session.query(ScheduleVersionMeta).filter(
            ScheduleVersionMeta.week_identifier == week_identifier
        ).first()
    
    def get_versions_for_date_range(self, start_date: date, end_date: date) -> List[ScheduleVersionMeta]:
        """Get all versions that overlap with the given date range."""
        return self.session.query(ScheduleVersionMeta).filter(
            and_(
                ScheduleVersionMeta.date_range_start <= end_date,
                ScheduleVersionMeta.date_range_end >= start_date
            )
        ).order_by(ScheduleVersionMeta.version.desc()).all()
    
    def convert_legacy_to_week_version(self, version: int) -> Optional[str]:
        """
        Convert a legacy numeric version to week identifier if possible.
        
        Args:
            version: Legacy version number
            
        Returns:
            Week identifier if conversion is possible, None otherwise
        """
        version_meta = self.session.query(ScheduleVersionMeta).filter(
            ScheduleVersionMeta.version == version
        ).first()
        
        if not version_meta or version_meta.is_week_based:
            return None
        
        # Try to determine week identifier from date range
        try:
            week_identifier = date_range_to_week_identifier(
                version_meta.date_range_start,
                version_meta.date_range_end
            )
            
            # Update the version metadata
            version_meta.week_identifier = week_identifier
            version_meta.is_week_based = True
            self.session.commit()
            
            return week_identifier
            
        except Exception as e:
            logger.warning(f"Could not convert legacy version {version} to week identifier: {str(e)}")
            return None