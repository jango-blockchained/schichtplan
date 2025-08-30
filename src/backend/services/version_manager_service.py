"""
Unified Version Management Service for the Schichtplan application.

This service provides a unified interface for managing both legacy numeric versions
and week-based versions, consolidating all version operations into a single service.
"""

from datetime import date, datetime
from typing import Dict, List, Optional, Union

from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session

from ..models import db
from ..models.schedule import Schedule, ScheduleStatus, ScheduleVersionMeta
from ..utils.logger import logger
from ..utils.version_utils import date_range_to_week_identifier
from ..utils.week_utils import (
    MonthBoundaryMode,
    get_week_from_identifier,
    handle_month_boundary,
)


class VersionManagerService:
    """Unified service for managing all types of schedule versions."""

    def __init__(self, session: Optional[Session] = None):
        self.session = session or db.session

    # --- Version Querying ---

    def get_versions_for_exact_date_range(
        self,
        start_date: date,
        end_date: date,
        include_legacy: bool = True,
        week_identifier: Optional[str] = None,
    ) -> List[ScheduleVersionMeta]:
        """
        Get all versions that exactly match the given date range.

        Args:
            start_date: Start of date range
            end_date: End of date range
            include_legacy: Whether to include legacy numeric versions
            week_identifier: Optional specific week identifier to filter by

        Returns:
            List of version metadata objects that exactly match the date range
        """
        query = self.session.query(ScheduleVersionMeta).filter(
            and_(
                ScheduleVersionMeta.date_range_start == start_date,
                ScheduleVersionMeta.date_range_end == end_date,
            )
        )

        # Filter by version type
        # TODO: Fix boolean column filtering
        # if not include_legacy:
        #     query = query.filter(ScheduleVersionMeta.is_week_based.is_(True))

        # Filter by specific week identifier
        if week_identifier:
            query = query.filter(ScheduleVersionMeta.week_identifier == week_identifier)

        versions = query.order_by(desc(ScheduleVersionMeta.version)).all()

        # For exact matching, we don't check legacy versions in schedules table
        # as they wouldn't have exact date range metadata

        return versions

    def get_versions_for_date_range(
        self,
        start_date: date,
        end_date: date,
        include_legacy: bool = True,
        week_identifier: Optional[str] = None,
    ) -> List[ScheduleVersionMeta]:
        """
        Get all versions that overlap with the given date range.

        Args:
            start_date: Start of date range
            end_date: End of date range
            include_legacy: Whether to include legacy numeric versions
            week_identifier: Optional specific week identifier to filter by

        Returns:
            List of version metadata objects
        """
        query = self.session.query(ScheduleVersionMeta).filter(
            and_(
                ScheduleVersionMeta.date_range_start <= end_date,
                ScheduleVersionMeta.date_range_end >= start_date,
            )
        )

        # Filter by version type
        # TODO: Fix boolean column filtering
        # if not include_legacy:
        #     query = query.filter(ScheduleVersionMeta.is_week_based == True)

        # Filter by specific week identifier
        if week_identifier:
            query = query.filter(ScheduleVersionMeta.week_identifier == week_identifier)

        versions = query.order_by(desc(ScheduleVersionMeta.version)).all()

        # If no versions found in metadata, check schedules table for legacy versions
        if not versions and include_legacy:
            versions = self._find_legacy_versions_in_schedules(start_date, end_date)

        return versions

    def get_version_by_id(self, version_id: int) -> Optional[ScheduleVersionMeta]:
        """Get version metadata by version ID."""
        return (
            self.session.query(ScheduleVersionMeta)
            .filter(ScheduleVersionMeta.version == version_id)
            .first()
        )

    def get_all_versions(
        self,
        include_legacy: bool = True,
    ) -> List[ScheduleVersionMeta]:
        """
        Get all versions.

        Args:
            include_legacy: Whether to include legacy numeric versions

        Returns:
            List of all version metadata objects
        """
        query = self.session.query(ScheduleVersionMeta)

        # TODO: Add filtering by version type when needed
        # if not include_legacy:
        #     query = query.filter(ScheduleVersionMeta.is_week_based)

        versions = query.order_by(desc(ScheduleVersionMeta.version)).all()

        # If no versions found in metadata, check schedules table for legacy versions
        if not versions and include_legacy:
            versions = self._find_all_legacy_versions_in_schedules()

        return versions

    def get_version_by_week_identifier(
        self, week_identifier: str
    ) -> Optional[ScheduleVersionMeta]:
        """Get version metadata by week identifier."""
        return (
            self.session.query(ScheduleVersionMeta)
            .filter(ScheduleVersionMeta.week_identifier == week_identifier)
            .first()
        )

    def get_latest_version_for_date_range(
        self, start_date: date, end_date: date
    ) -> Optional[ScheduleVersionMeta]:
        """Get the latest version for a given date range."""
        versions = self.get_versions_for_date_range(start_date, end_date)
        return versions[0] if versions else None

    # --- Version Creation ---

    def create_version(
        self,
        start_date: date,
        end_date: date,
        base_version: Optional[int] = None,
        notes: Optional[str] = None,
        week_identifier: Optional[str] = None,
        month_boundary_mode: MonthBoundaryMode = MonthBoundaryMode.KEEP_INTACT,
        create_empty_schedules: bool = True,
    ) -> ScheduleVersionMeta:
        """
        Create a new version with unified logic for both legacy and week-based versions.

        Args:
            start_date: Start date of the version
            end_date: End date of the version
            base_version: Optional base version to copy from
            notes: Optional notes for the version
            week_identifier: Optional week identifier for week-based versions
            month_boundary_mode: How to handle month boundaries
            create_empty_schedules: Whether to create empty schedule entries

        Returns:
            Created ScheduleVersionMeta object
        """
        try:
            # Get next version number
            version_number = self._get_next_version_number()

            # Determine if this is a week-based version
            is_week_based = week_identifier is not None
            if not week_identifier and self._is_week_aligned(start_date, end_date):
                # Auto-generate week identifier for week-aligned date ranges
                try:
                    week_identifier = date_range_to_week_identifier(
                        start_date, end_date
                    )
                    is_week_based = True
                except ValueError:
                    # Not a valid week range, keep as legacy
                    pass

            logger.info(
                f"Creating version {version_number} for {start_date} to {end_date}"
                f"{' (week-based: ' + week_identifier + ')' if is_week_based else ''}"
            )

            # Create version metadata
            version_meta = ScheduleVersionMeta(
                version=version_number,
                created_at=datetime.utcnow(),
                status=ScheduleStatus.DRAFT,
                date_range_start=start_date,
                date_range_end=end_date,
                base_version=base_version,
                notes=notes
                or self._generate_default_notes(week_identifier, start_date, end_date),
                week_identifier=week_identifier,
                month_boundary_mode=month_boundary_mode.value
                if is_week_based
                else "keep_intact",
                is_week_based=is_week_based,
            )

            self.session.add(version_meta)
            self.session.flush()  # Get the ID

            # Copy schedules from base version if specified
            if base_version:
                self._copy_schedules_from_version(
                    version_number, base_version, start_date, end_date
                )
            elif create_empty_schedules:
                # Create empty schedules could be implemented here if needed
                logger.info(
                    f"Skipping empty schedule creation for version {version_number}"
                )

            self.session.commit()
            logger.info(f"Successfully created version {version_number}")

            return version_meta

        except Exception as e:
            self.session.rollback()
            logger.error(f"Error creating version: {str(e)}")
            raise

    def create_week_version(
        self,
        week_identifier: str,
        base_version: Optional[int] = None,
        month_boundary_mode: MonthBoundaryMode = MonthBoundaryMode.KEEP_INTACT,
        notes: Optional[str] = None,
        create_empty_schedules: bool = True,
    ) -> ScheduleVersionMeta:
        """
        Create a week-based version using the unified creation logic.

        Args:
            week_identifier: Week identifier like "2024-W15"
            base_version: Optional base version to copy from
            month_boundary_mode: How to handle month boundaries
            notes: Optional notes for the version
            create_empty_schedules: Whether to create empty schedule entries

        Returns:
            Created ScheduleVersionMeta object
        """
        # Parse week identifier and get date range
        week_info = get_week_from_identifier(week_identifier)

        # Handle month boundaries
        date_periods = handle_month_boundary(week_info, month_boundary_mode)
        start_date = date_periods[0][0]
        end_date = date_periods[-1][1]

        return self.create_version(
            start_date=start_date,
            end_date=end_date,
            base_version=base_version,
            notes=notes,
            week_identifier=week_identifier,
            month_boundary_mode=month_boundary_mode,
            create_empty_schedules=create_empty_schedules,
        )

    # --- Version Operations ---

    def update_version_status(
        self, version_id: int, status: ScheduleStatus
    ) -> ScheduleVersionMeta:
        """Update version status."""
        version_meta = self.get_version_by_id(version_id)
        if not version_meta:
            raise ValueError(f"Version {version_id} not found")

        version_meta.status = status
        version_meta.updated_at = datetime.utcnow()

        self.session.commit()
        logger.info(f"Updated version {version_id} status to {status.value}")

        return version_meta

    def update_version_notes(self, version_id: int, notes: str) -> ScheduleVersionMeta:
        """Update version notes."""
        version_meta = self.get_version_by_id(version_id)
        if not version_meta:
            raise ValueError(f"Version {version_id} not found")

        version_meta.notes = notes
        version_meta.updated_at = datetime.utcnow()

        self.session.commit()
        logger.info(f"Updated version {version_id} notes")

        return version_meta

    def delete_version(self, version_id: int) -> Dict[str, Union[int, str]]:
        """Delete a version and all its schedules."""
        version_meta = self.get_version_by_id(version_id)
        if not version_meta:
            raise ValueError(f"Version {version_id} not found")

        # Count schedules to be deleted
        schedule_count = (
            self.session.query(Schedule).filter(Schedule.version == version_id).count()
        )

        # Delete schedules
        self.session.query(Schedule).filter(Schedule.version == version_id).delete()

        # Delete version metadata
        self.session.delete(version_meta)

        self.session.commit()

        logger.info(f"Deleted version {version_id} and {schedule_count} schedules")

        return {
            "version": version_id,
            "deleted_schedules_count": schedule_count,
            "message": f"Version {version_id} deleted successfully",
        }

    def duplicate_version(
        self,
        source_version_id: int,
        start_date: date,
        end_date: date,
        notes: Optional[str] = None,
    ) -> ScheduleVersionMeta:
        """Duplicate an existing version to a new date range."""
        source_version = self.get_version_by_id(source_version_id)
        if not source_version:
            raise ValueError(f"Source version {source_version_id} not found")

        # Create new version based on source
        return self.create_version(
            start_date=start_date,
            end_date=end_date,
            base_version=source_version_id,
            notes=notes or f"Duplicate of version {source_version_id}",
            week_identifier=None,  # Let it auto-determine
            create_empty_schedules=False,  # We'll copy from source
        )

    # --- Private Helper Methods ---

    def _get_next_version_number(self) -> int:
        """Get the next available version number."""
        max_schedule_version = (
            self.session.query(func.max(Schedule.version)).scalar() or 0
        )
        max_meta_version = (
            self.session.query(func.max(ScheduleVersionMeta.version)).scalar() or 0
        )
        return max(max_schedule_version, max_meta_version) + 1

    def _find_legacy_versions_in_schedules(
        self, start_date: date, end_date: date
    ) -> List[ScheduleVersionMeta]:
        """Find legacy versions that exist only in the schedules table."""
        schedule_versions = (
            self.session.query(Schedule.version)
            .filter(
                and_(
                    Schedule.date >= start_date,
                    Schedule.date <= end_date,
                )
            )
            .distinct()
            .order_by(desc(Schedule.version))
            .all()
        )

        legacy_versions = []
        for (version_id,) in schedule_versions:
            # Check if metadata already exists
            existing_meta = self.get_version_by_id(version_id)
            if existing_meta:
                legacy_versions.append(existing_meta)
                continue

            # Create temporary metadata for legacy version
            date_info = (
                self.session.query(func.min(Schedule.date), func.max(Schedule.date))
                .filter(Schedule.version == version_id)
                .first()
            )

            if date_info and date_info[0] and date_info[1]:
                meta = ScheduleVersionMeta(
                    version=version_id,
                    status=ScheduleStatus.DRAFT,
                    date_range_start=date_info[0],
                    date_range_end=date_info[1],
                    notes=f"Legacy version {version_id}",
                    is_week_based=False,
                )
                legacy_versions.append(meta)

        return legacy_versions

    def _copy_schedules_from_version(
        self, new_version: int, source_version: int, start_date: date, end_date: date
    ) -> None:
        """Copy schedules from source version to new version."""
        source_schedules = (
            self.session.query(Schedule)
            .filter(
                Schedule.version == source_version,
                Schedule.date >= start_date,
                Schedule.date <= end_date,
            )
            .all()
        )

        for source_schedule in source_schedules:
            new_schedule = Schedule(
                version=new_version,
                employee_id=source_schedule.employee_id,
                date=source_schedule.date,
                shift_id=source_schedule.shift_id,
                shift_type=source_schedule.shift_type,
                shift_start=source_schedule.shift_start,
                shift_end=source_schedule.shift_end,
                duration_hours=source_schedule.duration_hours,
                break_duration=source_schedule.break_duration,
                break_start=source_schedule.break_start,
                break_end=source_schedule.break_end,
                notes=source_schedule.notes,
            )
            self.session.add(new_schedule)

        logger.info(
            f"Copied {len(source_schedules)} schedules from version "
            f"{source_version} to {new_version}"
        )

    def _is_week_aligned(self, start_date: date, end_date: date) -> bool:
        """Check if the date range is aligned to calendar weeks."""
        try:
            # Try to convert to week identifier - if successful, it's week-aligned
            date_range_to_week_identifier(start_date, end_date)
            return True
        except ValueError:
            return False

    def _generate_default_notes(
        self, week_identifier: Optional[str], start_date: date, end_date: date
    ) -> str:
        """Generate default notes for a version."""
        if week_identifier:
            return f"Week-based version for {week_identifier}"
        else:
            return f"Version for {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"

    # --- Version Statistics ---

    def get_version_statistics(self, version_id: int) -> Dict[str, Union[int, float]]:
        """Get statistics for a version."""
        version_meta = self.get_version_by_id(version_id)
        if not version_meta:
            raise ValueError(f"Version {version_id} not found")

        # Count schedules
        total_schedules = (
            self.session.query(Schedule).filter(Schedule.version == version_id).count()
        )

        filled_schedules = (
            self.session.query(Schedule)
            .filter(
                Schedule.version == version_id,
                Schedule.shift_id.isnot(None),  # Has a shift assigned
            )
            .count()
        )

        # Count unique employees
        unique_employees = (
            self.session.query(Schedule.employee_id)
            .filter(Schedule.version == version_id)
            .distinct()
            .count()
        )

        # Count unique dates
        unique_dates = (
            self.session.query(Schedule.date)
            .filter(Schedule.version == version_id)
            .distinct()
            .count()
        )

        coverage_percentage = (
            (filled_schedules / total_schedules * 100) if total_schedules > 0 else 0
        )

        return {
            "version": version_id,
            "total_schedules": total_schedules,
            "filled_schedules": filled_schedules,
            "empty_schedules": total_schedules - filled_schedules,
            "coverage_percentage": round(coverage_percentage, 1),
            "unique_employees": unique_employees,
            "unique_dates": unique_dates,
        }
