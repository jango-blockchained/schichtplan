import os
import logging
from flask import Blueprint, request, jsonify, current_app
from http import HTTPStatus
from datetime import datetime, timedelta

# Relative imports
from ..services.scheduler.generator import ScheduleGenerator
from ..services.scheduler.resources import ScheduleResources, ScheduleResourceError
from ..services.scheduler.config import SchedulerConfig
from ..services.scheduler.day_mapper import get_coverage_day_index

# Define blueprint
generation_bp = Blueprint(
    "schedule_generation", __name__, url_prefix="/api/schedules"
)

# Create a logger
logger = logging.getLogger(__name__)

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
    """Generate a new schedule."""
    logger.info("Schedule generation endpoint called")
    
    # Get date range from request
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing request body"}), 400
            
        start_date_str = data.get("start_date")
        end_date_str = data.get("end_date")
        
        if not start_date_str or not end_date_str:
            return jsonify({"error": "Missing start_date or end_date"}), 400
            
        logger.info(f"Date range: {start_date_str} to {end_date_str}")
        
        # Convert to date objects
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            logger.error(f"Invalid date format: {start_date_str}, {end_date_str}")
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400
            
        # Validate date range
        if start_date > end_date:
            logger.error(f"Start date {start_date} is after end date {end_date}")
            return jsonify({"error": "Start date must be before end date"}), 400
            
        # Create a mock schedule directly for demo purposes
        try:
            # Create a mock schedule
            mock_schedule = []
            
            # Create some shift templates
            shift_templates = [
                {"id": 1, "name": "Morning", "start_time": "08:00", "end_time": "16:00"},
                {"id": 2, "name": "Evening", "start_time": "16:00", "end_time": "00:00"},
                {"id": 3, "name": "Midday", "start_time": "12:00", "end_time": "20:00"}
            ]
            
            # Create some employees
            employees = [
                {"id": 1, "name": "Employee 1", "is_keyholder": True},
                {"id": 2, "name": "Employee 2", "is_keyholder": False},
                {"id": 3, "name": "Employee 3", "is_keyholder": False},
                {"id": 4, "name": "Employee 4", "is_keyholder": False},
                {"id": 5, "name": "Employee 5", "is_keyholder": True}
            ]
            
            # Get days between start and end date
            days = (end_date - start_date).days + 1
            
            # Create schedule entries
            for day in range(days):
                current_date = start_date + timedelta(days=day)
                
                # Skip weekends (Saturday and Sunday)
                if current_date.weekday() >= 5:
                    continue
                    
                # Assign each shift to different employees
                for shift in shift_templates:
                    # Assign to 2 random employees
                    for employee_index in range(2):
                        # Simple algorithm to vary assignments
                        employee_id = ((day + shift["id"] + employee_index) % 5) + 1
                        
                        # Create schedule entry
                        entry = {
                            "date": current_date.strftime("%Y-%m-%d"),
                            "employee_id": employee_id,
                            "employee_name": f"Employee {employee_id}",
                            "shift_id": shift["id"],
                            "shift_name": shift["name"],
                            "start_time": shift["start_time"],
                            "end_time": shift["end_time"],
                            "is_keyholder": employees[employee_id-1]["is_keyholder"]
                        }
                        
                        mock_schedule.append(entry)
            
            return jsonify({
                "message": "Schedule generated successfully (mock data)",
                "data": {
                    "schedules": mock_schedule,
                    "total_shifts": len(mock_schedule),
                    "stats": {
                        "duration_seconds": 0.05,
                        "employees_scheduled": 5,
                        "unique_shifts": 3
                    }
                }
            }), 200
            
        except Exception as e:
            logger.error(f"Error generating schedule: {str(e)}", exc_info=True)
            return jsonify({"error": "Failed to generate schedule, check logs for details"}), 500
            
    except Exception as e:
        logger.error(f"Unexpected error in schedule generation endpoint: {str(e)}", exc_info=True)
        return jsonify({"error": "An unexpected error occurred"}), 500 


    