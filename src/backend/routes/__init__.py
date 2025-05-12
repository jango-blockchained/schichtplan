from .shifts import shifts
from .settings import settings
from .schedules import schedules
from .employees import employees
from .availability import availability
from .ai_schedule_routes import ai_schedule_bp # Corrected module name

__all__ = [
    'shifts',
    'settings',
    'schedules',
    'employees',
    'availability',
    'ai_schedule_bp' # Blueprint name is correct
]

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import HTTPException, NotFound
from src.backend.utils.settings import get_value

api_bp = Blueprint('api', __name__)

from .ping import ping_bp
from .schedule import schedule_bp
from .settings import settings_bp
from .availability import availability_bp
from .shift_template import shift_template_bp
from .coverage import coverage_bp
from .employee import employee_bp
from .absence import absence_bp
from .store import store_bp
from .scheduled_shift import scheduled_shift_bp
from .fixed_shift import fixed_shift_bp
from .pdf import pdf_bp
from .debug import debug_bp

# Register blueprints
api_bp.register_blueprint(ping_bp, url_prefix='/ping')
api_bp.register_blueprint(schedule_bp, url_prefix='/schedules')
api_bp.register_blueprint(settings_bp, url_prefix='/settings')
api_bp.register_blueprint(availability_bp, url_prefix='/availability')
api_bp.register_blueprint(shift_template_bp, url_prefix='/shift-templates')
api_bp.register_blueprint(coverage_bp, url_prefix='/coverage')
api_bp.register_blueprint(employee_bp, url_prefix='/employees')
api_bp.register_blueprint(absence_bp, url_prefix='/absences')
api_bp.register_blueprint(store_bp, url_prefix='/store')
api_bp.register_blueprint(scheduled_shift_bp, url_prefix='/scheduled-shifts')
api_bp.register_blueprint(fixed_shift_bp, url_prefix='/fixed-shifts')
api_bp.register_blueprint(pdf_bp, url_prefix='/pdf')
api_bp.register_blueprint(ai_schedule_bp, url_prefix='/ai-schedule')
api_bp.register_blueprint(debug_bp, url_prefix='/debug')

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