from flask import Blueprint, jsonify, request
from ..models import db, Employee, EmployeeAvailability
from ..models.employee import AvailabilityType
from http import HTTPStatus

employees = Blueprint("employees", __name__, url_prefix="/api/employees")


@employees.route("/employees", methods=["GET"])
@employees.route("/employees/", methods=["GET"])
def get_employees():
    """Get all employees"""
    employees = Employee.query.all()
    return jsonify([employee.to_dict() for employee in employees])


@employees.route("/employees/<int:employee_id>", methods=["GET"])
@employees.route("/employees/<int:employee_id>/", methods=["GET"])
def get_employee(employee_id):
    """Get a specific employee"""
    employee = Employee.query.get_or_404(employee_id)
    return jsonify(employee.to_dict())


@employees.route("/employees", methods=["POST"])
@employees.route("/employees/", methods=["POST"])
def create_employee():
    """Create a new employee"""
    data = request.get_json()

    try:
        # Create employee without employee_id first
        employee = Employee(
            first_name=data["first_name"],
            last_name=data["last_name"],
            employee_group=data["employee_group"],
            contracted_hours=data.get("contracted_hours", 0),
            is_keyholder=data.get("is_keyholder", False),
        )

        # Optional fields
        if "email" in data:
            employee.email = data["email"]
        if "phone" in data:
            employee.phone = data["phone"]

        db.session.add(employee)
        db.session.commit()

        return jsonify(employee.to_dict()), HTTPStatus.CREATED

    except KeyError as e:
        return jsonify(
            {"error": f"Missing required field: {str(e)}"}
        ), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@employees.route("/employees/<int:employee_id>", methods=["PUT"])
@employees.route("/employees/<int:employee_id>/", methods=["PUT"])
def update_employee(employee_id):
    """Update an employee"""
    employee = Employee.query.get_or_404(employee_id)
    data = request.get_json()

    try:
        if "employee_id" in data:
            employee.employee_id = data["employee_id"]
        if "first_name" in data:
            employee.first_name = data["first_name"]
        if "last_name" in data:
            employee.last_name = data["last_name"]
        if "email" in data:
            employee.email = data["email"]
        if "phone" in data:
            employee.phone = data["phone"]
        if "contracted_hours" in data:
            employee.contracted_hours = data["contracted_hours"]
        if "is_active" in data:
            employee.is_active = data["is_active"]
        if "is_keyholder" in data:
            employee.is_keyholder = data["is_keyholder"]

        db.session.commit()
        return jsonify(employee.to_dict())

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@employees.route("/employees/<int:employee_id>", methods=["DELETE"])
@employees.route("/employees/<int:employee_id>/", methods=["DELETE"])
def delete_employee(employee_id):
    """Delete an employee"""
    employee = Employee.query.get_or_404(employee_id)

    try:
        db.session.delete(employee)
        db.session.commit()
        return jsonify({"message": "Employee deleted"}), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error deleting employee: {str(e)}"}), \
               HTTPStatus.INTERNAL_SERVER_ERROR


@employees.route("/employees/<int:employee_id>/availabilities", methods=["GET"])
def get_employee_availabilities(employee_id):
    """Get all availabilities for an employee"""
    availabilities = EmployeeAvailability.query.filter_by(employee_id=employee_id).all()
    return jsonify(
        [
            {
                "id": availability.id,
                "employee_id": availability.employee_id,
                "day_of_week": availability.day_of_week,
                "hour": availability.hour,
                "is_available": availability.is_available,
                "availability_type": availability.availability_type.value
                if availability.availability_type
                else "AVLAILABLE",
                "created_at": availability.created_at.isoformat()
                if availability.created_at
                else None,
                "updated_at": availability.updated_at.isoformat()
                if availability.updated_at
                else None,
            }
            for availability in availabilities
        ]
    )


@employees.route("/employees/<int:employee_id>/availabilities", methods=["PUT"])
def update_employee_availabilities(employee_id):
    """Update availabilities for an employee"""
    try:
        # Delete existing availabilities
        EmployeeAvailability.query.filter_by(employee_id=employee_id).delete()

        # Add new availabilities
        availabilities_data = request.json
        for data in availabilities_data:
            # Get availability type from data or default to AVL
            avail_type = data.get("availability_type", "AVL")
            availability = EmployeeAvailability(
                employee_id=employee_id,
                day_of_week=data["day_of_week"],
                hour=data["hour"],
                is_available=data.get("is_available", True),
                availability_type=AvailabilityType(avail_type),
            )
            db.session.add(availability)

        db.session.commit()
        return jsonify({"message": "Availabilities updated successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


@employees.route("/employees/<int:employee_id>/availability", methods=["GET"])
def get_employee_availability(employee_id):
    """Get all availabilities for an employee"""
    avails = EmployeeAvailability.query.filter_by(employee_id=employee_id).all()
    return jsonify([avail.to_dict() for avail in avails])


@employees.route("/employees/<int:employee_id>/availability", methods=["POST"])
def add_employee_availability(employee_id):
    """Add a new availability for an employee"""
    data = request.get_json()

    try:
        availability = EmployeeAvailability(
            employee_id=employee_id,
            day_of_week=data["day_of_week"],
            hour=data["hour"],
            is_available=data["is_available"],
            availability_type=AvailabilityType(data["availability_type"]),
        )
        db.session.add(availability)
        db.session.commit()
        return jsonify(availability.to_dict()), HTTPStatus.CREATED
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error adding availability: {str(e)}"}), \
               HTTPStatus.INTERNAL_SERVER_ERROR


@employees.route("/availability/<int:avail_id>", methods=["PUT"])
def update_employee_availability(avail_id):
    """Update an availability"""
    data = request.get_json()

    try:
        availability = EmployeeAvailability.query.get_or_404(avail_id)
        if "is_available" in data:
            availability.is_available = data["is_available"]
        if "availability_type" in data:
            availability.availability_type = AvailabilityType(data["availability_type"])
        db.session.commit()
        return jsonify(availability.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error updating availability: {str(e)}"}), \
               HTTPStatus.INTERNAL_SERVER_ERROR


@employees.route("/availability/<int:avail_id>", methods=["DELETE"])
def delete_employee_availability(avail_id):
    """Delete an availability"""
    availability = EmployeeAvailability.query.get_or_404(avail_id)

    try:
        db.session.delete(availability)
        db.session.commit()
        return "", HTTPStatus.NO_CONTENT
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error deleting availability: {str(e)}"}), \
               HTTPStatus.INTERNAL_SERVER_ERROR
