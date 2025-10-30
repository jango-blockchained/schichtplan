"""
Routes for vacation planning PDF generation.

Provides endpoints for generating various vacation-related PDF forms.
"""

from datetime import datetime
from http import HTTPStatus

from flask import Blueprint, jsonify, request, send_file

from src.backend.models import Absence, Employee, Settings, db
from src.backend.services.vacation_pdf_generator import VacationPDFGenerator
from src.backend.utils.logger import logger

bp = Blueprint("vacation_pdf", __name__)


@bp.route("/vacation-pdf/admin-yearly", methods=["GET"])
def get_admin_yearly_form():
    """
    Generate admin yearly vacation planning form.
    
    Query parameters:
        year (required): Year for vacation planning (e.g., 2024)
        
    Returns:
        PDF file for download
    """
    try:
        # Get year parameter
        year_str = request.args.get("year")
        if not year_str:
            return jsonify({
                "status": "error",
                "message": "year parameter is required"
            }), HTTPStatus.BAD_REQUEST
        
        try:
            year = int(year_str)
        except ValueError:
            return jsonify({
                "status": "error",
                "message": "year must be a valid integer"
            }), HTTPStatus.BAD_REQUEST
        
        # Validate year
        current_year = datetime.now().year
        if year < 2020 or year > current_year + 5:
            return jsonify({
                "status": "error",
                "message": f"year must be between 2020 and {current_year + 5}"
            }), HTTPStatus.BAD_REQUEST
        
        # Fetch employees
        employees = Employee.query.filter_by(is_active=True).all()
        
        # Fetch vacation absences for the year
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()
        
        absences = Absence.query.filter(
            Absence.absence_type_id == "vacation",
            Absence.start_date <= end_date,
            Absence.end_date >= start_date
        ).all()
        
        # Get settings
        settings = Settings.query.first()
        
        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_admin_yearly_form(
            year=year,
            employees=employees,
            absences=absences,
            settings=settings
        )
        
        logger.info(f"Generated admin yearly vacation form for year {year}")
        
        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"urlaubsplanung_admin_{year}.pdf"
        )
        
    except Exception as e:
        logger.error(f"Error generating admin yearly form: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Failed to generate PDF: {str(e)}"
        }), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/vacation-pdf/employee-request", methods=["GET"])
def get_employee_request_form():
    """
    Generate employee vacation request form.
    
    Query parameters:
        employee_id (required): Employee ID
        absence_id (optional): Absence ID to pre-fill form
        
    Returns:
        PDF file for download
    """
    try:
        # Get employee_id parameter
        employee_id_str = request.args.get("employee_id")
        if not employee_id_str:
            return jsonify({
                "status": "error",
                "message": "employee_id parameter is required"
            }), HTTPStatus.BAD_REQUEST
        
        try:
            employee_id = int(employee_id_str)
        except ValueError:
            return jsonify({
                "status": "error",
                "message": "employee_id must be a valid integer"
            }), HTTPStatus.BAD_REQUEST
        
        # Fetch employee
        employee = db.session.get(Employee, employee_id)
        if not employee:
            return jsonify({
                "status": "error",
                "message": f"Employee with ID {employee_id} not found"
            }), HTTPStatus.NOT_FOUND
        
        # Optionally fetch absence
        absence = None
        absence_id_str = request.args.get("absence_id")
        if absence_id_str:
            try:
                absence_id = int(absence_id_str)
                absence = Absence.query.filter_by(
                    id=absence_id,
                    employee_id=employee_id
                ).first()
                if not absence:
                    return jsonify({
                        "status": "error",
                        "message": f"Absence with ID {absence_id} not found for employee"
                    }), HTTPStatus.NOT_FOUND
            except ValueError:
                return jsonify({
                    "status": "error",
                    "message": "absence_id must be a valid integer"
                }), HTTPStatus.BAD_REQUEST
        
        # Get settings
        settings = Settings.query.first()
        
        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_employee_request_form(
            employee=employee,
            absence=absence,
            settings=settings
        )
        
        logger.info(
            f"Generated employee request form for employee {employee.employee_id}"
            + (f" with absence {absence_id_str}" if absence_id_str else "")
        )
        
        filename = f"urlaubsantrag_{employee.employee_id}"
        if absence:
            filename += f"_{absence.start_date.strftime('%Y%m%d')}"
        filename += ".pdf"
        
        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        logger.error(f"Error generating employee request form: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Failed to generate PDF: {str(e)}"
        }), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/vacation-pdf/overview", methods=["GET"])
