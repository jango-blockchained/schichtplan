from flask import Blueprint, request, jsonify, current_app
from http import HTTPStatus
from datetime import datetime

# Relative imports
from ..utils.logger import logger  # Assuming logger is configured in app
from ..services.scheduler.generator import ScheduleGenerator
from ..services.scheduler.resources import (
    ScheduleResources, ScheduleResourceError
)
from ..services.scheduler.day_mapper import get_coverage_day_index
from ..services.scheduler.config import SchedulerConfig

# Define blueprint
generation_bp = Blueprint(
    "schedule_generation", __name__, url_prefix="/api/schedules"
)

# Helper function to get date range (copied from original schedules.py)
def get_date_range(args):
    start_date_str = args.get("start_date")
    end_date_str = args.get("end_date")
    
    if not start_date_str or not end_date_str:
        raise ValueError("start_date and end_date are required")
        
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    return start_date, end_date

# New endpoint for testing day mapping
@generation_bp.route("/day-mapping", methods=["POST"])
def test_day_mapping():
    """Test endpoint for day mapping functionality."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing request body"}), HTTPStatus.BAD_REQUEST
            
        # Extract dates from request
        date_strings = data.get("dates", [])
        if not date_strings:
            return jsonify({"error": "No dates provided"}), HTTPStatus.BAD_REQUEST
            
        # Convert string dates to date objects and calculate coverage day indices
        result = {"mappings": []}
        
        for date_str in date_strings:
            try:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
                weekday = date_obj.weekday()
                weekday_name = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekday]
                coverage_day_index = get_coverage_day_index(date_obj)
                
                mapping = {
                    "date": date_str,
                    "weekday": weekday,
                    "weekday_name": weekday_name,
                    "coverage_day_index": coverage_day_index
                }
                
                result["mappings"].append(mapping)
            except ValueError:
                logger.warning(f"Invalid date format: {date_str}")
                
        result["success"] = True
        return jsonify(result), HTTPStatus.OK
        
    except Exception as e:
        error_msg = f"Error testing day mapping: {str(e)}"
        logger.exception(error_msg)
        return jsonify({"error": error_msg, "success": False}), HTTPStatus.INTERNAL_SERVER_ERROR

# Route for generating schedules (adapted from original schedules.py)
@generation_bp.route("/generate", methods=["POST"])
def generate_schedule_endpoint():
    """Generate a new schedule for the given date range."""
    logs = []  # Initialize logs list
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing request body"}), HTTPStatus.BAD_REQUEST

        start_date, end_date = get_date_range(data)
        
        if end_date < start_date:
            error_msg = "End date must be after start date"
            logger.error_logger.error(error_msg)
            return jsonify({"error": error_msg}), HTTPStatus.BAD_REQUEST

        config_overrides = data.get("config", {})
        create_empty = data.get("create_empty_schedules", True)
        version = data.get("version", 1)  # Default to version 1 if not provided
        logs.append(f"Starting generation for version {version}")

        log = getattr(current_app, "logger", logger)
        resources = ScheduleResources()
        config = SchedulerConfig()
        params = data.get("params", {})
        generator = ScheduleGenerator(resources=resources, config=config, params=params)

        result = generator.generate(
            start_date=start_date,
            end_date=end_date,
            config=config_overrides,
            create_empty_schedules=create_empty,
            version=version,
        )

        # Combine initial logs with logs from generator
        backend_logs = result.get("logs", [])
        all_logs = logs + backend_logs
        result["logs"] = all_logs # Ensure logs are in the final result

        if result.get("success"):
            return jsonify(result), HTTPStatus.OK
        else:
            error_message = result.get("error", "Schedule generation failed")
            logger.error(f"Schedule generation failed: {error_message}")
            return (
                jsonify({"error": error_message, "logs": all_logs}), # Return combined logs on error
                HTTPStatus.INTERNAL_SERVER_ERROR
            )

    except (ValueError, KeyError) as e:
        error_msg = f"Invalid input: {str(e)}"
        logger.error_logger.error(error_msg)
        logs.append(error_msg)
        return jsonify({"error": error_msg, "logs": logs}), HTTPStatus.BAD_REQUEST
    except ScheduleResourceError as e:
        error_msg = f"Resource loading failed: {str(e)}"
        logger.error(f"Resource error during generation: {error_msg}")
        logs.append(error_msg)
        return (
            jsonify({"error": error_msg, "logs": logs}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        error_msg = f"An unexpected error occurred: {str(e)}"
        logger.exception("Unhandled error during schedule generation")
        logs.append(error_msg)
        return (
            jsonify({"error": error_msg, "logs": logs}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        ) 