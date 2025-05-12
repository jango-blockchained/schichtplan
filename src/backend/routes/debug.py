from flask import Blueprint, jsonify
from src.backend.models.settings import Settings
from src.backend.services.ai_scheduler_service import AISchedulerService

debug_bp = Blueprint('debug', __name__)

@debug_bp.route('/check-ai-settings', methods=['GET'])
def check_ai_settings():
    """Debug endpoint to check AI settings"""
    try:
        settings = Settings.query.first()
        if not settings:
            return jsonify({"error": "No settings found in database"})
        
        ai_settings = settings.ai_scheduling
        
        # Create a copy of the settings without exposing the actual API key
        safe_settings = {
            "enabled": ai_settings.get("enabled", False) if isinstance(ai_settings, dict) else False,
            "has_api_key": bool(ai_settings.get("api_key")) if isinstance(ai_settings, dict) else False
        }
        
        # Also test if the service can load the key
        ai_service = AISchedulerService()
        key_loaded = bool(ai_service.gemini_api_key)
        
        return jsonify({
            "status": "success",
            "ai_settings": safe_settings,
            "key_loaded_in_service": key_loaded,
            "service_model": ai_service.gemini_model_name
        })
    except Exception as e:
        return jsonify({"error": str(e)}) 