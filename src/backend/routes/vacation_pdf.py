"""
Routes for vacation planning PDF generation.

Provides endpoints for generating various vacation-related PDF forms.
"""

from datetime import datetime
from http import HTTPStatus

from flask import Blueprint, jsonify, request, send_file

from src.backend.models import Absence, Employee, Settings, db
from src.backend.services.vacation_grid_pdf_generator import (
    VacationGridPDFGenerator,
)
from src.backend.services.vacation_pdf_generator import VacationPDFGenerator
from src.backend.utils.logger import logger

bp = Blueprint("vacation_pdf", __name__)

# Constants
MIN_YEAR = 2020
MAX_YEAR_OFFSET = 5


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
            return jsonify(
                {"status": "error", "message": "year parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            year = int(year_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "year must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Validate year
        current_year = datetime.now().year
        max_year = current_year + MAX_YEAR_OFFSET
        if year < MIN_YEAR or year > max_year:
            return jsonify(
                {
                    "status": "error",
                    "message": f"year must be between {MIN_YEAR} and {max_year}",
                }
            ), HTTPStatus.BAD_REQUEST

        # Fetch employees
        employees = Employee.query.filter_by(is_active=True).all()
        logger.info(f"Loaded {len(employees)} active employees for admin yearly form")

        # Fetch vacation absences for the year
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()

        absences = Absence.query.filter(
            Absence.absence_type_id == "vacation",
            Absence.start_date <= end_date,
            Absence.end_date >= start_date,
        ).all()
        logger.info(f"Loaded {len(absences)} vacation absences for year {year}")

        # Get settings
        settings = Settings.query.first()
        if settings:
            logger.info(f"Loaded settings: store={settings.store_name}")
        else:
            logger.warning("No settings found in database")

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_admin_yearly_form(
            year=year, employees=employees, absences=absences, settings=settings
        )

        logger.info(
            f"Successfully generated admin yearly vacation form for year {year}"
        )

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"urlaubsplanung_admin_{year}.pdf",
        )

    except Exception as e:
        logger.error(f"Error generating admin yearly form: {str(e)}", exc_info=True)
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


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
        employee = db.session.get(Employee, employee_id)
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

        # Optionally fetch absence
        absence = None
        absence_id_str = request.args.get("absence_id")
        if absence_id_str:
            try:
                absence_id = int(absence_id_str)
                absence = Absence.query.filter_by(
                    id=absence_id, employee_id=employee_id
                ).first()
                if not absence:
                    logger.warning(
                        f"Absence with ID {absence_id} not found "
                        f"for employee {employee_id}"
                    )
                    return jsonify(
                        {
                            "status": "error",
                            "message": (
                                f"Absence with ID {absence_id} not found for employee"
                            ),
                        }
                    ), HTTPStatus.NOT_FOUND
                logger.info(f"Loaded absence {absence_id} for employee {employee_id}")
            except ValueError:
                return jsonify(
                    {"status": "error", "message": "absence_id must be a valid integer"}
                ), HTTPStatus.BAD_REQUEST

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_employee_request_form(
            employee=employee, absence=absence, settings=settings
        )

        logger.info(
            f"Generated employee request form for employee "
            f"{employee.employee_id}"
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
            download_name=filename,
        )

    except Exception as e:
        logger.error(f"Error generating employee request form: {str(e)}", exc_info=True)
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


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
            return jsonify(
                {"status": "error", "message": "year parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            year = int(year_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "year must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Validate year
        current_year = datetime.now().year
        max_year = current_year + MAX_YEAR_OFFSET
        if year < MIN_YEAR or year > max_year:
            return jsonify(
                {
                    "status": "error",
                    "message": f"year must be between {MIN_YEAR} and {max_year}",
                }
            ), HTTPStatus.BAD_REQUEST

        # Fetch employees
        employees = Employee.query.filter_by(is_active=True).all()
        logger.info(f"Loaded {len(employees)} active employees")

        # Fetch vacation absences for the year
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()

        absences = Absence.query.filter(
            Absence.absence_type_id == "vacation",
            Absence.start_date <= end_date,
            Absence.end_date >= start_date,
        ).all()
        logger.info(f"Loaded {len(absences)} vacation absences for year {year}")

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_overview_form(
            employees=employees, absences=absences, year=year, settings=settings
        )

        logger.info(f"Successfully generated overview form for year {year}")

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"urlaubsuebersicht_{year}.pdf",
        )

    except Exception as e:
        logger.error(f"Error generating overview form: {str(e)}", exc_info=True)
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/vacation-pdf/yearly-calendar", methods=["GET"])
def get_yearly_calendar():
    """
    Generate yearly calendar with 6 months per page showing approved absences.

    Format: DIN A4 Landscape, 2 pages (6 months per page in 2x3 grid)
    Shows approved vacation requests with visual indicators.

    Query parameters:
        year (required): Year for calendar (e.g., 2024)

    Returns:
        PDF file for download
    """
    try:
        # Get year parameter
        year_str = request.args.get("year")
        if not year_str:
            return jsonify(
                {"status": "error", "message": "year parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            year = int(year_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "year must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Validate year
        current_year = datetime.now().year
        max_year = current_year + MAX_YEAR_OFFSET
        if year < MIN_YEAR or year > max_year:
            return jsonify(
                {
                    "status": "error",
                    "message": f"year must be between {MIN_YEAR} and {max_year}",
                }
            ), HTTPStatus.BAD_REQUEST

        # Fetch employees
        employees = Employee.query.filter_by(is_active=True).all()
        logger.info(f"Loaded {len(employees)} active employees for calendar")

        # Fetch ALL approved absences for the year (all types, not just vacation)
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()

        absences = Absence.query.filter(
            Absence.status == "approved",
            Absence.start_date <= end_date,
            Absence.end_date >= start_date,
        ).all()
        logger.info(
            f"Loaded {len(absences)} approved absences (all types) for year {year}"
        )

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_yearly_calendar(
            year=year,
            employees=employees,
            absences=absences,
            settings=settings,
        )

        logger.info(f"Successfully generated yearly calendar for year {year}")

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"jahresurlaubskalender_{year}.pdf",
        )

    except Exception as e:
        logger.error(f"Error generating yearly calendar: {str(e)}", exc_info=True)
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/vacation-pdf/yearly-calendar-grid", methods=["GET"])
def get_yearly_calendar_grid():
    """
    Generate yearly calendar with grid layout (days as columns).

    Format: 2 pages in landscape with 6 months per page.
    Days 1-31 displayed as columns, months as rows.
    Vacation entries shown horizontally without overlapping.

    Query parameters:
        year (required): Year for calendar (e.g., 2024)

    Returns:
        PDF file for download
    """
    try:
        # Get year parameter
        year_str = request.args.get("year")
        if not year_str:
            return jsonify(
                {"status": "error", "message": "year parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            year = int(year_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "year must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Validate year
        current_year = datetime.now().year
        max_year = current_year + MAX_YEAR_OFFSET
        if year < MIN_YEAR or year > max_year:
            return jsonify(
                {
                    "status": "error",
                    "message": f"year must be between {MIN_YEAR} and {max_year}",
                }
            ), HTTPStatus.BAD_REQUEST

        # Fetch employees
        employees = Employee.query.filter_by(is_active=True).all()
        logger.info(f"Loaded {len(employees)} active employees for calendar grid")

        # Fetch ALL approved absences for the year
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()

        absences = Absence.query.filter(
            Absence.status == "approved",
            Absence.start_date <= end_date,
            Absence.end_date >= start_date,
        ).all()
        logger.info(f"Loaded {len(absences)} approved absences for year {year}")

        # Get settings
        settings = Settings.query.first()

        # Generate PDF with grid layout
        generator = VacationGridPDFGenerator()
        pdf_buffer = generator.generate_yearly_calendar_grid(
            year=year,
            employees=employees,
            absences=absences,
            settings=settings,
        )

        logger.info(f"Successfully generated yearly calendar grid for year {year}")

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"jahresurlaubskalender_grid_{year}.pdf",
        )

    except Exception as e:
        logger.error(
            f"Error generating yearly calendar grid: {str(e)}",
            exc_info=True,
        )
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/vacation-pdf/bulk-requests", methods=["GET"])
def get_bulk_vacation_requests():
    """
    Generate bulk vacation request forms for all employees.

    Query parameters:
        year (required): Year for vacation requests (e.g., 2024)

    Returns:
        PDF file for download
    """
    try:
        # Get year parameter
        year_str = request.args.get("year")
        if not year_str:
            return jsonify(
                {"status": "error", "message": "year parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            year = int(year_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "year must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Validate year
        current_year = datetime.now().year
        max_year = current_year + MAX_YEAR_OFFSET
        if year < MIN_YEAR or year > max_year:
            return jsonify(
                {
                    "status": "error",
                    "message": f"year must be between {MIN_YEAR} and {max_year}",
                }
            ), HTTPStatus.BAD_REQUEST

        # Fetch employees
        employees = Employee.query.filter_by(is_active=True).all()
        logger.info(f"Loaded {len(employees)} active employees for bulk requests")

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_bulk_vacation_requests(
            employees=employees, year=year, settings=settings
        )

        logger.info(f"Successfully generated bulk vacation requests for year {year}")

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"urlaubsantraege_bulk_{year}.pdf",
        )

    except Exception as e:
        logger.error(
            f"Error generating bulk vacation requests: {str(e)}", exc_info=True
        )
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/vacation-pdf/approval", methods=["GET"])
def get_vacation_approval_form():
    """
    Generate vacation approval form for a specific absence request.

    Query parameters:
        absence_id (required): Absence ID to generate approval form for

    Returns:
        PDF file for download
    """
    try:
        # Get absence_id parameter
        absence_id_str = request.args.get("absence_id")
        if not absence_id_str:
            return jsonify(
                {
                    "status": "error",
                    "message": "absence_id parameter is required",
                }
            ), HTTPStatus.BAD_REQUEST

        try:
            absence_id = int(absence_id_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "absence_id must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Fetch absence
        absence = db.session.get(Absence, absence_id)
        if not absence:
            logger.warning(f"Absence with ID {absence_id} not found")
            return jsonify(
                {
                    "status": "error",
                    "message": f"Absence with ID {absence_id} not found",
                }
            ), HTTPStatus.NOT_FOUND

        # Verify it's a vacation type absence
        if absence.absence_type_id != "vacation":
            return jsonify(
                {
                    "status": "error",
                    "message": "This absence is not a vacation request",
                }
            ), HTTPStatus.BAD_REQUEST

        # Fetch employee
        employee = db.session.get(Employee, absence.employee_id)
        if not employee:
            logger.warning(f"Employee with ID {absence.employee_id} not found")
            return jsonify(
                {
                    "status": "error",
                    "message": "Employee not found for this absence",
                }
            ), HTTPStatus.NOT_FOUND

        logger.info(
            f"Loaded absence {absence_id} for employee {employee.employee_id}: "
            f"{employee.first_name} {employee.last_name}"
        )

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_vacation_approval_form(
            employee=employee, absence=absence, settings=settings
        )

        logger.info(
            f"Generated vacation approval form for absence {absence_id}, "
            f"employee {employee.employee_id}"
        )

        filename = (
            f"urlaubsgenehmigung_{employee.employee_id}_"
            f"{absence.start_date.strftime('%Y%m%d')}.pdf"
        )

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except Exception as e:
        logger.error(
            f"Error generating vacation approval form: {str(e)}", exc_info=True
        )
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/vacation-pdf/approvals-bulk", methods=["GET"])
def get_bulk_vacation_approvals():
    """
    Generate bulk vacation approval forms for all employees.

    Query parameters:
        year (required): Year for vacation approvals (e.g., 2024)

    Returns:
        PDF file for download
    """
    try:
        # Get year parameter
        year_str = request.args.get("year")
        if not year_str:
            return jsonify(
                {"status": "error", "message": "year parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            year = int(year_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "year must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Validate year
        current_year = datetime.now().year
        max_year = current_year + MAX_YEAR_OFFSET
        if year < MIN_YEAR or year > max_year:
            return jsonify(
                {
                    "status": "error",
                    "message": f"year must be between {MIN_YEAR} and {max_year}",
                }
            ), HTTPStatus.BAD_REQUEST

        # Fetch employees
        employees = Employee.query.filter_by(is_active=True).all()
        logger.info(f"Loaded {len(employees)} active employees for bulk approvals")

        # Fetch vacation absences for the year
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()

        absences = Absence.query.filter(
            Absence.absence_type_id == "vacation",
            Absence.start_date <= end_date,
            Absence.end_date >= start_date,
        ).all()
        logger.info(f"Loaded {len(absences)} vacation absences for year {year}")

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_bulk_vacation_approvals(
            employees=employees, absences=absences, year=year, settings=settings
        )

        logger.info(f"Successfully generated bulk vacation approvals for year {year}")

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"urlaubsgenehmigungen_bulk_{year}.pdf",
        )

    except Exception as e:
        logger.error(
            f"Error generating bulk vacation approvals: {str(e)}", exc_info=True
        )
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/vacation-pdf/yearly-overview", methods=["GET"])
def get_yearly_vacation_overview():
    """
    Generate yearly vacation overview with ALL approved absences.

    This includes vacation, time-off, training, and other absence types
    that have been approved.

    Query parameters:
        year (required): Year for the overview (e.g., 2024)

    Returns:
        PDF file for download
    """
    try:
        # Get year parameter
        year_str = request.args.get("year")
        if not year_str:
            return jsonify(
                {"status": "error", "message": "year parameter is required"}
            ), HTTPStatus.BAD_REQUEST

        try:
            year = int(year_str)
        except ValueError:
            return jsonify(
                {"status": "error", "message": "year must be a valid integer"}
            ), HTTPStatus.BAD_REQUEST

        # Validate year range
        max_year = datetime.now().year + MAX_YEAR_OFFSET
        if not (MIN_YEAR <= year <= max_year):
            return jsonify(
                {
                    "status": "error",
                    "message": f"year must be between {MIN_YEAR} and {max_year}",
                }
            ), HTTPStatus.BAD_REQUEST

        # Fetch employees
        employees = Employee.query.filter_by(is_active=True).all()
        logger.info(f"Loaded {len(employees)} active employees")

        # Fetch ALL approved absences (vacation, time-off, training, etc.) for the year
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()

        absences = Absence.query.filter(
            Absence.status == "approved",
            Absence.start_date <= end_date,
            Absence.end_date >= start_date,
        ).all()
        logger.info(
            f"Loaded {len(absences)} approved absences (all types) for year {year}"
        )

        # Get settings
        settings = Settings.query.first()

        # Generate PDF using existing overview form
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_overview_form(
            employees=employees, absences=absences, year=year, settings=settings
        )

        logger.info(f"Successfully generated yearly vacation overview for {year}")

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"jahresurlaub_uebersicht_{year}.pdf",
        )

    except Exception as e:
        logger.error(
            f"Error generating yearly vacation overview: {str(e)}", exc_info=True
        )
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/vacation-pdf/employee-vacation-entitlement", methods=["GET"])
def get_employee_vacation_entitlement():
    """
    Generate comprehensive employee vacation entitlement with usage data.

    Query parameters:
        year (optional): Year for the report (defaults to current year)

    Returns:
        PDF file for download
    """
    try:
        # Get year parameter (default to current year)
        year_str = request.args.get("year")
        if year_str:
            try:
                year = int(year_str)
            except ValueError:
                year = datetime.now().year
        else:
            year = datetime.now().year

        # Fetch all active employees
        employees = (
            Employee.query.filter_by(is_active=True)
            .order_by(Employee.last_name, Employee.first_name)
            .all()
        )
        logger.info(
            f"Loaded {len(employees)} active employees for "
            f"vacation entitlement list {year}"
        )

        # Fetch ALL approved absences (vacation, time-off, training, etc.) for the year
        start_date = datetime(year, 1, 1).date()
        end_date = datetime(year, 12, 31).date()

        absences = Absence.query.filter(
            Absence.status == "approved",
            Absence.start_date <= end_date,
            Absence.end_date >= start_date,
        ).all()
        logger.info(
            f"Loaded {len(absences)} approved absences (all types) for year {year}"
        )

        # Get settings
        settings = Settings.query.first()

        # Generate PDF
        generator = VacationPDFGenerator()
        pdf_buffer = generator.generate_employee_vacation_entitlement_list(
            employees=employees,
            absences=absences,
            year=year,
            settings=settings,
        )

        logger.info(
            f"Successfully generated employee vacation entitlement list for {year}"
        )

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"mitarbeiter_urlaubsanspruch_{year}.pdf",
        )

    except Exception as e:
        logger.error(
            f"Error generating employee vacation entitlement list: {str(e)}",
            exc_info=True,
        )
        return jsonify(
            {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
