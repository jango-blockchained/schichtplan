from flask import Blueprint, jsonify, request
from src.backend.models import db, Employee, EmployeeAvailability
from src.backend.models.employee import AvailabilityType
from http import HTTPStatus
from pydantic import ValidationError
from src.backend.schemas.employees import EmployeeCreateRequest, EmployeeUpdateRequest

employees = Blueprint("employees", __name__)


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
    try:
        data = request.get_json()
        # Validate data using Pydantic schema
        request_data = EmployeeCreateRequest(**data)

        # Create employee using validated data
        employee = Employee(
            first_name=request_data.first_name,
            last_name=request_data.last_name,
            employee_group=request_data.employee_group,
            contracted_hours=request_data.contracted_hours,
            is_keyholder=bool(request_data.is_keyholder),
            email=request_data.email,
            phone=request_data.phone,
        )

        db.session.add(employee)
        db.session.commit()

        return jsonify(employee.to_dict()), HTTPStatus.CREATED

    except ValidationError as e:  # Catch Pydantic validation errors
        return jsonify(
            {"status": "error", "message": "Invalid input.", "details": e.errors()}
        ), HTTPStatus.BAD_REQUEST  # Return validation details
    except Exception as e:  # Catch any other exceptions
        db.session.rollback()
        return jsonify(
            {
                "status": "error",
                "message": "An internal server error occurred.",
                "details": str(e),
            }
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@employees.route("/employees/<int:employee_id>", methods=["PUT"])
@employees.route("/employees/<int:employee_id>/", methods=["PUT"])
def update_employee(employee_id):
    """Update an employee"""
    employee = Employee.query.get_or_404(employee_id)

    try:
        data = request.get_json()
        # Validate data using Pydantic schema
        request_data = EmployeeUpdateRequest(**data)

        # Update employee attributes from validated data if provided
        if request_data.first_name is not None:
            employee.first_name = request_data.first_name
        if request_data.last_name is not None:
            employee.last_name = request_data.last_name
        if request_data.employee_group is not None:
            employee.employee_group = request_data.employee_group
        if request_data.contracted_hours is not None:
            employee.contracted_hours = request_data.contracted_hours
        if request_data.is_active is not None:
            employee.is_active = request_data.is_active
        if request_data.is_keyholder is not None:
            employee.is_keyholder = request_data.is_keyholder
        if request_data.email is not None:
            employee.email = request_data.email
        if request_data.phone is not None:
            employee.phone = request_data.phone

        db.session.commit()
        return jsonify(employee.to_dict())

    except ValidationError as e:  # Catch Pydantic validation errors
        return jsonify(
            {"status": "error", "message": "Invalid input.", "details": e.errors()}
        ), HTTPStatus.BAD_REQUEST  # Return validation details
    except Exception as e:
        db.session.rollback()
        return jsonify(
            {
                "status": "error",
                "message": "An internal server error occurred.",
                "details": str(e),
            }
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@employees.route("/employees/<int:employee_id>", methods=["DELETE"])
@employees.route("/employees/<int:employee_id>/", methods=["DELETE"])
def delete_employee(employee_id):
    """Delete an employee"""
    employee = Employee.query.get_or_404(employee_id)

    try:
        db.session.delete(employee)
        db.session.commit()
        return "", HTTPStatus.NO_CONTENT

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


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
@employees.route("/employees/<int:employee_id>/availability", methods=["PUT"])
@employees.route("/api/employees/<int:employee_id>/availability", methods=["PUT"])
def update_employee_availabilities(employee_id):
    """Update availabilities for an employee"""
    try:
        # Delete existing availabilities
        EmployeeAvailability.query.filter_by(employee_id=employee_id).delete()

        # Add new availabilities
        availabilities_data = request.json
        for data in availabilities_data:
            # Get availability type from data or default to AVAILABLE
            avail_type = data.get("availability_type", "AVAILABLE")
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
@employees.route("/api/employees/<int:employee_id>/availability", methods=["GET"])
def get_employee_availability(employee_id):
    """Alias for get_employee_availabilities - handles the singular form for frontend compatibility"""
    return get_employee_availabilities(employee_id)
