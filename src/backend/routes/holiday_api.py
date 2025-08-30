import logging

from flask import Blueprint, jsonify, request

from src.backend.models import Settings, db
from src.backend.services.holiday_service import HolidayService

holiday_bp = Blueprint("holiday", __name__, url_prefix="/api/holiday")


@holiday_bp.route("/german/<int:year>", methods=["GET"])
def get_german_holidays(year):
    """
    Get German holidays for a specific year

    Query parameters:
    - state: Optional federal state code (e.g., 'BW', 'BY')
    """
    try:
        state = request.args.get("state")
        holidays = HolidayService.get_all_german_holidays(year, state)

        return jsonify(
            {
                "success": True,
                "year": year,
                "state": state,
                "holidays": [
                    {
                        "date": h.date,
                        "name": h.name,
                        "type": h.type,
                        "description": h.description,
                        "is_closed": h.is_closed,
                        "custom_hours": h.custom_hours,
                    }
                    for h in holidays
                ],
                "count": len(holidays),
            }
        )

    except Exception as e:
        logging.error(f"Error getting German holidays: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@holiday_bp.route("/import/german/<int:year>", methods=["POST"])
def import_german_holidays(year):
    """
    Import German holidays for a specific year

    Query parameters:
    - state: Optional federal state code
    - force: If true, overwrite existing holidays
    """
    try:
        state = request.args.get("state")
        force = request.args.get("force", "false").lower() == "true"

        holidays = HolidayService.get_all_german_holidays(year, state)

        if not force:
            # Check for existing holidays
            settings = db.session.query(Settings).first()
            if settings and hasattr(settings, "special_days") and settings.special_days:
                existing_dates = set(settings.special_days.keys())
                holiday_dates = set(h.date for h in holidays)
                conflicts = existing_dates.intersection(holiday_dates)

                if conflicts:
                    return jsonify(
                        {
                            "success": False,
                            "message": f"Found {len(conflicts)} existing holidays. Use force=true to overwrite.",
                            "conflicts": list(conflicts),
                        }
                    ), 409

        result = HolidayService.bulk_import_holidays(holidays)

        return jsonify(result)

    except Exception as e:
        logging.error(f"Error importing German holidays: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@holiday_bp.route("/statistics", methods=["GET"])
def get_holiday_statistics():
    """
    Get holiday statistics

    Query parameters:
    - year: Optional year to filter statistics
    """
    try:
        year = request.args.get("year", type=int)
        stats = HolidayService.get_holiday_statistics(year)

        return jsonify({"success": True, "statistics": stats, "year": year})

    except Exception as e:
        logging.error(f"Error getting holiday statistics: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@holiday_bp.route("/federal-states", methods=["GET"])
def get_federal_states():
    """
    Get list of German federal states
    """
    try:
        return jsonify({"success": True, "states": HolidayService.FEDERAL_STATES})

    except Exception as e:
        logging.error(f"Error getting federal states: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@holiday_bp.route("/validate-date/<date_str>", methods=["GET"])
def validate_holiday_date(date_str):
    """
    Validate if a date string is a valid holiday date format
    """
    try:
        is_valid = HolidayService.validate_holiday_date(date_str)

        return jsonify({"success": True, "date": date_str, "is_valid": is_valid})

    except Exception as e:
        logging.error(f"Error validating date: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@holiday_bp.route("/preview/<int:year>", methods=["GET"])
def preview_holidays(year):
    """
    Preview holidays for a year without importing them

    Query parameters:
    - state: Optional federal state code
    """
    try:
        state = request.args.get("state")
        holidays = HolidayService.get_all_german_holidays(year, state)

        # Group by month for better organization
        by_month = {}
        for holiday in holidays:
            month = holiday.date[5:7]  # Extract MM from YYYY-MM-DD
            if month not in by_month:
                by_month[month] = []
            by_month[month].append(
                {
                    "date": holiday.date,
                    "name": holiday.name,
                    "type": holiday.type,
                    "is_closed": holiday.is_closed,
                }
            )

        return jsonify(
            {
                "success": True,
                "year": year,
                "state": state,
                "total_holidays": len(holidays),
                "holidays_by_month": by_month,
            }
        )

    except Exception as e:
        logging.error(f"Error previewing holidays: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500
