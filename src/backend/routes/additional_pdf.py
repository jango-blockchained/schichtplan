"""
Routes for additional PDF form generation.

Provides endpoints for generating time-off, registration, shift reports,
and expense forms.
"""

from http import HTTPStatus

from flask import Blueprint, jsonify, request, send_file

from src.backend.models import Employee, Settings
from src.backend.services.vacation_pdf_generator import VacationPDFGenerator
from src.backend.utils.logger import logger

bp = Blueprint("additional_pdf", __name__)


@bp.route("/absence-pdf/employee-request", methods=["GET"])
def get_absence_request_form():
    """
    Generate employee absence/time-off request form.

    Query parameters:
        employee_id (required): Employee ID

    Returns:
        PDF file for download
    """
    try:
        # Get employee_id parameter
        employee_id_str = request.args.get("employee_id")
        if not employee_id_str:
            return jsonify(
                {"status": "error", "message": "employee_id parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            employee_id = int(employee_id_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "employee_id must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Fetch employee
        employee = Employee.query.get(employee_id)
        if not employee:
            logger.warning(f"Employee with ID {employee_id} not found")
            return jsonify(
                {
                    "status": "error",
                    "message": f"Employee with ID {employee_id} not found",
                }
            ), HTTPStatus.NOT_FOUND

        logger.info(
            f"Loaded employee {employee.employee_id}: "
            f"{employee.first_name} {employee.last_name}"
        )

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_absence_request_form(
            employee=employee, settings=settings
        )

        logger.info(
            f"Generated absence request form for employee {employee.employee_id}"
        )

        filename = f"abwesenheitsantrag_{employee.employee_id}.pdf"

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except Exception as e:
        logger.error(f"Error generating absence request form: {str(e)}", exc_info=True)
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/registration-pdf/employee-form", methods=["GET"])
def get_employee_registration_form():
    """
    Generate employee registration form.

    Returns:
        PDF file for download
    """
    try:
        logger.info("Generating employee registration form")

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_employee_registration_form(settings=settings)

        logger.info("Successfully generated employee registration form")

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name="mitarbeiter_registrierung.pdf",
        )

    except Exception as e:
        logger.error(f"Error generating registration form: {str(e)}", exc_info=True)
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/shift-pdf/report", methods=["GET"])
def get_shift_report_form():
    """
    Generate shift report form.

    Query parameters:
        employee_id (required): Employee ID

    Returns:
        PDF file for download
    """
    try:
        # Get employee_id parameter
        employee_id_str = request.args.get("employee_id")
        if not employee_id_str:
            return jsonify(
                {"status": "error", "message": "employee_id parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            employee_id = int(employee_id_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "employee_id must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Fetch employee
        employee = Employee.query.get(employee_id)
        if not employee:
            logger.warning(f"Employee with ID {employee_id} not found")
            return jsonify(
                {
                    "status": "error",
                    "message": f"Employee with ID {employee_id} not found",
                }
            ), HTTPStatus.NOT_FOUND

        logger.info(
            f"Loaded employee {employee.employee_id}: "
            f"{employee.first_name} {employee.last_name}"
        )

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_shift_report_form(
            employee=employee, settings=settings
        )

        logger.info(f"Generated shift report form for employee {employee.employee_id}")

        filename = f"schichtbericht_{employee.employee_id}.pdf"

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except Exception as e:
        logger.error(f"Error generating shift report form: {str(e)}", exc_info=True)
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/shift-pdf/transfer", methods=["GET"])
def get_shift_transfer_form():
    """
    Generate shift transfer request form.

    Query parameters:
        employee_id (required): Employee ID

    Returns:
        PDF file for download
    """
    try:
        # Get employee_id parameter
        employee_id_str = request.args.get("employee_id")
        if not employee_id_str:
            return jsonify(
                {"status": "error", "message": "employee_id parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            employee_id = int(employee_id_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "employee_id must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Fetch employee
        employee = Employee.query.get(employee_id)
        if not employee:
            logger.warning(f"Employee with ID {employee_id} not found")
            return jsonify(
                {
                    "status": "error",
                    "message": f"Employee with ID {employee_id} not found",
                }
            ), HTTPStatus.NOT_FOUND

        logger.info(
            f"Loaded employee {employee.employee_id}: "
            f"{employee.first_name} {employee.last_name}"
        )

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_shift_transfer_form(
            employee=employee, settings=settings
        )

        logger.info(
            f"Generated shift transfer form for employee {employee.employee_id}"
        )

        filename = f"schicht_uebertragung_{employee.employee_id}.pdf"

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except Exception as e:
        logger.error(f"Error generating shift transfer form: {str(e)}", exc_info=True)
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/expense-pdf/report", methods=["GET"])
def get_expense_report_form():
    """
    Generate expense report form.

    Query parameters:
        employee_id (required): Employee ID

    Returns:
        PDF file for download
    """
    try:
        # Get employee_id parameter
        employee_id_str = request.args.get("employee_id")
        if not employee_id_str:
            return jsonify(
                {"status": "error", "message": "employee_id parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            employee_id = int(employee_id_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "employee_id must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Fetch employee
        employee = Employee.query.get(employee_id)
        if not employee:
            logger.warning(f"Employee with ID {employee_id} not found")
            return jsonify(
                {
                    "status": "error",
                    "message": f"Employee with ID {employee_id} not found",
                }
            ), HTTPStatus.NOT_FOUND

        logger.info(
            f"Loaded employee {employee.employee_id}: "
            f"{employee.first_name} {employee.last_name}"
        )

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_expense_report_form(
            employee=employee, settings=settings
        )

        logger.info(
            f"Generated expense report form for employee {employee.employee_id}"
        )

        filename = f"spesenabrechnung_{employee.employee_id}.pdf"

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except Exception as e:
        logger.error(f"Error generating expense report form: {str(e)}", exc_info=True)
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
