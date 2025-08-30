import logging
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from src.backend.models import Settings, db


@dataclass
class HolidayInfo:
    """Data class for holiday information"""

    date: str
    name: str
    type: str
    description: Optional[str] = None
    is_closed: bool = True
    custom_hours: Optional[Dict[str, str]] = None


class HolidayService:
    """Service for managing holidays and special days data"""

    # German federal states for regional holidays
    FEDERAL_STATES = {
        "BW": "Baden-Württemberg",
        "BY": "Bayern",
        "BE": "Berlin",
        "BB": "Brandenburg",
        "HB": "Bremen",
        "HH": "Hamburg",
        "HE": "Hessen",
        "MV": "Mecklenburg-Vorpommern",
        "NI": "Niedersachsen",
        "NW": "Nordrhein-Westfalen",
        "RP": "Rheinland-Pfalz",
        "SL": "Saarland",
        "SN": "Sachsen",
        "ST": "Sachsen-Anhalt",
        "SH": "Schleswig-Holstein",
        "TH": "Thüringen",
    }

    @staticmethod
    def get_german_holidays(
        year: int, state: Optional[str] = None
    ) -> List[HolidayInfo]:
        """
        Get comprehensive list of German holidays for a given year

        Args:
            year: Year to get holidays for
            state: Optional federal state code for state-specific holidays

        Returns:
            List of HolidayInfo objects
        """
        holidays = []

        # Fixed national holidays
        national_holidays = {
            f"{year}-01-01": HolidayInfo(f"{year}-01-01", "Neujahr", "National"),
            f"{year}-05-01": HolidayInfo(f"{year}-05-01", "Tag der Arbeit", "National"),
            f"{year}-10-03": HolidayInfo(
                f"{year}-10-03", "Tag der Deutschen Einheit", "National"
            ),
            f"{year}-11-01": HolidayInfo(f"{year}-11-01", "Allerheiligen", "Religious"),
            f"{year}-12-25": HolidayInfo(
                f"{year}-12-25", "1. Weihnachtsfeiertag", "Religious"
            ),
            f"{year}-12-26": HolidayInfo(
                f"{year}-12-26", "2. Weihnachtsfeiertag", "Religious"
            ),
        }

        # State-specific holidays
        state_holidays = {
            "BW": {  # Baden-Württemberg
                f"{year}-01-06": HolidayInfo(
                    f"{year}-01-06", "Heilige Drei Könige", "Religious"
                ),
                f"{year}-08-15": HolidayInfo(
                    f"{year}-08-15", "Mariä Himmelfahrt", "Religious"
                ),
            },
            "BY": {  # Bayern
                f"{year}-01-06": HolidayInfo(
                    f"{year}-01-06", "Heilige Drei Könige", "Religious"
                ),
                f"{year}-08-15": HolidayInfo(
                    f"{year}-08-15", "Mariä Himmelfahrt", "Religious"
                ),
            },
            "BE": {  # Berlin
                # Berlin has no additional state holidays
            },
            "BB": {  # Brandenburg
                f"{year}-10-31": HolidayInfo(
                    f"{year}-10-31", "Reformationstag", "Religious"
                ),
            },
            "HB": {  # Bremen
                # Bremen has no additional state holidays
            },
            "HH": {  # Hamburg
                # Hamburg has no additional state holidays
            },
            "HE": {  # Hessen
                f"{year}-08-15": HolidayInfo(
                    f"{year}-08-15", "Mariä Himmelfahrt", "Religious"
                ),
            },
            "MV": {  # Mecklenburg-Vorpommern
                f"{year}-10-31": HolidayInfo(
                    f"{year}-10-31", "Reformationstag", "Religious"
                ),
            },
            "NI": {  # Niedersachsen
                # Niedersachsen has no additional state holidays
            },
            "NW": {  # Nordrhein-Westfalen
                f"{year}-08-15": HolidayInfo(
                    f"{year}-08-15", "Mariä Himmelfahrt", "Religious"
                ),
            },
            "RP": {  # Rheinland-Pfalz
                f"{year}-08-15": HolidayInfo(
                    f"{year}-08-15", "Mariä Himmelfahrt", "Religious"
                ),
            },
            "SL": {  # Saarland
                f"{year}-08-15": HolidayInfo(
                    f"{year}-08-15", "Mariä Himmelfahrt", "Religious"
                ),
            },
            "SN": {  # Sachsen
                f"{year}-10-31": HolidayInfo(
                    f"{year}-10-31", "Reformationstag", "Religious"
                ),
            },
            "ST": {  # Sachsen-Anhalt
                f"{year}-01-06": HolidayInfo(
                    f"{year}-01-06", "Heilige Drei Könige", "Religious"
                ),
                f"{year}-10-31": HolidayInfo(
                    f"{year}-10-31", "Reformationstag", "Religious"
                ),
            },
            "SH": {  # Schleswig-Holstein
                # Schleswig-Holstein has no additional state holidays
            },
            "TH": {  # Thüringen
                f"{year}-10-31": HolidayInfo(
                    f"{year}-10-31", "Reformationstag", "Religious"
                ),
            },
        }

        # Add national holidays
        holidays.extend(national_holidays.values())

        # Add state-specific holidays if state is provided
        if state and state in state_holidays:
            holidays.extend(state_holidays[state].values())

        return holidays

    @staticmethod
    def calculate_easter_holidays(year: int) -> Dict[str, HolidayInfo]:
        """
        Calculate Easter-related holidays for a given year

        Args:
            year: Year to calculate holidays for

        Returns:
            Dictionary of Easter-related holidays
        """
        # Easter calculation using Meeus/Jones/Butcher algorithm
        a = year % 19
        b = year // 100
        c = year % 100
        d = b // 4
        e = b % 4
        f = (b + 8) // 25
        g = (b - f + 1) // 3
        h = (19 * a + b - d - g + 15) % 30
        i = c // 4
        k = c % 4
        l = (32 + 2 * e + 2 * i - h - k) % 7
        m = (a + 11 * h + 22 * l) // 451
        month = (h + l - 7 * m + 114) // 31
        day = ((h + l - 7 * m + 114) % 31) + 1

        easter_date = date(year, month, day)

        # Calculate related holidays
        good_friday = easter_date.replace(day=easter_date.day - 2)
        easter_monday = easter_date.replace(day=easter_date.day + 1)
        ascension = easter_date.replace(day=easter_date.day + 39)
        pentecost_sunday = easter_date.replace(day=easter_date.day + 49)
        pentecost_monday = easter_date.replace(day=easter_date.day + 50)
        corpus_christi = easter_date.replace(day=easter_date.day + 60)

        return {
            good_friday.isoformat(): HolidayInfo(
                good_friday.isoformat(), "Karfreitag", "Religious"
            ),
            easter_monday.isoformat(): HolidayInfo(
                easter_monday.isoformat(), "Ostermontag", "Religious"
            ),
            ascension.isoformat(): HolidayInfo(
                ascension.isoformat(), "Christi Himmelfahrt", "Religious"
            ),
            pentecost_monday.isoformat(): HolidayInfo(
                pentecost_monday.isoformat(), "Pfingstmontag", "Religious"
            ),
            corpus_christi.isoformat(): HolidayInfo(
                corpus_christi.isoformat(), "Fronleichnam", "Religious"
            ),
            pentecost_sunday.isoformat(): HolidayInfo(
                pentecost_sunday.isoformat(),
                "Pfingstsonntag",
                "Religious",
                is_closed=False,
                custom_hours={"opening": "10:00", "closing": "16:00"},
            ),
        }

    @staticmethod
    def get_all_german_holidays(
        year: int, state: Optional[str] = None
    ) -> List[HolidayInfo]:
        """
        Get all German holidays including Easter-related ones

        Args:
            year: Year to get holidays for
            state: Optional federal state code

        Returns:
            Complete list of German holidays
        """
        # Get fixed holidays
        holidays = HolidayService.get_german_holidays(year, state)

        # Add Easter-related holidays
        easter_holidays = HolidayService.calculate_easter_holidays(year)
        holidays.extend(easter_holidays.values())

        # Sort by date
        holidays.sort(key=lambda x: x.date)

        return holidays

    @staticmethod
    def bulk_import_holidays(holidays: List[HolidayInfo]) -> Dict[str, Any]:
        """
        Bulk import holidays into the system

        Args:
            holidays: List of holidays to import

        Returns:
            Import result summary
        """
        try:
            settings = db.session.query(Settings).first()
            if not settings:
                settings = Settings.get_default_settings()
                db.session.add(settings)

            if not hasattr(settings, "special_days") or settings.special_days is None:
                settings.special_days = {}

            imported_count = 0
            skipped_count = 0

            for holiday in holidays:
                if holiday.date in settings.special_days:
                    skipped_count += 1
                    continue

                settings.special_days[holiday.date] = {
                    "description": holiday.name,
                    "is_closed": holiday.is_closed,
                    **(
                        {"custom_hours": holiday.custom_hours}
                        if holiday.custom_hours
                        else {}
                    ),
                }
                imported_count += 1

            db.session.commit()

            return {
                "success": True,
                "imported": imported_count,
                "skipped": skipped_count,
                "total": len(holidays),
                "message": f"Successfully imported {imported_count} holidays, skipped {skipped_count} existing ones",
            }

        except Exception as e:
            db.session.rollback()
            logging.error(f"Error importing holidays: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to import holidays",
            }

    @staticmethod
    def get_holiday_statistics(year: Optional[int] = None) -> Dict[str, Any]:
        """
        Get statistics about configured holidays

        Args:
            year: Optional year to filter statistics

        Returns:
            Holiday statistics
        """
        try:
            settings = db.session.query(Settings).first()
            if not settings or not hasattr(settings, "special_days"):
                return {"total_holidays": 0, "closed_days": 0, "custom_hours_days": 0}

            special_days = settings.special_days or {}

            if year:
                # Filter by year
                year_str = str(year)
                special_days = {
                    date: details
                    for date, details in special_days.items()
                    if date.startswith(year_str)
                }

            total = len(special_days)
            closed = sum(
                1
                for details in special_days.values()
                if details.get("is_closed", False)
            )
            custom_hours = sum(
                1
                for details in special_days.values()
                if not details.get("is_closed", False) and details.get("custom_hours")
            )

            return {
                "total_holidays": total,
                "closed_days": closed,
                "custom_hours_days": custom_hours,
                "regular_days": total - closed - custom_hours,
            }

        except Exception as e:
            logging.error(f"Error getting holiday statistics: {str(e)}")
            return {"error": str(e)}

    @staticmethod
    def validate_holiday_date(date_str: str) -> bool:
        """
        Validate if a date string is a valid holiday date format

        Args:
            date_str: Date string in YYYY-MM-DD format

        Returns:
            True if valid, False otherwise
        """
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
            return True
        except ValueError:
            return False
