from flask import Blueprint, request, jsonify, send_file
from http import HTTPStatus
from datetime import datetime
import traceback

# Relative imports
from ..models import Schedule
from ..services.pdf_generator import PDFGenerator
from ..utils.logger import logger

export_bp = Blueprint("schedule_export", __name__, url_prefix="/api/schedules")

# Note: The original file had two PDF export routes.
# One at /<id>/pdf and one at /export. Consolidating logic or 
# keeping both might be needed depending on requirements.

@export_bp.route("/<int:schedule_id>/pdf", methods=["GET"])
def get_schedule_pdf_by_id(schedule_id):
    """Generate PDF for a specific schedule ID."""
    try:
        schedule = Schedule.query.get_or_404(schedule_id)
        # This assumes PDFGenerator needs a list, even for one entry
        schedules_list = [schedule]
        # Assuming PDF needs start/end dates - using schedule date
        start_date = schedule.date
        end_date = schedule.date

        generator = PDFGenerator()
        pdf_buffer = generator.generate_schedule_pdf(
            schedules_list, start_date, end_date
        )

        # Shortened filename generation
        filename = f"sched_{schedule_id}_{start_date.strftime('%y%m%d')}.pdf"
        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        logger.exception(f"Error generating PDF for schedule {schedule_id}")
        return (
            jsonify({"error": f"Failed to generate PDF: {str(e)}"}),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )

@export_bp.route("/export", methods=["POST"])
def export_schedule_pdf_range():
    """Export schedule for a date range as PDF."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), HTTPStatus.BAD_REQUEST

        start_date_str = data.get("start_date")
        end_date_str = data.get("end_date")
        version = data.get("version")  # Optional
        layout_config = data.get("layout_config")  # Optional

        if not start_date_str or not end_date_str:
            return (
                jsonify({"error": "Date range required"}), 
                HTTPStatus.BAD_REQUEST
            )
            
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()

        # Get schedules for the date range
        query = Schedule.query.filter(
            Schedule.date >= start_date, Schedule.date <= end_date
        )
        if version is not None:
            query = query.filter(Schedule.version == version)
             
        schedules_list = query.all()
        if not schedules_list:
            return (
                jsonify({"error": "No schedules found"}), 
                HTTPStatus.NOT_FOUND
            )

        # Generate PDF
        generator = PDFGenerator()
        pdf_buffer = generator.generate_schedule_pdf(
            schedules_list, start_date, end_date, layout_config
        )

        # Shortened filename generation
        date_fmt = "%y%m%d"
        start_f = start_date.strftime(date_fmt)
        end_f = end_date.strftime(date_fmt)
        filename = f"sched_{start_f}_{end_f}.pdf"
        if version is not None:
            filename = f"sched_v{version}_{start_f}_{end_f}.pdf"

        return send_file(
            pdf_buffer,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        error_msg = f"Failed PDF export: {str(e)}"
        logger.error(
            error_msg,
            extra={
                "action": "export_schedule_error",
                "error": str(e),
                "traceback": traceback.format_exc(),
            },
        )
        return jsonify({"error": error_msg}), HTTPStatus.INTERNAL_SERVER_ERROR 