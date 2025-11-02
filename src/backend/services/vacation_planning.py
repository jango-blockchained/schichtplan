"""Vacation planning service for handling absence validation and planning.

Handles vacation planning taking into account:
- Store opening days (from settings)
- Special days (custom store hours, closed days)
- Notional holidays (public holidays)
"""

from datetime import date, timedelta

from src.backend.models import Settings
from src.backend.utils.logger import logger


class VacationPlanningService:
    """Service for vacation planning and validation."""

    def __init__(self, settings: Settings | None = None):
        """Initialize vacation planning service.

        Args:
            settings: Settings instance. If None, will fetch from database.
        """
        self.settings = settings or Settings.get_or_create_default()

    def is_store_open_on_date(self, target_date: date) -> bool:
        """Check if the store is open on a given date.

        Considers:
        1. Special days (if store is closed or has custom hours)
        2. Opening days configuration

        Args:
            target_date: Date to check

        Returns:
            True if store is open, False otherwise
        """
        date_str = target_date.strftime("%Y-%m-%d")

        # Check special days first
        special_days = self.settings.special_days
        if special_days and date_str in special_days:
            special_day = special_days[date_str]
            # If special day is marked as closed, store is closed
            if special_day.get("is_closed", False):
                return False
            # If there are custom hours, store is open with those hours
            if special_day.get("custom_hours"):
                return True

        # Check regular opening days
        weekday = str(target_date.weekday())  # 0=Monday, 6=Sunday
        return self.settings.opening_days.get(weekday, False)

    def get_store_hours(self, target_date: date) -> tuple[str, str]:
        """Get store opening and closing hours for a given date.

        Considers special days with custom hours.

        Args:
            target_date: Date to get hours for

        Returns:
            Tuple of (opening_time, closing_time) as "HH:MM" strings
        """
        date_str = target_date.strftime("%Y-%m-%d")

        # Check special days first
        special_days = self.settings.special_days
        not_closed = not special_days.get(date_str, {}).get("is_closed", False)
        if special_days and date_str in special_days and not_closed:
            special_day = special_days[date_str]
            custom_hours = special_day.get("custom_hours")
            if (
                custom_hours
                and custom_hours.get("opening")
                and custom_hours.get("closing")
            ):
                return (
                    custom_hours["opening"],
                    custom_hours["closing"],
                )

        # Default store hours
        store_open = str(self.settings.store_opening)
        store_close = str(self.settings.store_closing)
        return store_open, store_close

    def get_working_days_in_range(self, start_date: date, end_date: date) -> list[date]:
        """Get all working (store open) days in a date range.

        Args:
            start_date: Start date (inclusive)
            end_date: End date (inclusive)

        Returns:
            List of dates when store is open
        """
        working_days = []
        current_date = start_date

        while current_date <= end_date:
            if self.is_store_open_on_date(current_date):
                working_days.append(current_date)
            current_date += timedelta(days=1)

        return working_days

    def get_closed_days_in_range(
        self, start_date: date, end_date: date
    ) -> dict[str, dict]:
        """Get all closed days in a date range with reason.

        Args:
            start_date: Start date (inclusive)
            end_date: End date (inclusive)

        Returns:
            Dictionary mapping date strings to reason info
            {
                "2024-12-25": {
                    "reason": "holiday",  # or "special_day", "weekend"
                    "type": "closed",  # or "custom_hours"
                    "custom_hours": ("09:00", "18:00"),  # if applicable
                    "description": "Weihnachtstag"
                }
            }
        """
        closed_days = {}
        current_date = start_date

        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")

            # Check special days
            special_days = self.settings.special_days
            if special_days and date_str in special_days:
                special_day = special_days[date_str]
                if special_day.get("is_closed", False):
                    closed_days[date_str] = {
                        "reason": "special_day",
                        "type": "closed",
                        "description": special_day.get(
                            "name",
                            "Special Day (Closed)",
                        ),
                    }
                elif special_day.get("custom_hours"):
                    custom_hours = special_day["custom_hours"]
                    opening = custom_hours.get("opening")
                    closing = custom_hours.get("closing")
                    closed_days[date_str] = {
                        "reason": "special_day",
                        "type": "custom_hours",
                        "custom_hours": (opening, closing),
                        "description": special_day.get(
                            "name",
                            "Special Day",
                        ),
                    }
                current_date += timedelta(days=1)
                continue

            # Check regular opening days
            weekday = str(current_date.weekday())
            if not self.settings.opening_days.get(weekday, False):
                day_names = [
                    "Montag",
                    "Dienstag",
                    "Mittwoch",
                    "Donnerstag",
                    "Freitag",
                    "Samstag",
                    "Sonntag",
                ]
                closed_days[date_str] = {
                    "reason": "weekend",
                    "type": "closed",
                    "description": f"{day_names[int(weekday)]} (geschlossen)",
                }

            current_date += timedelta(days=1)

        return closed_days

    def validate_vacation_dates(self, start_date: date, end_date: date) -> dict:
        """Validate vacation dates and provide feedback.

        Returns analysis of the vacation period including:
        - Number of working days
        - Number of closed days
        - Warnings about non-working days

        Args:
            start_date: Vacation start date
            end_date: Vacation end date

        Returns:
            Dictionary with validation results:
            {
                "is_valid": bool,
                "working_days": int,
                "total_days": int,
                "closed_days": int,
                "closed_day_list": [
                    {
                        "date": "2024-12-25",
                        "reason": "special_day",
                        "description": "..."
                    }
                ],
                "warnings": [
                    "Vacation includes 2 non-working days (weekends/holidays)"
                ],
                "message": "Vacation period includes closed days"
            }
        """
        if end_date < start_date:
            return {
                "is_valid": False,
                "error": "End date must be after start date",
            }

        total_days = (end_date - start_date).days + 1
        working_days = len(self.get_working_days_in_range(start_date, end_date))
        closed_days_dict = self.get_closed_days_in_range(start_date, end_date)
        closed_days_count = len(closed_days_dict)

        warnings = []

        # Warn if vacation includes closed days
        if closed_days_count > 0:
            warning_msg = (
                f"Vacation period includes {closed_days_count} "
                f"non-working day(s) (weekends/special days/holidays)"
            )
            warnings.append(warning_msg)

        # Warn if vacation is mostly on closed days
        if working_days == 0:
            warnings.append(
                "Vacation period contains no working days - "
                "store is closed for entire period"
            )

        return {
            "is_valid": True,
            "working_days": working_days,
            "closed_days": closed_days_count,
            "total_days": total_days,
            "closed_day_list": [
                {
                    "date": date_str,
                    "reason": info["reason"],
                    "type": info["type"],
                    "description": info.get("description", ""),
                    "custom_hours": info.get("custom_hours"),
                }
                for date_str, info in closed_days_dict.items()
            ],
            "warnings": warnings,
            "message": (
                f"Vacation spans {total_days} calendar days "
                f"({working_days} working days, "
                f"{closed_days_count} non-working days)"
            ),
        }

    def get_vacation_summary_for_period(self, start_date: date, end_date: date) -> dict:
        """Get a summary of working days and closed days for a date range.

        Useful for displaying in UI to help users plan vacations.

        Args:
            start_date: Period start date
            end_date: Period end date

        Returns:
            Summary dictionary with breakdown of days
        """
        working_days = self.get_working_days_in_range(start_date, end_date)
        closed_days_dict = self.get_closed_days_in_range(start_date, end_date)

        return {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "total_days": (end_date - start_date).days + 1,
            "working_days_count": len(working_days),
            "closed_days_count": len(closed_days_dict),
            "working_days": [d.isoformat() for d in working_days],
            "closed_days": {
                date_str: info for date_str, info in closed_days_dict.items()
            },
        }

    def count_working_days(self, start_date: date, end_date: date) -> int:
        """Count working days in a date range.

        Args:
            start_date: Start date
            end_date: End date

        Returns:
            Number of working days
        """
        return len(self.get_working_days_in_range(start_date, end_date))

    def log_vacation_analysis(
        self,
        employee_id: int,
        start_date: date,
        end_date: date,
        analysis: dict,
    ) -> None:
        """Log vacation planning analysis for audit purposes.

        Args:
            employee_id: Employee ID
            start_date: Vacation start date
            end_date: Vacation end date
            analysis: Analysis result from validate_vacation_dates
        """
        if analysis.get("is_valid"):
            logger.info(
                f"Vacation planned for employee {employee_id}: "
                f"{start_date} to {end_date} "
                f"({analysis['total_days']} days, "
                f"{analysis['working_days']} working days)"
            )
        else:
            error_msg = analysis.get("error", "Unknown error")
            logger.warning(
                f"Invalid vacation dates for employee {employee_id}: "
                f"{start_date} to {end_date} - {error_msg}"
            )
