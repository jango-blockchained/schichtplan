from flask import Blueprint, jsonify, request
from http import HTTPStatus
import logging
from datetime import datetime
from models import db, Settings

holiday_import = Blueprint("holiday_import", __name__)


@holiday_import.route("/holidays/import", methods=["POST"])
@holiday_import.route("/holidays/import/", methods=["POST"])
def import_holidays():
    """
    Import selected holidays as special days in the settings.

    Expected JSON payload:
    {
        "holidays": [
            {
                "date": "2023-01-01",
                "name": "New Year's Day",
                "type": "National",
                "description": "Optional description"
            },
            ...
        ],
        "is_closed": true  // Whether the store should be closed on these days
    }

    Returns:
        HTTP 200: JSON response with success message and count of imported holidays
        HTTP 400: JSON response with error details if request is invalid
        HTTP 500: JSON response with error message if server error occurs
    """
    try:
        if not request.is_json:
            return jsonify(
                {
                    "error": "Request must be JSON",
                    "message": "Content-Type must be application/json",
                }
            ), HTTPStatus.BAD_REQUEST

        data = request.get_json()

        if not isinstance(data.get("holidays"), list):
            return jsonify(
                {
                    "error": "Invalid request format",
                    "message": "Expected 'holidays' array in request",
                }
            ), HTTPStatus.BAD_REQUEST

        is_closed = data.get("is_closed", True)
        holidays_to_import = data.get("holidays", [])

        if not holidays_to_import:
            return jsonify(
                {"message": "No holidays provided for import", "imported": 0}
            ), HTTPStatus.OK

        # Get current settings
        settings = db.session.query(Settings).first()
        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)

        # Initialize special_days if needed
        if not hasattr(settings, "special_days") or settings.special_days is None:
            settings.special_days = {}

        # Convert holidays to special days format
        imported_count = 0
        for holiday in holidays_to_import:
            date_str = holiday.get("date")

            # Validate date format
            try:
                datetime.strptime(date_str, "%Y-%m-%d")
            except (ValueError, TypeError):
                logging.warning(f"Invalid date format in holiday import: {date_str}")
                continue

            # Create special day entry
            settings.special_days[date_str] = {
                "description": holiday.get("name", "Holiday")
                + (
                    f" ({holiday.get('description', '')})"
                    if holiday.get("description")
                    else ""
                ),
                "is_closed": is_closed,
                # Add custom_hours field only if store is not closed
                **(
                    {
                        "custom_hours": {
                            "opening": settings.store_opening,
                            "closing": settings.store_closing,
                        }
                    }
                    if not is_closed
                    else {}
                ),
            }

            imported_count += 1

        # Save changes
        db.session.commit()

        return jsonify(
            {
                "message": f"Successfully imported {imported_count} holidays",
                "imported": imported_count,
            }
        ), HTTPStatus.OK

    except Exception as e:
        logging.error(f"Error importing holidays: {str(e)}")
        db.session.rollback()
        return jsonify(
            {"error": "Server error during holiday import", "message": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
