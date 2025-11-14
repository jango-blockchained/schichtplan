"""Routes for staffing plan and occupancy statistics.

Provides endpoints for:
- Daily staffing statistics (present, vacation, absent)
- Heatmap data for visualization
- Detailed employee absence breakdown
"""

from datetime import datetime
from http import HTTPStatus

from flask import Blueprint, jsonify, request

from src.backend.services.staffing_service import StaffingService
from src.backend.utils.logger import logger

bp = Blueprint("staffing_plan", __name__)

# Constants
MIN_YEAR = 2020
MAX_YEAR_OFFSET = 5


@bp.route("/staffing-plan/statistics", methods=["GET"])
def get_staffing_statistics():
    """Get daily staffing statistics for a date range.

    Query parameters:
        start_date (required): Start date in YYYY-MM-DD format
        end_date (required): End date in YYYY-MM-DD format

    Returns:
        JSON with daily statistics including present, vacation, and absent counts
    """
    try:
        # Get and validate date parameters
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")

        if not start_date_str or not end_date_str:
            return jsonify(
                {
                    "status": "error",
                    "message": "start_date and end_date parameters are required",
                }
            ), HTTPStatus.BAD_REQUEST

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {
                    "status": "error",
                    "message": "Dates must be in YYYY-MM-DD format",
                }
            ), HTTPStatus.BAD_REQUEST

        # Validate date range
        if start_date > end_date:
            return jsonify(
                {
                    "status": "error",
                    "message": "start_date must be before or equal to end_date",
                }
            ), HTTPStatus.BAD_REQUEST

        # Calculate statistics
        service = StaffingService()
        statistics = service.get_daily_statistics(start_date, end_date)

        logger.info(
            f"Retrieved staffing statistics from {start_date} to {end_date}"
        )

        return jsonify(
            {
                "status": "success",
                "data": statistics,
            }
        ), HTTPStatus.OK

    except Exception as e:
        logger.error(f"Error retrieving staffing statistics: {str(e)}", exc_info=True)
        return jsonify(
            {
                "status": "error",
                "message": f"Failed to retrieve statistics: {str(e)}",
            }
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/staffing-plan/heatmap", methods=["GET"])
def get_staffing_heatmap():
    """Get heatmap data for staffing visualization.

    Query parameters:
        start_date (required): Start date in YYYY-MM-DD format
        end_date (required): End date in YYYY-MM-DD format
        metric (optional): Metric to display ('total_absent', 'on_vacation', 'present')
                          Default: 'total_absent'

    Returns:
        JSON with heatmap data optimized for visualization
    """
    try:
        # Get and validate date parameters
        start_date_str = request.args.get("start_date")
        end_date_str = request.args.get("end_date")
        metric = request.args.get("metric", "total_absent")

        if not start_date_str or not end_date_str:
            return jsonify(
                {
                    "status": "error",
                    "message": "start_date and end_date parameters are required",
                }
            ), HTTPStatus.BAD_REQUEST

        # Validate metric
        valid_metrics = ["total_absent", "on_vacation", "present", "absent"]
        if metric not in valid_metrics:
            return jsonify(
                {
                    "status": "error",
                    "message": f"metric must be one of: {', '.join(valid_metrics)}",
                }
            ), HTTPStatus.BAD_REQUEST

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {
                    "status": "error",
                    "message": "Dates must be in YYYY-MM-DD format",
                }
            ), HTTPStatus.BAD_REQUEST

        # Validate date range
        if start_date > end_date:
            return jsonify(
                {
                    "status": "error",
                    "message": "start_date must be before or equal to end_date",
                }
            ), HTTPStatus.BAD_REQUEST

        # Get heatmap data
        service = StaffingService()
        heatmap_data = service.get_heatmap_data(start_date, end_date, metric)

        logger.info(
            f"Retrieved heatmap data from {start_date} to {end_date} "
            f"for metric '{metric}'"
        )

        return jsonify(
            {
                "status": "success",
                "data": heatmap_data,
            }
        ), HTTPStatus.OK

    except Exception as e:
        logger.error(f"Error retrieving heatmap data: {str(e)}", exc_info=True)
        return jsonify(
            {
                "status": "error",
                "message": f"Failed to retrieve heatmap data: {str(e)}",
            }
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/staffing-plan/details/<date_string>", methods=["GET"])
def get_staffing_details(date_string: str):
    """Get detailed breakdown of employee absences for a specific date.

    Path parameters:
        date_string: Date in YYYY-MM-DD format

    Returns:
        JSON with lists of present, vacation, and absent employees
    """
    try:
        # Parse and validate date
        try:
            target_date = datetime.strptime(date_string, "%Y-%m-%d").date()
        except ValueError:
            return jsonify(
                {
                    "status": "error",
                    "message": "Date must be in YYYY-MM-DD format",
                }
            ), HTTPStatus.BAD_REQUEST

        # Get employee details
        service = StaffingService()
        details = service.get_employee_absence_details(target_date)

        logger.info(f"Retrieved staffing details for {target_date}")

        return jsonify(
            {
                "status": "success",
                "data": details,
            }
        ), HTTPStatus.OK

    except Exception as e:
        logger.error(f"Error retrieving staffing details: {str(e)}", exc_info=True)
        return jsonify(
            {
                "status": "error",
                "message": f"Failed to retrieve details: {str(e)}",
            }
        ), HTTPStatus.INTERNAL_SERVER_ERROR
