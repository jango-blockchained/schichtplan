import sys
import logging
import traceback
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Add the parent directory to Python path
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.append(str(current_dir))

from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from models import db
from config import Config
from routes.shifts import shifts
from routes.settings import settings
from routes.schedules import schedules
from routes.employees import employees
from routes.availability import availability
from routes.absences import bp as absences_bp
from api.coverage import bp as coverage_bp
from api.schedules import bp as api_schedules_bp
from api.demo_data import bp as demo_data_bp
from routes import logs  # Add logs import
from utils.logger import (
    Logger,
    CustomFormatter,
)  # Import Logger class and CustomFormatter


def setup_logging(app):
    # Create a new logger instance
    app_logger = Logger()

    # Configure Flask app logger
    app.logger.handlers = []  # Remove default handlers

    # Create a new handler for the app logger
    log_handler = RotatingFileHandler(
        app_logger.logs_dir / "app.log",
        maxBytes=10485760,  # 10MB
        backupCount=5,
        encoding="utf-8",
    )
    log_handler.setFormatter(CustomFormatter())
    app.logger.addHandler(log_handler)
    app.logger.setLevel(logging.DEBUG)

    # Store logger instance in app config for access in routes
    app.config["logger"] = app_logger

    app.logger.info("Backend startup")


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Configure CORS
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": ["http://localhost:5173"],
                "supports_credentials": True,
                "allow_credentials": True,
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "expose_headers": ["Content-Type", "Authorization"],
                "allow_headers": ["Content-Type", "Authorization"],
            }
        },
    )

    # Initialize extensions
    db.init_app(app)
    migrate = Migrate(app, db)

    # Setup logging
    setup_logging(app)

    # Register blueprints
    app.register_blueprint(shifts, url_prefix="/api")
    app.register_blueprint(settings, url_prefix="/api")
    app.register_blueprint(schedules, url_prefix="/api")
    app.register_blueprint(employees, url_prefix="/api")
    app.register_blueprint(availability, url_prefix="/api")
    app.register_blueprint(absences_bp, url_prefix="/api")
    app.register_blueprint(coverage_bp)
    app.register_blueprint(demo_data_bp, url_prefix="/api")
    app.register_blueprint(logs.bp, url_prefix="/api")  # Register logs blueprint
    app.register_blueprint(
        api_schedules_bp, name="api_schedules"
    )  # Register with unique name to avoid conflict

    @app.errorhandler(Exception)
    def handle_error(error):
        app.config["logger"].error_logger.error(
            f"Unhandled exception: {str(error)}\n{traceback.format_exc()}"
        )
        return (
            jsonify(
                {
                    "error": str(error),
                    "message": "An unexpected error occurred. Please try again later.",
                }
            ),
            500,
        )

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
