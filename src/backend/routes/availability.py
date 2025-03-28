from flask import Blueprint, request, jsonify
from models import db, EmployeeAvailability, Employee
from models.employee import AvailabilityType
from datetime import datetime
from http import HTTPStatus
from services.event_service import emit_availability_updated

availability = Blueprint("availability", __name__, url_prefix="/availability")


@availability.route("/", methods=["GET"])
def get_availabilities():
    """Get all availabilities"""
    availabilities = EmployeeAvailability.query.all()
    return jsonify([availability.to_dict() for availability in availabilities])


@availability.route("/", methods=["POST"])
def create_availability():
    """Create a new availability"""
    data = request.get_json()

    try:
        availability = EmployeeAvailability(
            employee_id=data["employee_id"],
            day_of_week=data["day_of_week"],
            hour=data["hour"],
            is_available=data.get("is_available", True),
        )

        db.session.add(availability)
        db.session.commit()

        # Emit WebSocket event
        try:
            emit_availability_updated(
                {
                    "action": "create",
                    "availability_id": availability.id,
                    "employee_id": availability.employee_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            print(f"Error emitting availability_updated event: {str(e)}")

        return jsonify(availability.to_dict()), HTTPStatus.CREATED

    except KeyError as e:
        return jsonify(
            {"error": f"Missing required field: {str(e)}"}
        ), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/<int:availability_id>", methods=["GET"])
def get_availability(availability_id):
    """Get a specific availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    return jsonify(availability.to_dict())


@availability.route("/<int:availability_id>", methods=["PUT"])
def update_availability(availability_id):
    """Update an availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    data = request.get_json()

    try:
        if "employee_id" in data:
            availability.employee_id = data["employee_id"]
        if "day_of_week" in data:
            availability.day_of_week = data["day_of_week"]
        if "hour" in data:
            availability.hour = data["hour"]
        if "is_available" in data:
            availability.is_available = data["is_available"]

        db.session.commit()

        # Emit WebSocket event
        try:
            emit_availability_updated(
                {
                    "action": "update",
                    "availability_id": availability.id,
                    "employee_id": availability.employee_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            print(f"Error emitting availability_updated event: {str(e)}")

        return jsonify(availability.to_dict())

    except ValueError as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/<int:availability_id>", methods=["DELETE"])
def delete_availability(availability_id):
    """Delete an availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    employee_id = availability.employee_id  # Store before deletion

    try:
        db.session.delete(availability)
        db.session.commit()

        # Emit WebSocket event
        try:
            emit_availability_updated(
                {
                    "action": "delete",
                    "availability_id": availability_id,
                    "employee_id": employee_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            print(f"Error emitting availability_updated event: {str(e)}")

        return "", HTTPStatus.NO_CONTENT

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/check/", methods=["GET", "POST"])
def check_availability():
    """Check employee availability for a specific date and time range"""
    if request.method == "POST":
        data = request.get_json()
    else:
        data = {
            "employee_id": request.args.get("employee_id"),
            "date": request.args.get("date"),
            "start_time": request.args.get("start_time"),
            "end_time": request.args.get("end_time"),
        }

    try:
        employee_id = int(data["employee_id"])
        check_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
        start_time = data["start_time"]
        end_time = data["end_time"]

        # Get employee
        employee = Employee.query.get_or_404(employee_id)

        # Get all relevant availability records
        availabilities = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == employee_id,
            EmployeeAvailability.day_of_week == check_date.weekday(),
        ).all()

        # Convert times to hours for checking
        start_hour = int(start_time.split(":")[0])
        end_hour = int(end_time.split(":")[0])

        # Check each hour in the range
        for hour in range(start_hour, end_hour):
            hour_available = False
            for avail in availabilities:
                if avail.hour == hour:
                    if avail.is_available or (
                        avail.availability_type
                        and avail.availability_type != AvailabilityType.UNAVAILABLE
                    ):
                        hour_available = True
                        break
            if not hour_available:
                return jsonify(
                    {
                        "is_available": False,
                        "availability_type": AvailabilityType.UNAVAILABLE.value,
                        "reason": f"Not available at {hour}:00",
                    }
                )

        # If we get here, employee is available for all hours
        return jsonify(
            {
                "is_available": True,
                "availability_type": AvailabilityType.AVAILABLE.value,
                "reason": None,
            }
        )

    except (KeyError, ValueError) as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/employees/<int:employee_id>/availabilities", methods=["PUT"])
def update_employee_availabilities(employee_id):
    """Update multiple availabilities for an employee at once"""
    employee = Employee.query.get_or_404(employee_id)
    data = request.get_json()

    try:
        # Delete existing availabilities for this employee
        EmployeeAvailability.query.filter_by(employee_id=employee_id).delete()

        # Create new availabilities
        for item in data:
            availability = EmployeeAvailability(
                employee_id=employee_id,
                day_of_week=item["day_of_week"],
                hour=item["hour"],
                is_available=item.get("is_available", True),
            )
            db.session.add(availability)

        db.session.commit()

        # Emit WebSocket event
        try:
            emit_availability_updated(
                {
                    "action": "bulk_update",
                    "employee_id": employee_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        except Exception as e:
            print(f"Error emitting availability_updated event: {str(e)}")

        return jsonify({"message": "Availabilities updated successfully"})

    except (KeyError, ValueError) as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


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


@availability.route("/check/bulk", methods=["POST"])
def check_bulk_availability():
    """Check employee availability for multiple shifts at once"""
    data = request.get_json()

    try:
        employee_id = data["employee_id"]
        shifts = data["shifts"]

        # Get employee
        employee = Employee.query.get_or_404(employee_id)

        # Get all relevant availability records for all days
        weekdays = set(
            datetime.strptime(shift["date"], "%Y-%m-%d").weekday() for shift in shifts
        )
        availabilities = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == employee_id,
            EmployeeAvailability.day_of_week.in_(list(weekdays)),
        ).all()

        results = {}
        for shift in shifts:
            check_date = datetime.strptime(shift["date"], "%Y-%m-%d").date()
            start_hour = int(shift["start_time"].split(":")[0])
            end_hour = int(shift["end_time"].split(":")[0])
            shift_key = f"{shift['shift_id']}_{shift['date']}"

            # Check each hour in the range
            is_available = True
            reason = None
            for hour in range(start_hour, end_hour):
                hour_available = False
                for avail in availabilities:
                    if avail.day_of_week == check_date.weekday() and avail.hour == hour:
                        if avail.is_available or (
                            avail.availability_type
                            and avail.availability_type != AvailabilityType.UNAVAILABLE
                        ):
                            hour_available = True
                            break
                if not hour_available:
                    is_available = False
                    reason = f"Not available at {hour}:00"
                    break

            results[shift_key] = {
                "is_available": is_available,
                "availability_type": AvailabilityType.AVAILABLE.value
                if is_available
                else AvailabilityType.UNAVAILABLE.value,
                "reason": reason,
            }

        return jsonify(results)

    except (KeyError, ValueError) as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@availability.route("/bulk_check/", methods=["POST"])
def bulk_check_availability():
    """Check employee availability for multiple shifts - alternative endpoint for frontend compatibility"""
    return check_bulk_availability()


@availability.route("/batch", methods=["PUT"])
def update_batch_availabilities():
    """Update multiple employee availabilities at once"""
    data = request.get_json()

    try:
        updates = data.get("updates", [])
        updated_availabilities = []

        for update in updates:
            employee_id = update["employee_id"]
            availabilities = update["availabilities"]

            # Delete existing availabilities for this employee
            EmployeeAvailability.query.filter_by(employee_id=employee_id).delete()

            # Create new availabilities
            for availability_data in availabilities:
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
                updated_availabilities.append(availability)

        db.session.commit()
        return jsonify(
            {
                "message": f"Successfully updated {len(updated_availabilities)} availabilities",
                "availabilities": [avail.to_dict() for avail in updated_availabilities],
            }
        ), HTTPStatus.OK

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
