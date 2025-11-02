"""Validation endpoints for vacation planning.

Provides endpoints for validating vacation dates against store opening days,
special days, and notional holidays.
"""

from datetime import datetime

from flask import Blueprint, jsonify, request

from src.backend.services.vacation_planning import VacationPlanningService

bp = Blueprint("absences_validation", __name__)


@bp.route("/validate", methods=["POST"])
@bp.route("/absences/validate", methods=["POST"])
def validate_vacation_dates():
    """Validate vacation dates and provide analysis.

    This endpoint checks if the requested vacation period includes
    non-working days (weekends, special days, closed days) and provides
    warnings and detailed information.

    Request body:
      - start_date: YYYY-MM-DD (required)
      - end_date: YYYY-MM-DD (required)

    Returns:
      - is_valid: bool
      - working_days: int (count of working days)
      - closed_days: int (count of non-working days)
      - total_days: int (total calendar days)
      - closed_day_list: list of closed day details
      - warnings: list of warning messages
      - message: human-readable summary
    """
    try:
        data = request.get_json()

        # Validate required fields
        if "start_date" not in data or "end_date" not in data:
            return (
                jsonify(
                    {
                        "error": "start_date and end_date are required",
                    }
                ),
                400,
            )

        try:
            start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
            end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
        except ValueError:
            return (
                jsonify(
                    {
                        "error": "Invalid date format. Use YYYY-MM-DD.",
                    }
                ),
                400,
            )

        # Create vacation planning service and validate
        service = VacationPlanningService()
        analysis = service.validate_vacation_dates(start_date, end_date)

        return jsonify(analysis), 200

    except Exception as e:
        return (
            jsonify({"status": "error", "message": str(e)}),
            500,
        )


@bp.route("/period-summary", methods=["POST"])
@bp.route("/absences/period-summary", methods=["POST"])
def get_period_summary():
    """Get a summary of working/closed days for a period.

    This endpoint provides a breakdown of working days and closed days
    for a given date range, useful for displaying in the UI.

    Request body:
      - start_date: YYYY-MM-DD (required)
      - end_date: YYYY-MM-DD (required)

    Returns:
      - period_start: ISO date string
      - period_end: ISO date string
      - total_days: int
      - working_days_count: int
      - closed_days_count: int
      - working_days: list of ISO date strings
      - closed_days: dict with detailed closed day info
    """
    try:
        data = request.get_json()

        # Validate required fields
        if "start_date" not in data or "end_date" not in data:
            return (
                jsonify(
                    {
                        "error": "start_date and end_date are required",
                    }
                ),
                400,
            )

        try:
            start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
            end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
        except ValueError:
            return (
                jsonify(
                    {
                        "error": "Invalid date format. Use YYYY-MM-DD.",
                    }
                ),
                400,
            )

        # Create vacation planning service and get summary
        service = VacationPlanningService()
        summary = service.get_vacation_summary_for_period(start_date, end_date)

        return jsonify(summary), 200

    except Exception as e:
        return (
            jsonify({"status": "error", "message": str(e)}),
            500,
        )
