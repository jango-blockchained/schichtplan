"""CSV Import API endpoints for the Schichtplan application."""

import csv
import io
import traceback
from datetime import datetime
from typing import Any

from flask import Blueprint, current_app, jsonify, request

from ..models import db
from ..models.employee import AvailabilityType, Employee, EmployeeAvailability

csv_import_bp = Blueprint("csv_import", __name__, url_prefix="/api/csv-import")


@csv_import_bp.route("/data-types", methods=["GET"])
def get_data_types():
    """Get available data types for CSV import."""
    return jsonify(
        {
            "data_types": [
                {
                    "id": "employees",
                    "name": "Employees",
                    "description": "Import employee data",
                },
                {
                    "id": "availability",
                    "name": "Availability",
                    "description": "Import employee availability",
                },
                {
                    "id": "schedules",
                    "name": "Schedules",
                    "description": "Import scheduled shifts",
                },
            ]
        }
    )


@csv_import_bp.route("/preview", methods=["POST"])
def preview_csv():
    """Preview CSV file before import."""
    try:
        current_app.logger.info(
            f"CSV Preview request - Content-Type: {request.content_type}"
        )
        current_app.logger.info(f"CSV Preview request - is_json: {request.is_json}")
        current_app.logger.info(
            f"CSV Preview request - form data: {dict(request.form)}"
        )
        if request.is_json:
            current_app.logger.info(f"CSV Preview request - json data: {request.json}")

        # Get data type
        data_type = request.form.get("data_type")
        if not data_type and request.is_json and request.json:
            data_type = request.json.get("data_type")

        current_app.logger.info(f"CSV Preview - data_type: {data_type}")

        if not data_type:
            return jsonify({"error": "No data type specified"}), 400

        # Get CSV content - either from file or text input
        file_content = None

        # Check if it's a file upload
        if "file" in request.files:
            file = request.files["file"]
            if file and file.filename:
                file_content = file.read().decode("utf-8")
                file.seek(0)  # Reset file pointer
                current_app.logger.info(
                    f"CSV Preview - using file upload, content length: {len(file_content)}"
                )

        # Check if it's text input
        if not file_content:
            csv_text = None
            if request.is_json and request.json:
                csv_text = request.json.get("csv_text")
            else:
                csv_text = request.form.get("csv_text")

            current_app.logger.info(
                f"CSV Preview - csv_text found: {csv_text is not None}"
            )
            if csv_text:
                file_content = csv_text
                current_app.logger.info(
                    f"CSV Preview - using text input, content length: {len(file_content)}"
                )
            else:
                current_app.logger.error("CSV Preview - No file or CSV text provided")
                return jsonify({"error": "No file or CSV text provided"}), 400

        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(file_content))
        headers = csv_reader.fieldnames or []
        current_app.logger.info(f"CSV Preview - headers: {headers}")

        # Get sample rows (first 5) and count total rows
        sample_rows = []
        total_rows = 0
        for i, row in enumerate(csv_reader):
            total_rows += 1
            if i < 5:  # Only keep first 5 as samples
                sample_rows.append(row)

        current_app.logger.info(
            f"CSV Preview - total_rows: {total_rows}, sample_rows: {len(sample_rows)}"
        )

        # Validate structure based on data type
        validation_result = _validate_csv_structure(list(headers), data_type)
        current_app.logger.info(f"CSV Preview - validation_result: {validation_result}")

        result = {
            "headers": headers,
            "sample_rows": sample_rows,
            "row_count": total_rows,
            "validation": validation_result,
        }
        current_app.logger.info(
            f"CSV Preview - returning result with {len(sample_rows)} sample rows and {total_rows} total rows"
        )
        return jsonify(result)

    except Exception as e:
        current_app.logger.error(f"CSV preview error: {str(e)}")
        current_app.logger.error(
            f"CSV preview error traceback: {traceback.format_exc()}"
        )
        return jsonify({"error": f"Failed to preview CSV: {str(e)}"}), 500


