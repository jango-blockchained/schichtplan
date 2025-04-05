from flask import Blueprint, request, jsonify, current_app
from http import HTTPStatus
from datetime import datetime

# Relative imports
from ..models import Schedule
from ..services.scheduler.resources import ScheduleResources, ScheduleResourceError
from ..services.scheduler.validator import ScheduleValidator, ScheduleConfig
from ..utils.logger import logger

validation_bp = Blueprint(
    "schedule_validation", __name__, url_prefix="/api/schedules"
)


@validation_bp.route("/validate", methods=["POST"])
def validate_schedule_route():
    """Validate an existing schedule based on provided IDs or date range."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), HTTPStatus.BAD_REQUEST

        schedule_ids = data.get("schedule_ids")
        start_date_str = data.get("start_date")
        end_date_str = data.get("end_date")
        version = data.get("version")
        validate_uniqueness = data.get("validate_uniqueness", True)

        schedules_to_validate = []

        if schedule_ids:
            if not isinstance(schedule_ids, list):
                return (
                    jsonify({"error": "schedule_ids must be a list"}), 
                    HTTPStatus.BAD_REQUEST
                )
            schedules_to_validate = Schedule.query.filter(
                Schedule.id.in_(schedule_ids)
            ).all()
        elif start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            except ValueError:
                return (
                    jsonify({"error": "Invalid date format"}), 
                    HTTPStatus.BAD_REQUEST
                )
            
            query = Schedule.query.filter(
                Schedule.date >= start_date, Schedule.date <= end_date
            )
            if version is not None:
                query = query.filter(Schedule.version == version)
            schedules_to_validate = query.all()
        else:
            return jsonify({"error": "Provide IDs or date range"}), HTTPStatus.BAD_REQUEST

        if not schedules_to_validate:
            return jsonify({"error": "No schedules found"}), HTTPStatus.NOT_FOUND

        # Create resources and validator
        log = getattr(current_app, "logger", logger)
        resources = ScheduleResources()
        validator = ScheduleValidator(resources)

        # Create config from request or use defaults
        config = ScheduleConfig(
            # Add config options based on validator needs and request data
            enforce_min_coverage=data.get("enforce_min_coverage", True),
            enforce_contracted_hours=data.get("enforce_contracted_hours", True),
            # ... other config flags
        )

        validation_errors = validator.validate(schedules_to_validate, config)

        errors_list = [
            {
                "type": err.error_type,
                "message": err.message,
                "severity": err.severity,
                "details": err.details or {},
            }
            for err in validation_errors
        ]

        return jsonify(
            {
                "valid": len(errors_list) == 0,
                "errors": errors_list,
                "schedule_count": len(schedules_to_validate),
                "validation_time": datetime.now().isoformat(),
            }
        ), HTTPStatus.OK

    except ScheduleResourceError as e:
        return jsonify({"error": f"Resource error: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        logger.exception("Error validating schedule")
        return (
            jsonify({"error": f"Unexpected error: {str(e)}"}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        ) 