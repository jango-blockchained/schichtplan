"""
Week-based version creation service for the Schichtplan application.

This service handles the creation and management of week-based schedule versions,
integrating with the existing scheduling system.
"""

from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from ..models import db
from ..models.schedule import Schedule, ScheduleStatus, ScheduleVersionMeta
from ..models.settings import Settings
from ..utils.logger import logger
from ..utils.version_utils import date_range_to_week_identifier
from ..utils.week_utils import (
    MonthBoundaryMode,
    get_week_from_identifier,
    get_week_segments,
)


class WeekVersionService:
    """Service for managing week-based schedule versions."""

    def __init__(self, session: Optional[Session] = None):
        self.session = session or db.session

    def create_week_version(
        self,
        week_identifier: str,
        base_version: Optional[int] = None,
        month_boundary_mode: Optional[MonthBoundaryMode] = None,
        notes: Optional[str] = None,
        create_empty_schedules: bool = True,
    ) -> ScheduleVersionMeta:
        """
        Create a new week-based version.

        Args:
            week_identifier: Week identifier like "2024-W15"
            base_version: Base version to copy from (optional)
            month_boundary_mode: How to handle month boundaries (uses settings if not specified)
            notes: Optional notes for the version
            create_empty_schedules: Whether to create empty schedule entries

        Returns:
            Created ScheduleVersionMeta object (or parent meta if split)
        """
        try:
            # Get month boundary mode from settings if not specified
            if month_boundary_mode is None:
                settings = Settings.query.first()
                month_boundary_mode = MonthBoundaryMode.KEEP_INTACT
                if settings and settings.week_month_boundary_mode == "split_by_month":
                    month_boundary_mode = MonthBoundaryMode.SPLIT_ON_MONTH

            # Parse week identifier and get segments
            week_info = get_week_from_identifier(week_identifier)
            segments = get_week_segments(week_info, month_boundary_mode)

            created_versions = []
            parent_version_meta = None

            # Create a version for each segment
            for segment in segments:
                # Get next version number for each segment
                max_version = self._get_next_version_number()

                # Determine segment identifier and notes
                segment_identifier = segment.segment_id
                segment_notes = notes or f"Week-based version for {segment_identifier}"
                if segment.total_segments > 1:
                    segment_notes += (
                        f" (Part {segment.segment_number} of {segment.total_segments})"
                    )

                logger.info(
                    f"Creating week version {max_version} for {segment_identifier}"
                )

                # Create version metadata for this segment
                version_meta = ScheduleVersionMeta(
                    version=max_version,
                    created_at=datetime.utcnow(),
                    status=ScheduleStatus.DRAFT,
                    date_range_start=segment.start_date,
                    date_range_end=segment.end_date,
                    base_version=base_version,
                    notes=segment_notes,
                    week_identifier=segment_identifier,
                    month_boundary_mode=month_boundary_mode.value,
                    is_week_based=True,
                )

                self.session.add(version_meta)
                self.session.flush()  # Get the ID

                created_versions.append(version_meta)

                # Keep reference to first segment as parent
                if segment.is_first_segment:
                    parent_version_meta = version_meta

                # Copy schedules from base version if specified
                if base_version:
                    self._copy_schedules_from_base(
                        max_version, base_version, segment.start_date, segment.end_date
                    )
                elif create_empty_schedules:
                    # Skip creating empty schedules for now
                    logger.info(
                        f"Skipping empty schedule creation for version {max_version}"
                    )

            self.session.commit()
            logger.info(
                f"Successfully created {len(created_versions)} week version(s) for {week_identifier}"
            )

            # Return the parent version (first segment) or single version
            return parent_version_meta or created_versions[0]

        except Exception as e:
            self.session.rollback()
            logger.error(f"Error creating week version: {str(e)}")
            raise

    def _get_next_version_number(self) -> int:
        """Get the next available version number."""
        max_schedule_version = (
            self.session.query(db.func.max(Schedule.version)).scalar() or 0
        )

        max_meta_version = (
            self.session.query(db.func.max(ScheduleVersionMeta.version)).scalar() or 0
        )

        return max(max_schedule_version, max_meta_version) + 1

    def _create_empty_schedules(
        self, version: int, start_date: date, end_date: date
    ) -> None:
        """Create empty schedule entries for the given date range."""
        from datetime import timedelta

        from ..models.employee import Employee

        # Get all active employees
        employees = self.session.query(Employee).filter(Employee.is_active).all()

        # Create empty schedules for each day in the date range
        current_date = start_date
        while current_date <= end_date:
            for employee in employees:
                schedule = Schedule(
                    version=version,
                    employee_id=employee.id,
                    date=current_date,
                    shift_id=None,  # No shift assigned
                    shift_type="",  # Empty shift
                    notes="",
                )
                self.session.add(schedule)

            current_date += timedelta(days=1)

        logger.info(
            f"Created empty schedules for {len(employees)} employees from {start_date} to {end_date}"
        )

    def _copy_schedules_from_base(
        self, new_version: int, base_version: int, start_date: date, end_date: date
    ) -> None:
        """Copy schedules from base version to new version."""
        # Get schedules from base version within the date range
        base_schedules = (
            self.session.query(Schedule)
            .filter(
                Schedule.version == base_version,
                Schedule.date >= start_date,
                Schedule.date <= end_date,
            )
            .all()
        )

        # Copy each schedule to the new version
        for base_schedule in base_schedules:
            new_schedule = Schedule(
                version=new_version,
                employee_id=base_schedule.employee_id,
                date=base_schedule.date,
                shift_id=base_schedule.shift_id,
                shift_type=base_schedule.shift_type,
                shift_start=base_schedule.shift_start,
                shift_end=base_schedule.shift_end,
                duration_hours=base_schedule.duration_hours,
                break_duration=base_schedule.break_duration,
                notes=base_schedule.notes,
            )
            self.session.add(new_schedule)

        logger.info(
            f"Copied {len(base_schedules)} schedules from version {base_version} to {new_version}"
        )

    def get_version_by_week(
        self, week_identifier: str
    ) -> Optional[ScheduleVersionMeta]:
        """Get version metadata by week identifier.

        For split weeks, returns the first segment's version.
        """
        # First try exact match
        exact_match = (
            self.session.query(ScheduleVersionMeta)
            .filter(ScheduleVersionMeta.week_identifier == week_identifier)
            .first()
        )

        if exact_match:
            return exact_match

        # Try to find first segment of split week
        segment_match = (
            self.session.query(ScheduleVersionMeta)
            .filter(ScheduleVersionMeta.week_identifier == f"{week_identifier}-S1")
            .first()
        )

        return segment_match

    def get_all_segments_for_week(
        self, week_identifier: str
    ) -> List[ScheduleVersionMeta]:
        """Get all version segments for a split week."""
        # Find all versions that start with the week identifier
        return (
            self.session.query(ScheduleVersionMeta)
            .filter(
                or_(
                    ScheduleVersionMeta.week_identifier == week_identifier,
                    ScheduleVersionMeta.week_identifier.like(f"{week_identifier}-S%"),
                )
            )
            .order_by(ScheduleVersionMeta.week_identifier)
            .all()
        )

    def get_versions_for_date_range(
        self, start_date: date, end_date: date
    ) -> List[ScheduleVersionMeta]:
        """Get all versions that overlap with the given date range."""
        return (
            self.session.query(ScheduleVersionMeta)
            .filter(
                and_(
                    ScheduleVersionMeta.date_range_start <= end_date,
                    ScheduleVersionMeta.date_range_end >= start_date,
                )
            )
            .order_by(ScheduleVersionMeta.version.desc())
            .all()
        )

    def convert_legacy_to_week_version(self, version: int) -> Optional[str]:
        """
        Convert a legacy numeric version to week identifier if possible.

        Args:
            version: Legacy version number

        Returns:
            Week identifier if conversion is possible, None otherwise
        """
        version_meta = (
            self.session.query(ScheduleVersionMeta)
            .filter(ScheduleVersionMeta.version == version)
            .first()
        )

        if not version_meta or version_meta.is_week_based:
            return None

        # Try to determine week identifier from date range
        try:
            week_identifier = date_range_to_week_identifier(
                version_meta.date_range_start, version_meta.date_range_end
            )

            # Update the version metadata
            version_meta.week_identifier = week_identifier
            version_meta.is_week_based = True
            self.session.commit()

            return week_identifier

        except Exception as e:
            logger.warning(
                f"Could not convert legacy version {version} to week identifier: {str(e)}"
            )
            return None
