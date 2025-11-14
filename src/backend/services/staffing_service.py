"""Service for calculating staffing statistics and occupancy data.

This service provides functionality to calculate daily employee presence,
vacation, and absence statistics for the staffing plan feature.
"""

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from sqlalchemy import and_

from src.backend.models import Absence, Employee, Settings
from src.backend.utils.logger import logger


class StaffingService:
    """Service for managing staffing statistics and occupancy data."""

    def __init__(self):
        """Initialize the staffing service."""
        self.settings = Settings.query.first()

    def get_daily_statistics(
        self, start_date: date, end_date: date
    ) -> dict[str, Any]:
        """Calculate daily staffing statistics for a date range.

        Args:
            start_date: Start date for statistics (inclusive)
            end_date: End date for statistics (inclusive)

        Returns:
            Dictionary with daily statistics including:
            - total_active_employees: Total number of active employees
            - daily_stats: List of daily statistics with date, present, vacation, absent counts
            - date_range: The requested date range
        """
        try:
            # Get all active employees
            active_employees = Employee.query.filter_by(is_active=True).all()
            total_active = len(active_employees)

            logger.info(
                f"Calculating staffing statistics from {start_date} to {end_date} "
                f"for {total_active} active employees"
            )

            # Get all absences that overlap with the date range
            absences = (
                Absence.query.filter(
                    and_(
                        Absence.start_date <= end_date,
                        Absence.end_date >= start_date,
                        Absence.status == "approved",  # Only count approved absences
                    )
                )
                .join(Employee)
                .filter(Employee.is_active)
                .all()
            )

            logger.info(f"Found {len(absences)} approved absences in date range")

            # Build a dictionary of absence data by date and type
            absence_by_date = defaultdict(lambda: {"vacation": set(), "other": set()})

            for absence in absences:
                # Iterate through each day of the absence
                current_date = max(absence.start_date, start_date)
                absence_end = min(absence.end_date, end_date)

                while current_date <= absence_end:
                    # Categorize absence type
                    if absence.absence_type_id == "vacation":
                        absence_by_date[current_date]["vacation"].add(
                            absence.employee_id
                        )
                    else:
                        absence_by_date[current_date]["other"].add(absence.employee_id)

                    current_date += timedelta(days=1)

            # Calculate daily statistics
            daily_stats = []
            current_date = start_date

            while current_date <= end_date:
                # Get absences for this date
                vacation_employees = absence_by_date[current_date]["vacation"]
                other_absent_employees = absence_by_date[current_date]["other"]

                # Calculate counts
                on_vacation = len(vacation_employees)
                other_absent = len(other_absent_employees)
                total_absent = on_vacation + other_absent
                present = max(0, total_active - total_absent)

                daily_stats.append(
                    {
                        "date": current_date.isoformat(),
                        "present": present,
                        "on_vacation": on_vacation,
                        "absent": other_absent,
                        "total_absent": total_absent,
                        "total_active": total_active,
                    }
                )

                current_date += timedelta(days=1)

            result = {
                "total_active_employees": total_active,
                "daily_stats": daily_stats,
                "date_range": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                },
            }

            logger.info(
                f"Successfully calculated {len(daily_stats)} days of statistics"
            )
            return result

        except Exception as e:
            logger.error(f"Error calculating daily statistics: {str(e)}", exc_info=True)
            raise

    def get_heatmap_data(
        self, start_date: date, end_date: date, metric: str = "total_absent"
    ) -> dict[str, Any]:
        """Get heatmap data for visualization.

        Args:
            start_date: Start date for heatmap
            end_date: End date for heatmap
            metric: Which metric to use ('total_absent', 'on_vacation', 'present')

        Returns:
            Dictionary with heatmap data optimized for visualization
        """
        try:
            stats = self.get_daily_statistics(start_date, end_date)
            daily_stats = stats["daily_stats"]

            # Extract the requested metric
            heatmap_data = [
                {
                    "date": day["date"],
                    "value": day.get(metric, 0),
                    "present": day["present"],
                    "on_vacation": day["on_vacation"],
                    "absent": day["absent"],
                }
                for day in daily_stats
            ]

            # Calculate min/max for scale
            values = [day["value"] for day in heatmap_data]
            min_value = min(values) if values else 0
            max_value = max(values) if values else 0

            return {
                "data": heatmap_data,
                "metric": metric,
                "scale": {"min": min_value, "max": max_value},
                "date_range": stats["date_range"],
            }

        except Exception as e:
            logger.error(f"Error generating heatmap data: {str(e)}", exc_info=True)
            raise

    def get_employee_absence_details(
        self, target_date: date
    ) -> dict[str, Any]:
        """Get detailed breakdown of which employees are absent on a specific date.

        Args:
            target_date: The date to query

        Returns:
            Dictionary with lists of employees by absence status
        """
        try:
            # Get all active employees
            active_employees = Employee.query.filter_by(is_active=True).all()

            # Get absences for this specific date
            absences = (
                Absence.query.filter(
                    and_(
                        Absence.start_date <= target_date,
                        Absence.end_date >= target_date,
                        Absence.status == "approved",
                    )
                )
                .join(Employee)
                .filter(Employee.is_active)
                .all()
            )

            # Build sets of absent employees by type
            on_vacation = set()
            other_absent = set()

            for absence in absences:
                if absence.absence_type_id == "vacation":
                    on_vacation.add(absence.employee_id)
                else:
                    other_absent.add(absence.employee_id)

            # Build lists with employee details
            all_absent = on_vacation | other_absent
            present_employees = [
                {
                    "id": emp.id,
                    "name": f"{emp.first_name} {emp.last_name}",
                    "employee_id": emp.employee_id,
                }
                for emp in active_employees
                if emp.id not in all_absent
            ]

            vacation_employees = [
                {
                    "id": emp.id,
                    "name": f"{emp.first_name} {emp.last_name}",
                    "employee_id": emp.employee_id,
                }
                for emp in active_employees
                if emp.id in on_vacation
            ]

            absent_employees = [
                {
                    "id": emp.id,
                    "name": f"{emp.first_name} {emp.last_name}",
                    "employee_id": emp.employee_id,
                }
                for emp in active_employees
                if emp.id in other_absent
            ]

            return {
                "date": target_date.isoformat(),
                "present": present_employees,
                "on_vacation": vacation_employees,
                "absent": absent_employees,
                "total_active": len(active_employees),
            }

        except Exception as e:
            logger.error(
                f"Error getting employee absence details: {str(e)}", exc_info=True
            )
            raise