@csv_import_bp.route("/import", methods=["POST"])
def import_csv():
    """Import CSV data."""
    try:
        # Get data type
        data_type = request.form.get("data_type")
        if not data_type and request.is_json and request.json:
            data_type = request.json.get("data_type")

        if not data_type:
            return jsonify({"error": "No data type specified"}), 400

        # Get CSV content - either from file or text input
        file_content = None

        # Check if it's a file upload
        if "file" in request.files:
            file = request.files["file"]
            if file and file.filename:
                file_content = file.read().decode("utf-8")

        # Check if it's text input
        if not file_content:
            csv_text = None
            if request.is_json and request.json:
                csv_text = request.json.get("csv_text")
            else:
                csv_text = request.form.get("csv_text")

            if csv_text:
                file_content = csv_text
            else:
                return jsonify({"error": "No file or CSV text provided"}), 400

        # Parse CSV
        csv_reader = csv.DictReader(io.StringIO(file_content))

        # Import based on data type
        if data_type == "employees":
            result = _import_employees(csv_reader)
        elif data_type == "availability":
            result = _import_availability(csv_reader)
        elif data_type == "schedules":
            result = _import_schedules(csv_reader)
        else:
            return jsonify({"error": f"Unknown data type: {data_type}"}), 400

        return jsonify(result)

    except Exception as e:
        current_app.logger.error(f"CSV import error: {str(e)}")
        return jsonify({"error": f"Failed to import CSV: {str(e)}"}), 500


def _validate_csv_structure(headers: list[str], data_type: str) -> dict[str, Any]:
    """Validate CSV structure based on data type."""
    validation = {"valid": True, "errors": [], "warnings": []}

    if data_type == "employees":
        required_fields = [
            "first_name",
            "last_name",
            "employee_group",
            "contracted_hours",
        ]
        optional_fields = [
            "employee_id",
            "email",
            "phone",
            "is_keyholder",
            "is_active",
            "birthday",
        ]
    elif data_type == "availability":
        required_fields = ["employee_id", "day_of_week", "hour"]
        optional_fields = [
            "is_available",
            "availability_type",
            "start_date",
            "end_date",
        ]
    elif data_type == "schedules":
        required_fields = [
            "employee_id",
            "date",
            "shift_type",
            "start_time",
            "end_time",
        ]
        optional_fields = ["break_duration", "notes"]
    else:
        validation["errors"].append(f"Unknown data type: {data_type}")
        validation["valid"] = False
        return validation

    # Check for required fields
    missing_required = [field for field in required_fields if field not in headers]
    if missing_required:
        validation["errors"].extend(
            [f"Missing required field: {field}" for field in missing_required]
        )
        validation["valid"] = False

    # Check for unknown fields
    known_fields = set(required_fields + optional_fields)
    unknown_fields = [field for field in headers if field not in known_fields]
    if unknown_fields:
        validation["warnings"].extend(
            [f"Unknown field will be ignored: {field}" for field in unknown_fields]
        )

    return validation


def _import_employees(csv_reader) -> dict[str, Any]:
    """Import employee data from CSV."""
    imported_count = 0
    errors = []

    try:
        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 for header row
            try:
                # Required fields
                first_name = row.get("first_name", "").strip()
                last_name = row.get("last_name", "").strip()
                employee_group = row.get("employee_group", "").strip()
                contracted_hours_str = row.get("contracted_hours", "").strip()

                if not all(
                    [first_name, last_name, employee_group, contracted_hours_str]
                ):
                    errors.append(
                        f"Row {row_num}: first_name, last_name, employee_group, and contracted_hours are required"
                    )
                    continue

                # Validate contracted hours
                try:
                    contracted_hours = float(contracted_hours_str)
                except ValueError:
                    errors.append(f"Row {row_num}: contracted_hours must be a number")
                    continue

                # Check if employee already exists by email or employee_id
                email = row.get("email", "").strip()
                employee_id = row.get("employee_id", "").strip()

                existing_employee = None
                if email:
                    existing_employee = Employee.query.filter_by(email=email).first()
                if not existing_employee and employee_id:
                    existing_employee = Employee.query.filter_by(
                        employee_id=employee_id
                    ).first()

                if existing_employee:
                    errors.append(f"Row {row_num}: Employee already exists")
                    continue

                # Optional fields
                phone = row.get("phone", "").strip() or None
                is_keyholder = row.get("is_keyholder", "").strip().lower() in [
                    "true",
                    "1",
                    "yes",
                    "y",
                ]
                is_active = row.get("is_active", "true").strip().lower() in [
                    "true",
                    "1",
                    "yes",
                    "y",
                ]
                birthday_str = row.get("birthday", "").strip()
                birthday = None
                if birthday_str:
                    try:
                        birthday = datetime.strptime(birthday_str, "%Y-%m-%d").date()
                    except ValueError:
                        errors.append(
                            f"Row {row_num}: Invalid birthday format. Use YYYY-MM-DD"
                        )
                        continue

                # Create employee
                employee = Employee(
                    first_name=first_name,
                    last_name=last_name,
                    employee_group=employee_group,
                    contracted_hours=contracted_hours,
                    employee_id=employee_id if employee_id else None,
                    email=email if email else None,
                    phone=phone,
                    is_keyholder=is_keyholder,
                    is_active=is_active,
                    birthday=birthday,
                )

                db.session.add(employee)
                imported_count += 1

            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")

        if imported_count > 0:
            db.session.commit()

        return {"success": True, "imported_count": imported_count, "errors": errors}

    except Exception as e:
        db.session.rollback()
        return {
            "success": False,
            "error": str(e),
            "imported_count": 0,
            "errors": errors,
        }