def get_overview_form():
    """
    Generate comprehensive overview form with all employees.
    
    Query parameters:
        year (required): Year for vacation overview (e.g., 2024)
        
    Returns:
        PDF file for download
    """
    try:
        # Get year parameter
        year_str = request.args.get("year")
        if not year_str:
            return jsonify({
                "status": "error",
                "message": "year parameter is required"
            }), HTTPStatus.BAD_REQUEST
        
        try:
            year = int(year_str)
        except ValueError:
            return jsonify({
                "status": "error",
                "message": "year must be a valid integer"
            }), HTTPStatus.BAD_REQUEST
        
        # Validate year
        current_year = datetime.now().year
        if year < 2020 or year > current_year + 5:
            return jsonify({
                "status": "error",
                "message": f"year must be between 2020 and {current_year + 5}"
            }), HTTPStatus.BAD_REQUEST
        
        # Fetch employees
        employees = Employee.query.filter_by(is_active=True).all()
        
        # Fetch vacation absences for the year
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()
        
        absences = Absence.query.filter(
            Absence.absence_type_id == "vacation",
            Absence.start_date <= end_date,
            Absence.end_date >= start_date
        ).all()
        
        # Get settings
        settings = Settings.query.first()
        
        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_overview_form(
            employees=employees,
            absences=absences,
            year=year,
            settings=settings
        )
        
        logger.info(f"Generated overview form for year {year}")
        
        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"urlaubsuebersicht_{year}.pdf"
        )
        
    except Exception as e:
        logger.error(f"Error generating overview form: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Failed to generate PDF: {str(e)}"
        }), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/vacation-pdf/yearly-calendar", methods=["GET"])
def get_yearly_calendar():
    """
    Generate yearly calendar with 6 months per page.
    
    Query parameters:
        year (required): Year for calendar (e.g., 2024)
        
    Returns:
        PDF file for download
    """
    try:
        # Get year parameter
        year_str = request.args.get("year")
        if not year_str:
            return jsonify({
                "status": "error",
                "message": "year parameter is required"
            }), HTTPStatus.BAD_REQUEST
        
        try:
            year = int(year_str)
        except ValueError:
            return jsonify({
                "status": "error",
                "message": "year must be a valid integer"
            }), HTTPStatus.BAD_REQUEST
        
        # Validate year
        current_year = datetime.now().year
        if year < 2020 or year > current_year + 5:
            return jsonify({
                "status": "error",
                "message": f"year must be between 2020 and {current_year + 5}"
            }), HTTPStatus.BAD_REQUEST
        
        # Fetch employees
        employees = Employee.query.filter_by(is_active=True).all()
        
        # Fetch vacation absences for the year
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()
        
        absences = Absence.query.filter(
            Absence.absence_type_id == "vacation",
            Absence.start_date <= end_date,
            Absence.end_date >= start_date
        ).all()
        
        # Get settings
        settings = Settings.query.first()
        
        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_yearly_calendar(
            year=year,
            employees=employees,
            absences=absences,
            settings=settings
        )
        
        logger.info(f"Generated yearly calendar for year {year}")
        
        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"urlaubskalender_{year}.pdf"
        )
        
    except Exception as e:
        logger.error(f"Error generating yearly calendar: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Failed to generate PDF: {str(e)}"
        }), HTTPStatus.INTERNAL_SERVER_ERROR
