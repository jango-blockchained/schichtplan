from flask import Blueprint, request, jsonify
from src.backend.services.ai_scheduler_service import AISchedulerService # Now this should exist
from src.backend.utils.logger import logger # Corrected: import the global logger instance

ai_schedule_bp = Blueprint('ai_schedule_bp', __name__, url_prefix='/ai/schedule')

@ai_schedule_bp.route('/generate', methods=['POST'])
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
            logger.app_logger.warning("AI schedule generation request with no input data.") # Use logger.app_logger
            return jsonify({"error": "No input data provided"}), 400

        logger.app_logger.info(f"AI schedule generation request received: {data}") # Use logger.app_logger

        start_date_str = data.get('start_date')
        end_date_str = data.get('end_date')
        version_id = data.get('version_id') # Can be None
        ai_model_params = data.get('ai_model_params', {}) 

        if not start_date_str or not end_date_str:
            logger.app_logger.warning(f"AI schedule generation request missing required dates: {data}") # Use logger.app_logger
            return jsonify({"error": "start_date and end_date (YYYY-MM-DD) are required"}), 400

        ai_service = AISchedulerService()
        
        result = ai_service.generate_schedule_via_ai(
            start_date_str=start_date_str, 
            end_date_str=end_date_str, 
            version_id=version_id, 
            ai_model_params=ai_model_params
        )

        logger.app_logger.info(f"AI schedule generation service call completed. Result: {result.get('status') if isinstance(result, dict) else 'Raw CSV returned'}") # Use logger.app_logger
        return jsonify(result), 200

    except ValueError as ve:
        logger.app_logger.error(f"Validation error in AI schedule generation: {str(ve)}", exc_info=True) # Use logger.app_logger
        return jsonify({"error": f"Validation error: {str(ve)}"}), 400
    except RuntimeError as re:
        logger.app_logger.error(f"Runtime error in AI schedule generation: {str(re)}", exc_info=True) # Use logger.app_logger
        return jsonify({"error": f"Operation error: {str(re)}"}), 500
    except Exception as e:
        logger.app_logger.error(f"Unexpected error in AI schedule generation endpoint: {str(e)}", exc_info=True) # Use logger.app_logger
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

# Further endpoints related to AI scheduling can be added here