def _import_availability(csv_reader) -> dict[str, Any]:
    """Import availability data from CSV."""
    imported_count = 0
    errors = []

    try:
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                # Required fields
                employee_id = row.get("employee_id", "").strip()
                day_of_week = row.get("day_of_week", "").strip()
                hour_str = row.get("hour", "").strip()

                if not all([employee_id, day_of_week, hour_str]):
                    errors.append(
                        f"Row {row_num}: employee_id, day_of_week, and hour are required"
                    )
                    continue

                # Find employee
                employee = Employee.query.filter_by(employee_id=employee_id).first()
                if not employee:
                    employee = Employee.query.filter_by(email=employee_id).first()

                if not employee:
                    errors.append(f"Row {row_num}: Employee not found: {employee_id}")
                    continue

                # Validate day of week
                day_of_week_num = None
                if day_of_week.isdigit():
                    day_of_week_num = int(day_of_week)
                    if day_of_week_num < 0 or day_of_week_num > 6:
                        errors.append(
                            f"Row {row_num}: day_of_week must be 0-6 (0=Monday, 6=Sunday)"
                        )
                        continue
                else:
                    day_names = [
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                        "sunday",
                    ]
                    day_lower = day_of_week.lower()
                    if day_lower in day_names:
                        day_of_week_num = day_names.index(day_lower)
                    else:
                        errors.append(
                            f"Row {row_num}: Invalid day_of_week: {day_of_week}"
                        )
                        continue

                # Validate hour
                try:
                    hour = int(hour_str)
                    if hour < 0 or hour > 23:
                        errors.append(f"Row {row_num}: hour must be 0-23")
                        continue
                except ValueError:
                    errors.append(f"Row {row_num}: hour must be a number")
                    continue

                # Optional fields
                is_available = row.get("is_available", "true").strip().lower() in [
                    "true",
                    "1",
                    "yes",
                    "y",
                ]
                availability_type_str = (
                    row.get("availability_type", "available").strip().lower()
                )
                availability_type = AvailabilityType.AVAILABLE

                if availability_type_str in ["unavailable", "not_available"]:
                    availability_type = AvailabilityType.UNAVAILABLE
                elif availability_type_str in ["preferred", "prefer"]:
                    availability_type = AvailabilityType.PREFERRED
                elif availability_type_str in ["fixed"]:
                    availability_type = AvailabilityType.FIXED

                # Parse optional dates
                start_date = None
                end_date = None
                start_date_str = row.get("start_date", "").strip()
                end_date_str = row.get("end_date", "").strip()

                if start_date_str:
                    try:
                        start_date = datetime.strptime(
                            start_date_str, "%Y-%m-%d"
                        ).date()
                    except ValueError:
                        errors.append(
                            f"Row {row_num}: Invalid start_date format. Use YYYY-MM-DD"
                        )
                        continue

                if end_date_str:
                    try:
                        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                    except ValueError:
                        errors.append(
                            f"Row {row_num}: Invalid end_date format. Use YYYY-MM-DD"
                        )
                        continue

                # Create availability
                availability = EmployeeAvailability(
                    employee_id=employee.id,
                    day_of_week=day_of_week_num,
                    hour=hour,
                    is_available=is_available,
                    start_date=start_date,
                    end_date=end_date,
                    availability_type=availability_type,
                )

                db.session.add(availability)
                imported_count += 1

            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")

        if imported_count > 0:
            db.session.commit()

        return {"success": True, "imported_count": imported_count, "errors": errors}

    except Exception as e:
        db.session.rollback()
        return {
            "success": False,
            "error": str(e),
            "imported_count": 0,
            "errors": errors,
        }


def _import_schedules(csv_reader) -> dict[str, Any]:
    """Import schedule data from CSV."""
    # This is a placeholder implementation
    # In a real application, you would implement the logic to import scheduled shifts
    return {
        "success": False,
        "error": "Schedule import is not yet implemented",
        "imported_count": 0,
        "errors": ["Schedule import functionality is not yet implemented"],
    }
