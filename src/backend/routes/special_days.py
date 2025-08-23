import logging
from datetime import datetime
from http import HTTPStatus

from flask import Blueprint, jsonify, request
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from src.backend.models import Settings, db
from src.backend.schemas.settings import SpecialDay

special_days = Blueprint("special_days", __name__)


@special_days.route("/settings/special-days", methods=["GET"])
@special_days.route("/settings/special-days/", methods=["GET"])
def get_special_days():
    """
    Retrieve all special days from settings

    Returns:
        JSON response with special days data
    """
    settings = db.session.query(Settings).first()
    if not settings:
        return jsonify({"special_days": {}}), HTTPStatus.OK

    # Handle both special_days and legacy special_hours
    existing_sd = getattr(settings, "special_days", None)
    if isinstance(existing_sd, dict) and existing_sd:
        return jsonify({"special_days": existing_sd}), HTTPStatus.OK

    # Convert from legacy format if needed
    days_map = {}
    legacy_hours = getattr(settings, "special_hours", None)
    if isinstance(legacy_hours, dict):
        for date_str, details in legacy_hours.items():
            days_map[date_str] = {
                "description": f"Special Day ({date_str})",
                "is_closed": details.get("is_closed", False),
                "custom_hours": (
                    {
                        "opening": details.get("opening", settings.store_opening),
                        "closing": details.get("closing", settings.store_closing),
                    }
                    if not details.get("is_closed", False)
                    else None
                ),
            }
    return jsonify({"special_days": days_map}), HTTPStatus.OK


@special_days.route("/settings/special-days", methods=["POST"])
@special_days.route("/settings/special-days/", methods=["POST"])
def add_update_special_day():
    """
    Add or update a special day

    Expected JSON payload:
    {
        "date": "YYYY-MM-DD",
        "description": "Holiday or special event description",
        "is_closed": true|false,
        "custom_hours": {
            "opening": "HH:MM",
            "closing": "HH:MM"
        }
    }

    Returns:
        HTTP 200: JSON response with success message
        HTTP 400: JSON response with error details if request is invalid
        HTTP 500: JSON response with error message if server error occurs
    """
    if not request.is_json:
        return (
            jsonify(
                {
                    "error": "Request must be JSON",
                    "message": "Content-Type must be application/json",
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )

    data = request.get_json(silent=True) or {}

    # Validate date format
    date_str = data.get("date")
    if not date_str:
        return (
            jsonify(
                {
                    "error": "Missing required field",
                    "message": "Date is required",
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )

    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return (
            jsonify(
                {
                    "error": "Invalid date format",
                    "message": "Date must be in YYYY-MM-DD format",
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )

    # Validate data using Pydantic model
    try:
        special_day = SpecialDay(
            description=data.get("description", ""),
            is_closed=data.get("is_closed", False),
            custom_hours=(
                data.get("custom_hours") if not data.get("is_closed", False) else None
            ),
        )
    except ValidationError as e:
        return (
            jsonify({"error": "Invalid data format", "message": str(e)}),
            HTTPStatus.BAD_REQUEST,
        )

    # Get settings and update special_days
    settings = db.session.query(Settings).first()
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)

    # Initialize special_days if needed
    existing_sd = getattr(settings, "special_days", None)
    if not isinstance(existing_sd, dict):
        existing_sd = {}

    new_map = dict(existing_sd)
    new_map[date_str] = special_day.dict(exclude_none=True)

    try:
        settings.special_days = new_map
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        logging.error("Error adding/updating special day: %s", exc)
        return (
            jsonify(
                {
                    "error": "Server error adding/updating special day",
                    "message": str(exc),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )

    return (
        jsonify({"message": f"Special day {date_str} added/updated successfully"}),
        HTTPStatus.OK,
    )


@special_days.route("/settings/special-days/<date>", methods=["DELETE"])
def delete_special_day(date):
    """
    Delete a special day by date

    Args:
        date: Date string in YYYY-MM-DD format

    Returns:
        HTTP 200: JSON response with success message
        HTTP 404: JSON response if special day not found
        HTTP 500: JSON response with error message if server error occurs
    """
    # Validate date format
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return (
            jsonify(
                {
                    "error": "Invalid date format",
                    "message": "Date must be in YYYY-MM-DD format",
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )

    # Get settings and existing special days
    settings = db.session.query(Settings).first()
    existing = getattr(settings, "special_days", None) if settings else None
    if not settings or not isinstance(existing, dict) or date not in existing:
        return (
            jsonify(
                {
                    "error": "Not found",
                    "message": f"No special day found for date {date}",
                }
            ),
            HTTPStatus.NOT_FOUND,
        )

    # Remove the special day by reassigning the dict to ensure change tracking
    new_map = dict(existing)
    new_map.pop(date, None)

    try:
        settings.special_days = new_map
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        logging.error("Error deleting special day: %s", exc)
        return (
            jsonify(
                {
                    "error": "Server error deleting special day",
                    "message": str(exc),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )

    return (
        jsonify({"message": f"Special day {date} deleted successfully"}),
        HTTPStatus.OK,
    )
