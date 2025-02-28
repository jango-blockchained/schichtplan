from flask import Blueprint, request, jsonify
from http import HTTPStatus
from models import db, Employee
from models.employee import EmployeeGroup
from datetime import datetime

bp = Blueprint("employees", __name__, url_prefix="/api/employees")


@bp.route("/", methods=["GET"])
def get_employees():
    """Get all employees"""
    # Add optional filter for active/inactive employees
    is_active = request.args.get("is_active")
    if is_active is not None:
        is_active = is_active.lower() == "true"
        employees = Employee.query.filter_by(is_active=is_active).all()
    else:
        employees = Employee.query.all()
    return jsonify([employee.to_dict() for employee in employees]), HTTPStatus.OK


@bp.route("/<int:employee_id>", methods=["GET"])
def get_employee(employee_id):
    """Get employee by ID"""
    employee = Employee.query.get_or_404(employee_id)
    return jsonify(employee.to_dict()), HTTPStatus.OK


@bp.route("/", methods=["POST"])
def create_employee():
    """Create new employee"""
    data = request.get_json()

    try:
        # Parse birthday if provided
        birthday = None
        if "birthday" in data:
            try:
                birthday = datetime.strptime(data["birthday"], "%Y-%m-%d").date()
            except ValueError:
                return jsonify(
                    {"error": "Invalid birthday format. Use YYYY-MM-DD"}
                ), HTTPStatus.BAD_REQUEST

        employee = Employee(
            employee_id=data["employee_id"],
            first_name=data["first_name"],
            last_name=data["last_name"],
            employee_group=EmployeeGroup(data["employee_group"]),
            contracted_hours=float(data["contracted_hours"]),
            is_keyholder=bool(data.get("is_keyholder", False)),
            is_active=bool(data.get("is_active", True)),
            birthday=birthday,
            email=data.get("email"),
            phone=data.get("phone"),
        )

        db.session.add(employee)
        db.session.commit()

        return jsonify(employee.to_dict()), HTTPStatus.CREATED

    except (KeyError, ValueError) as e:
        return jsonify(
            {"error": "Invalid data provided", "details": str(e)}
        ), HTTPStatus.BAD_REQUEST


@bp.route("/<int:employee_id>/activate", methods=["POST"])
def activate_employee(employee_id):
    """Activate an employee"""
    employee = Employee.query.get_or_404(employee_id)
    employee.activate()
    db.session.commit()
    return jsonify(employee.to_dict()), HTTPStatus.OK


@bp.route("/<int:employee_id>/deactivate", methods=["POST"])
def deactivate_employee(employee_id):
    """Deactivate an employee"""
    employee = Employee.query.get_or_404(employee_id)
    employee.deactivate()
    db.session.commit()
    return jsonify(employee.to_dict()), HTTPStatus.OK


@bp.route("/<int:employee_id>", methods=["PUT"])
def update_employee(employee_id):
    """Update an employee"""
    employee = Employee.query.get_or_404(employee_id)
    data = request.get_json()

    try:
        if "first_name" in data:
            employee.first_name = data["first_name"]
        if "last_name" in data:
            employee.last_name = data["last_name"]
        if "employee_group" in data:
            employee.employee_group = EmployeeGroup(data["employee_group"])
        if "contracted_hours" in data:
            employee.contracted_hours = float(data["contracted_hours"])
        if "is_keyholder" in data:
            employee.is_keyholder = bool(data["is_keyholder"])
        if "is_active" in data:
            employee.is_active = bool(data["is_active"])
        if "birthday" in data:
            try:
                employee.birthday = (
                    datetime.strptime(data["birthday"], "%Y-%m-%d").date()
                    if data["birthday"]
                    else None
                )
            except ValueError:
                return jsonify(
                    {"error": "Invalid birthday format. Use YYYY-MM-DD"}
                ), HTTPStatus.BAD_REQUEST
        if "email" in data:
            employee.email = data["email"]
        if "phone" in data:
            employee.phone = data["phone"]

        if not employee.validate_hours():
            return jsonify(
                {"error": "Invalid contracted hours for employee group"}
            ), HTTPStatus.BAD_REQUEST

        db.session.commit()
        return jsonify(employee.to_dict()), HTTPStatus.OK

    except ValueError as e:
        return jsonify(
            {"error": "Invalid data provided", "details": str(e)}
        ), HTTPStatus.BAD_REQUEST


@bp.route("/<int:employee_id>", methods=["DELETE"])
def delete_employee(employee_id):
    """Delete employee"""
    employee = Employee.query.get_or_404(employee_id)

    try:
        db.session.delete(employee)
        db.session.commit()

        return jsonify({"message": "Employee deleted successfully"}), HTTPStatus.OK

    except Exception as e:
        return jsonify(
            {"error": "Failed to delete employee", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
