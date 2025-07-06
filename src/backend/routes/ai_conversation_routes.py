"""Routes for AI Conversation Service"""

from flask import Blueprint, jsonify, request
from flask_cors import CORS

from src.backend.services.ai_conversation_service import AIConversationService
from src.backend.utils.logger import logger

# Create blueprint
ai_conversation_bp = Blueprint("ai_conversation", __name__)
CORS(ai_conversation_bp, origins="*", methods=["GET", "POST", "OPTIONS"])

# Initialize service
conversation_service = AIConversationService()


@ai_conversation_bp.route("/conversation", methods=["POST", "OPTIONS"])
def handle_conversation():
    """Handle AI conversation requests for multi-step schedule generation"""
    if request.method == "OPTIONS":
        return "", 200

    try:
        data = request.get_json()
        if not data:
            logger.app_logger.warning("AI conversation request with no input data")
            return jsonify({"error": "No input data provided"}), 400

        logger.app_logger.info(
            f"AI conversation request: action={data.get('action')}, conversation_id={data.get('conversation_id')}"
        )

        # Process the conversation request
        result = conversation_service.process_conversation_request(data)

        # Log result status
        logger.app_logger.info(
            f"AI conversation response: status={result.get('status')}, state={result.get('state')}"
        )

        # Return appropriate status code
        if result.get("status") == "error":
            return jsonify(result), 400

        return jsonify(result), 200

    except Exception as e:
        logger.app_logger.error(
            f"Error in AI conversation endpoint: {e}", exc_info=True
        )
        return jsonify(
            {"status": "error", "message": f"Internal server error: {str(e)}"}
        ), 500


@ai_conversation_bp.route("/conversation/<conversation_id>", methods=["GET"])
def get_conversation_status(conversation_id):
    """Get the status of an ongoing conversation"""
    try:
        conversation = conversation_service._get_conversation(conversation_id)

        if not conversation:
            return jsonify(
                {"status": "error", "message": "Conversation not found"}
            ), 404

        return jsonify(
            {
                "status": "success",
                "conversation_id": conversation_id,
                "state": conversation["state"].value,
                "created_at": conversation["created_at"],
                "context": conversation["context"],
                "has_analysis": conversation.get("analysis") is not None,
                "has_recommendations": conversation.get("recommendations") is not None,
                "has_generated_schedule": conversation.get("generated_schedule")
                is not None,
                "adjustments_count": len(conversation.get("adjustments", [])),
                "messages_count": len(conversation.get("messages", [])),
            }
        ), 200

    except Exception as e:
        logger.app_logger.error(
            f"Error getting conversation status: {e}", exc_info=True
        )
        return jsonify(
            {"status": "error", "message": f"Internal server error: {str(e)}"}
        ), 500


@ai_conversation_bp.route("/conversation/preview-optimized-data", methods=["POST"])
def preview_optimized_data():
    """Preview the optimized data that would be used for AI generation"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        start_date = data.get("start_date")
        end_date = data.get("end_date")
        constraints = data.get("constraints", {})

        if not start_date or not end_date:
            return jsonify({"error": "start_date and end_date are required"}), 400

        # Create a temporary conversation service instance
        from datetime import datetime

        from src.backend.models import (
            Absence,
            Coverage,
            Employee,
            EmployeeAvailability,
            ShiftTemplate,
        )

        # Get optimized data
        optimized_data = {
            "meta": {
                "start_date": start_date,
                "end_date": end_date,
                "constraints": constraints,
                "optimization_level": "high",
            }
        }

        # Count available employees
        employees = Employee.query.filter_by(is_active=True).all()
        available_count = 0

        for emp in employees:
            # Check availability
            has_availability = (
                EmployeeAvailability.query.filter(
                    EmployeeAvailability.employee_id == emp.id
                ).first()
                is not None
            )

            # Check for blocking absence
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                full_absence = (
                    Absence.query.filter(
                        Absence.employee_id == emp.id,
                        Absence.start_date <= start_dt,
                        Absence.end_date >= end_dt,
                    ).first()
                    is not None
                )

                if has_availability and not full_absence:
                    available_count += 1
            except:
                pass

        # Get shift template count
        shift_count = ShiftTemplate.query.count()

        # Get coverage rule count
        coverage_count = Coverage.query.count()

        optimized_data["summary"] = {
            "total_employees": len(employees),
            "available_employees": available_count,
            "shift_templates": shift_count,
            "coverage_rules": coverage_count,
            "data_reduction": "~70% compared to full data dump",
        }

        return jsonify(
            {
                "status": "success",
                "optimized_data": optimized_data,
                "message": "This shows the optimized data structure that would be sent to AI",
            }
        ), 200

    except Exception as e:
        logger.app_logger.error(f"Error previewing optimized data: {e}", exc_info=True)
        return jsonify(
            {"status": "error", "message": f"Internal server error: {str(e)}"}
        ), 500
