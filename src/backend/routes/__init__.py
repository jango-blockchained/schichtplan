from .shifts import shifts
from .settings import settings
from .schedules import schedules
from .employees import employees
from .availability import availability
from .ai_schedule_routes import ai_schedule_bp # Corrected module name
from .ping import ping_bp  # We created this file
from .debug import debug_bp # This file exists
from .absences import bp as absences_bp # Renamed to match export
from .logs import bp as logs_bp # Renamed to match export
from .auth import bp as auth_bp # Renamed to match export

__all__ = [
    'shifts',
    'settings',
    'schedules',
    'employees',
    'availability',
    'ai_schedule_bp',
    'ping_bp',
    'debug_bp',
    'absences_bp',
    'logs_bp',
    'auth_bp'
]

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import HTTPException, NotFound

api_bp = Blueprint('api', __name__)

# Register blueprints that exist
api_bp.register_blueprint(ping_bp, url_prefix='/ping')
api_bp.register_blueprint(shifts, url_prefix='/shifts')
api_bp.register_blueprint(settings, url_prefix='/settings')
api_bp.register_blueprint(schedules, url_prefix='/schedules')
api_bp.register_blueprint(availability, url_prefix='/availability')
api_bp.register_blueprint(employees, url_prefix='/employees')
api_bp.register_blueprint(absences_bp, url_prefix='/absences')
api_bp.register_blueprint(logs_bp, url_prefix='/logs')
api_bp.register_blueprint(debug_bp, url_prefix='/debug')
api_bp.register_blueprint(ai_schedule_bp, url_prefix='/ai-schedule')
api_bp.register_blueprint(auth_bp, url_prefix='/auth')

@api_bp.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    
    current_app.logger.error(f"Unhandled exception: {e}", exc_info=True)
    return jsonify({"error": "Internal server error"}), 500

@api_bp.errorhandler(404)
def handle_not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Resource not found"}), 404
    return e 