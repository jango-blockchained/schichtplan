from flask import Blueprint, request, jsonify
from flask_cors import CORS  # Import CORS
from src.backend.services.ai_scheduler_service import (
    AISchedulerService,
)  # Now this should exist
from src.backend.utils.logger import (
    logger,
)  # Corrected: import the global logger instance
from pydantic import ValidationError  # Import ValidationError
from src.backend.schemas.ai_schedule import (
    AIScheduleGenerateRequest,
    AIScheduleFeedbackRequest,
)  # Import both schemas
from datetime import datetime
import json

# Fix: Removed redundant url_prefix that was conflicting with blueprint registration in routes/__init__.py
ai_schedule_bp = Blueprint("ai_schedule_bp", __name__)
# Apply a more explicit CORS to the blueprint for testing
CORS(
    ai_schedule_bp,
    origins="*",
    methods=["GET", "POST", "OPTIONS", "PUT"],
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
)


@ai_schedule_bp.route("/schedule/generate-ai", methods=["POST"])
def generate_ai_schedule():
    """
    Endpoint to trigger AI-based schedule generation.
    Expects JSON payload with:
    - "start_date": "YYYY-MM-DD" (required)
    - "end_date": "YYYY-MM-DD" (required)
    - "version_id": any (optional, for associating the schedule)
    - "ai_model_params": {} (optional, to override default AI model parameters like temperature)
    """
    try:
        data = request.get_json()
        if not data:
            logger.app_logger.warning(
                "AI schedule generation request with no input data."
            )  # Use logger.app_logger
            return jsonify({"error": "No input data provided"}), 400

        logger.app_logger.info(
            f"AI schedule generation request received: {data}"
        )  # Use logger.app_logger

        # Use Pydantic for validation
        request_data = AIScheduleGenerateRequest(**data)

        # Access validated data from the model
        start_date_str = request_data.start_date.strftime(
            "%Y-%m-%d"
        )  # Convert date object back to string if needed by service
        end_date_str = request_data.end_date.strftime(
            "%Y-%m-%d"
        )  # Convert date object back to string if needed by service
        version_id = request_data.version_id
        ai_model_params = request_data.ai_model_params

        # Remove manual date validation, Pydantic handles it
        # if not start_date_str or not end_date_str:
        #     logger.app_logger.warning(f"AI schedule generation request missing required dates: {data}") # Use logger.app_logger
        #     return jsonify({"error": "start_date and end_date (YYYY-MM-DD) are required"}), 400

        ai_service = AISchedulerService()

        result = ai_service.generate_schedule_via_ai(
            start_date_str=start_date_str,
            end_date_str=end_date_str,
            version_id=version_id,
            ai_model_params=ai_model_params,
        )

        logger.app_logger.info(
            f"AI schedule generation service call completed. Result: {result.get('status') if isinstance(result, dict) else 'Raw CSV returned'}"
        )  # Use logger.app_logger
        return jsonify(result), 200

    except ValidationError as e:  # Catch Pydantic validation errors
        logger.app_logger.error(
            f"Validation error in AI schedule generation: {e.errors()}"
        )
        return jsonify(
            {"error": "Invalid input.", "details": e.errors()}
        ), 400  # Return validation details
    except ValueError as ve:
        logger.app_logger.error(
            f"Validation error in AI schedule generation: {str(ve)}", exc_info=True
        )  # Use logger.app_logger
        return jsonify({"error": f"Validation error: {str(ve)}"}), 400
    except RuntimeError as re:
        logger.app_logger.error(
            f"Runtime error in AI schedule generation: {str(re)}", exc_info=True
        )  # Use logger.app_logger
        return jsonify({"error": f"Operation error: {str(re)}"}), 500
    except Exception as e:
        logger.app_logger.error(
            f"Unexpected error in AI schedule generation endpoint: {str(e)}",
            exc_info=True,
        )  # Use logger.app_logger
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


@ai_schedule_bp.route("/feedback", methods=["POST"])
def submit_ai_schedule_feedback():
    """
    Endpoint to receive feedback on AI-generated schedule assignments.
    Expects JSON payload conforming to AIScheduleFeedbackRequest schema.
    """
    try:
        data = request.get_json()
        if not data:
            logger.app_logger.warning(
                "AI schedule feedback request with no input data."
            )
            return jsonify({"error": "No input data provided"}), 400

        logger.app_logger.info(f"AI schedule feedback request received: {data}")

        # Use Pydantic for validation
        feedback_data = AIScheduleFeedbackRequest(**data)

        ai_service = AISchedulerService()

        # Assume AISchedulerService has a method to process feedback
        # This method needs to be implemented in the service layer
        result = ai_service.process_feedback(feedback_data)

        logger.app_logger.info(
            f"AI schedule feedback service call completed. Result: {result}"
        )
        return jsonify(
            {"status": "success", "message": "Feedback received"}
        ), 200  # Or return service result

    except ValidationError as e:
        logger.app_logger.error(
            f"Validation error in AI schedule feedback: {e.errors()}"
        )
        return jsonify({"error": "Invalid input.", "details": e.errors()}), 400
    except Exception as e:
        logger.app_logger.error(
            f"Unexpected error in AI schedule feedback endpoint: {str(e)}",
            exc_info=True,
        )
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


