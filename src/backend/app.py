import sys
import logging
import traceback
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Add the parent directory to Python path
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.append(str(current_dir))

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from models import db
from config import Config, PROJECT_ROOT
from routes.shifts import shifts
from routes.settings import settings
from routes.schedules import schedules
from routes.employees import employees
from routes.availability import availability
from routes.absences import bp as absences_bp
from api.coverage import bp as coverage_bp
from api.demo_data import bp as demo_data_bp
from routes import logs  # Add logs import


def setup_logging(app):
    # Ensure logs directory exists
    logs_dir = PROJECT_ROOT / "logs"
    logs_dir.mkdir(exist_ok=True)

    # Use absolute path for log file
    log_file = logs_dir / "backend.log"
    file_handler = RotatingFileHandler(
        str(log_file), maxBytes=1024 * 1024, backupCount=10
    )
    file_handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]"
        )
    )
    file_handler.setLevel(logging.DEBUG)  # Set to DEBUG for more detailed logs

    # Configure root logger
    logging.basicConfig(
        level=logging.DEBUG,  # Set to DEBUG for more detailed logs
        format="%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]",
        handlers=[file_handler],
    )

    # Add file handler to app logger
    app.logger.addHandler(file_handler)

    # Also log to console in debug mode
    if app.debug:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
        app.logger.addHandler(console_handler)
        logging.getLogger().addHandler(console_handler)

    app.logger.setLevel(logging.DEBUG)  # Set to DEBUG for more detailed logs
    app.logger.info("Backend startup")


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)

    if test_config is None:
        # Load configuration from Config class
        app.config.from_object(Config)
    else:
        app.config.update(test_config)

    # Ensure instance directory exists
    app.config["INSTANCE_DIR"].mkdir(exist_ok=True)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": ["http://localhost:5173"],
                "allow_credentials": True,
                "allow_headers": ["Content-Type", "Authorization"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            }
        },
    )

    # Set up logging
    setup_logging(app)

    # Add error handler for 500 errors
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"500 error: {error}")
        app.logger.error(traceback.format_exc())
        return jsonify({"error": "Internal Server Error", "details": str(error)}), 500

    # Add request logging
    @app.before_request
    def log_request_info():
        app.logger.debug("Request Headers: %s", request.headers)
        app.logger.debug("Request Body: %s", request.get_data())

    # Initialize extensions
    db.init_app(app)
    migrate = Migrate(app, db)

    # Register blueprints with /api prefix
    app.register_blueprint(shifts, url_prefix="/api")
    app.register_blueprint(settings, url_prefix="/api")
    app.register_blueprint(schedules, url_prefix="/api")
    app.register_blueprint(employees, url_prefix="/api")
    app.register_blueprint(
        availability
    )  # No url_prefix needed as it's already defined in the blueprint
    app.register_blueprint(absences_bp, url_prefix="/api")
    app.register_blueprint(
        coverage_bp
    )  # No url_prefix needed as it's already defined in the blueprint
    app.register_blueprint(
        demo_data_bp
    )  # No url_prefix needed as it's already defined in the blueprint
    app.register_blueprint(logs.bp, url_prefix="/api")  # Register logs blueprint

    # Create database tables
    with app.app_context():
        db.create_all()
        app.logger.info("Database tables created/verified")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
