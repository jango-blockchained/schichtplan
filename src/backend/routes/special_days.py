from flask import Blueprint, jsonify, request
from http import HTTPStatus
import logging
from datetime import datetime
from models import db, Settings
from pydantic import ValidationError
from schemas.settings import SpecialDay

special_days = Blueprint("special_days", __name__)

@special_days.route("/settings/special-days", methods=["GET"])
@special_days.route("/settings/special-days/", methods=["GET"])
def get_special_days():
    """
    Retrieve all special days from settings
    
    Returns:
        JSON response with special days data
    """
    try:
        settings = db.session.query(Settings).first()
        if not settings:
            return jsonify({"special_days": {}}), HTTPStatus.OK
            
        # Handle both special_days and legacy special_hours
        if hasattr(settings, "special_days") and settings.special_days:
            return jsonify({"special_days": settings.special_days}), HTTPStatus.OK
        else:
            # Convert from legacy format if needed
            special_days = {}
            if hasattr(settings, "special_hours") and settings.special_hours:
                for date_str, details in settings.special_hours.items():
                    special_days[date_str] = {
                        "description": f"Special Day ({date_str})",
                        "is_closed": details.get("is_closed", False),
                        "custom_hours": {
                            "opening": details.get("opening", settings.store_opening),
                            "closing": details.get("closing", settings.store_closing)
                        } if not details.get("is_closed", False) else None
                    }
            return jsonify({"special_days": special_days}), HTTPStatus.OK
            
    except Exception as e:
        logging.error(f"Error retrieving special days: {str(e)}")
        return jsonify({
            "error": "Failed to retrieve special days", 
            "message": str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR

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
    try:
        if not request.is_json:
            return jsonify({
                "error": "Request must be JSON",
                "message": "Content-Type must be application/json"
            }), HTTPStatus.BAD_REQUEST
            
        data = request.get_json()
        
        # Validate date format
        date_str = data.get("date")
        if not date_str:
            return jsonify({
                "error": "Missing required field",
                "message": "Date is required"
            }), HTTPStatus.BAD_REQUEST
            
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return jsonify({
                "error": "Invalid date format",
                "message": "Date must be in YYYY-MM-DD format"
            }), HTTPStatus.BAD_REQUEST
            
        # Validate data using Pydantic model
        try:
            special_day = SpecialDay(
                description=data.get("description", ""),
                is_closed=data.get("is_closed", False),
                custom_hours=data.get("custom_hours") if not data.get("is_closed", False) else None
            )
        except ValidationError as e:
            return jsonify({
                "error": "Invalid data format",
                "message": str(e)
            }), HTTPStatus.BAD_REQUEST
            
        # Get settings and update special_days
        settings = db.session.query(Settings).first()
        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)
            
        # Initialize special_days if needed
        if not hasattr(settings, "special_days") or settings.special_days is None:
            settings.special_days = {}
            
        # Add or update the special day
        settings.special_days[date_str] = special_day.dict(exclude_none=True)
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            "message": f"Special day {date_str} added/updated successfully"
        }), HTTPStatus.OK
        
    except Exception as e:
        logging.error(f"Error adding/updating special day: {str(e)}")
        db.session.rollback()
        return jsonify({
            "error": "Server error adding/updating special day",
            "message": str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR

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
    try:
        # Validate date format
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            return jsonify({
                "error": "Invalid date format",
                "message": "Date must be in YYYY-MM-DD format"
            }), HTTPStatus.BAD_REQUEST
            
        # Get settings
        settings = db.session.query(Settings).first()
        if not settings or not hasattr(settings, "special_days") or not settings.special_days:
            return jsonify({
                "error": "Not found",
                "message": f"No special day found for date {date}"
            }), HTTPStatus.NOT_FOUND
            
        # Check if the special day exists
        if date not in settings.special_days:
            return jsonify({
                "error": "Not found",
                "message": f"No special day found for date {date}"
            }), HTTPStatus.NOT_FOUND
            
        # Remove the special day
        del settings.special_days[date]
        
        # Save changes
        db.session.commit()
        
        return jsonify({
            "message": f"Special day {date} deleted successfully"
        }), HTTPStatus.OK
        
    except Exception as e:
        logging.error(f"Error deleting special day: {str(e)}")
        db.session.rollback()
        return jsonify({
            "error": "Server error deleting special day",
            "message": str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR