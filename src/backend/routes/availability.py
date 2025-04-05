from flask import Blueprint, request, jsonify
from ..models import EmployeeAvailability, Employee, AvailabilityType
from datetime import datetime
from http import HTTPStatus

availability = Blueprint("availability", __name__, url_prefix="/api/availability")


@availability.route("/", methods=["GET"])
def get_availability_records():
    """Get availability records, optionally filtered."""
    employee_id = request.args.get("employee_id", type=int)
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")

    query = EmployeeAvailability.query

    if employee_id:
        query = query.filter(EmployeeAvailability.employee_id == employee_id)

    # Note: Filtering by date might need adjustment if availability is 
    # stored by day_of_week/hour rather than specific dates.
    # This assumes a direct date column exists, which might not be the case.
    try:
        if start_date_str:
            # Assuming date column exists - adapt if needed
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            query = query.filter(EmployeeAvailability.date >= start_date)
        if end_date_str:
            # Assuming date column exists - adapt if needed
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            query = query.filter(EmployeeAvailability.date <= end_date)
            
        records = query.all()
        return jsonify([rec.to_dict() for rec in records])
    except ValueError:
        # Shortened line
        return (
            jsonify({"error": "Invalid date format (YYYY-MM-DD)"}), 
            HTTPStatus.BAD_REQUEST
        )
    except Exception as e:
        # logger.exception("Error fetching availability") # Add logging if needed
        # Shortened line
        return (
            jsonify({"error": f"Failed to fetch availability: {e}"}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        )


@availability.route("/", methods=["POST"])
def add_availability():
    """Add a new availability record."""
    from ..models import db
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), HTTPStatus.BAD_REQUEST

    try:
        # Validate required fields
        required = ["employee_id", "availability_type", "start_hour", "end_hour"]
        if not all(field in data for field in required):
            return jsonify({"error": "Missing required fields"}), HTTPStatus.BAD_REQUEST
            
        new_avail = EmployeeAvailability(
            employee_id=data["employee_id"],
            availability_type=AvailabilityType(data["availability_type"]),
            # Add other fields like start_hour, end_hour, day_of_week etc.
            start_hour=data.get("start_hour"), 
            end_hour=data.get("end_hour"),
            day_of_week=data.get("day_of_week"), # Optional
            date=data.get("date") # Optional, specific date override
        )
        db.session.add(new_avail)
        db.session.commit()
        return jsonify(new_avail.to_dict()), HTTPStatus.CREATED
    except ValueError as e: # Handle invalid enum etc.
        db.session.rollback()
        return jsonify({"error": f"Invalid value: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        # logger.exception("Error adding availability") # Add logging
        # Shortened line
        return (
            jsonify({"error": f"Error adding availability: {str(e)}"}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        )


@availability.route("/<int:avail_id>", methods=["PUT"])
def update_availability(avail_id):
    """Update an existing availability record."""
    from ..models import db
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), HTTPStatus.BAD_REQUEST

    avail = EmployeeAvailability.query.get(avail_id)
    if not avail:
        return jsonify({"error": "Availability record not found"}), HTTPStatus.NOT_FOUND

    try:
        # Update fields selectively
        if "availability_type" in data:
            avail.availability_type = AvailabilityType(data["availability_type"])
        if "start_hour" in data: avail.start_hour = data["start_hour"]
        if "end_hour" in data: avail.end_hour = data["end_hour"]
        if "day_of_week" in data: avail.day_of_week = data.get("day_of_week")
        if "date" in data: avail.date = data.get("date") # Handle date conversion if needed
        
        db.session.commit()
        return jsonify(avail.to_dict()), HTTPStatus.OK
    except ValueError as e: # Handle invalid enum etc.
        db.session.rollback()
        return jsonify({"error": f"Invalid value: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        # logger.exception(f"Error updating availability {avail_id}")
        # Shortened line
        return (
            jsonify({"error": f"Error updating availability: {str(e)}"}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        )


@availability.route("/<int:avail_id>", methods=["DELETE"])
def delete_availability(avail_id):
    """Delete an availability record."""
    from ..models import db
    avail = EmployeeAvailability.query.get(avail_id)
    if not avail:
        return jsonify({"error": "Availability record not found"}), HTTPStatus.NOT_FOUND
    
    try:
        db.session.delete(avail)
        db.session.commit()
        return "", HTTPStatus.NO_CONTENT
    except Exception as e:
        db.session.rollback()
        # logger.exception(f"Error deleting availability {avail_id}")
        # Shortened line
        return (
            jsonify({"error": f"Error deleting availability: {str(e)}"}), 
            HTTPStatus.INTERNAL_SERVER_ERROR
        )


@availability.route("/check", methods=["POST"])
def check_availability():
    """Check employee availability for a specific date and time range"""
    data = request.get_json()

    try:
        employee_id = data["employee_id"]
        check_date = datetime.strptime(data["date"], "%Y-%m-%d").date()

        # Get employee
        employee = Employee.query.get_or_404(employee_id)

        # Get all relevant availability records
        availabilities = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == employee_id,
            EmployeeAvailability.day_of_week == check_date.weekday(),
        ).all()

        # Check time range if provided
        hour = None
        if "hour" in data:
            hour = data["hour"]
            availabilities = [a for a in availabilities if a.hour == hour]

        # If no availability records exist for this time, employee is considered available
        if not availabilities:
            return jsonify({"is_available": True})

        # Check if any availability record indicates the employee is available
        is_available = any(a.is_available for a in availabilities)

        return jsonify(
            {
                "is_available": is_available,
                "reason": None
                if is_available
                else "Marked as unavailable for this time",
            }
        )

    except KeyError as e:
        return jsonify(
            {"error": f"Missing required field: {str(e)}"}
        ), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/employees/<int:employee_id>/availabilities", methods=["PUT"])
def update_employee_availabilities(employee_id):
    """Update employee availabilities"""
    from ..models import db
    data = request.get_json()

    try:
        # Delete existing availabilities
        EmployeeAvailability.query.filter_by(employee_id=employee_id).delete()

        # Create new availabilities
        for availability_data in data:
            availability = EmployeeAvailability(
                employee_id=employee_id,
                day_of_week=availability_data["day_of_week"],
                hour=availability_data["hour"],
                is_available=availability_data["is_available"],
                availability_type=AvailabilityType(
                    availability_data.get("availability_type", "AVL")
                ),
            )
            db.session.add(availability)

        db.session.commit()
        return jsonify(
            {"message": "Availabilities updated successfully"}
        ), HTTPStatus.OK

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST


@availability.route("/employees/<int:employee_id>/availabilities", methods=["GET"])
def get_employee_availabilities(employee_id):
    """Get employee availabilities"""
    availabilities = EmployeeAvailability.query.filter_by(employee_id=employee_id).all()
    return jsonify(
        [
            {
                "id": a.id,
                "employee_id": a.employee_id,
                "day_of_week": a.day_of_week,
                "hour": a.hour,
                "is_available": a.is_available,
                "availability_type": a.availability_type.value
                if a.availability_type
                else "AVL",
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
            for a in availabilities
        ]
    ), HTTPStatus.OK