@ai_schedule_bp.route("/schedule/import-ai-response", methods=["POST"])
def import_ai_schedule_response():
    """
    Endpoint to import AI-generated schedule assignments from a CSV file.
    Expects form data with:
    - 'file': The CSV file (required)
    - 'version_id': The version ID to associate assignments with (required)
    - 'start_date': The start date of the schedule period (YYYY-MM-DD) (required)
    - 'end_date': The end date of the schedule period (YYYY-MM-DD) (required)
    """
    if "file" not in request.files:
        logger.app_logger.warning("AI schedule import request missing file.")
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    version_id_str = request.form.get("version_id")
    start_date_str = request.form.get("start_date")
    end_date_str = request.form.get("end_date")

    if not version_id_str or not start_date_str or not end_date_str:
        logger.app_logger.warning(
            "AI schedule import request missing version_id, start_date, or end_date."
        )
        return jsonify(
            {"error": "version_id, start_date, and end_date are required form fields"}
        ), 400

    if file.filename == "":
        logger.app_logger.warning("AI schedule import request with empty filename.")
        return jsonify({"error": "No selected file"}), 400

    if file.filename is None or not file.filename.endswith(".csv"):
        logger.app_logger.warning(
            f"AI schedule import request with non-CSV file or no filename: {file.filename}"
        )
        return jsonify(
            {"error": "Invalid file type. Please upload a CSV file."}
        ), 415  # Unsupported Media Type

    try:
        # Read the file content
        csv_content = file.stream.read().decode("utf-8")

        # Convert version_id to integer
        version_id = int(version_id_str)

        # Convert date strings to date objects for parsing/storage
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()

        ai_service = AISchedulerService()
        result = ai_service.import_schedule_from_csv(
            csv_content, version_id, start_date, end_date
        )

        logger.app_logger.info(
            f"AI schedule import service call completed. Result: {result.get('status')}"
        )
        return jsonify(result), 200

    except ValueError as ve:
        logger.app_logger.error(
            f"Value error in AI schedule import: {str(ve)}", exc_info=True
        )
        return jsonify({"error": f"Invalid input data: {str(ve)}"}), 400
    except RuntimeError as re:
        logger.app_logger.error(
            f"Runtime error in AI schedule import: {str(re)}", exc_info=True
        )
        return jsonify({"error": f"Operation error: {str(re)}"}), 500
    except Exception as e:
        logger.app_logger.error(
            f"Unexpected error in AI schedule import endpoint: {str(e)}", exc_info=True
        )
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


@ai_schedule_bp.route("/schedule/preview-ai-data", methods=["POST", "OPTIONS"])
def preview_ai_data():
    """
    Endpoint to preview the optimized data pack that would be sent to AI.
    Expects JSON payload with:
    - "start_date": "YYYY-MM-DD" (required)
    - "end_date": "YYYY-MM-DD" (required)
    """
    if request.method == "OPTIONS":
        return "", 200

    try:
        data = request.get_json()
        if not data:
            logger.app_logger.warning("Preview AI data request with no input data.")
            return jsonify({"error": "No input data provided"}), 400

        # Extract and validate date parameters
        start_date_str = data.get("start_date")
        end_date_str = data.get("end_date")

        if not start_date_str or not end_date_str:
            logger.app_logger.warning("Preview AI data request missing required dates")
            return jsonify({"error": "start_date and end_date are required"}), 400

        # Parse dates
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError as e:
            logger.app_logger.warning(f"Invalid date format in preview request: {e}")
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

        # Collect optimized AI data
        ai_service = AISchedulerService()
        try:
            collected_data_text = ai_service._collect_data_for_ai_prompt(start_date, end_date)
            collected_data = json.loads(collected_data_text)

            # Add metadata about the optimization
            response_data = {
                "status": "success",
                "data_pack": collected_data,
                "metadata": {
                    "start_date": start_date_str,
                    "end_date": end_date_str,
                    "optimization_applied": True,
                    "data_structure_version": "optimized_v1",
                    "total_sections": len(collected_data),
                    "estimated_size_reduction": "60-80%",
                },
            }

            logger.app_logger.info(
                f"AI data preview generated successfully for {start_date_str} to {end_date_str}"
            )
            return jsonify(response_data), 200

        except Exception as e:
            logger.app_logger.error(
                f"Error collecting AI data for preview: {e}", exc_info=True
            )
            return jsonify({"error": f"Failed to collect AI data: {str(e)}"}), 500

    except Exception as e:
        logger.app_logger.error(f"Unexpected error in AI data preview: {e}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500


# Further endpoints related to AI scheduling can be added here
