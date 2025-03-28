# Import eventlet initialization first
try:
    from src.backend.eventlet_init import eventlet
except ImportError:
    try:
        import eventlet

        eventlet.monkey_patch()
        print(
            "Warning: Using fallback eventlet import. This may cause issues if not imported before other modules."
        )
    except ImportError:
        print(
            "Warning: eventlet_init.py not found. This may cause issues with the server."
        )

import sys
import logging
import traceback
from logging.handlers import RotatingFileHandler
from pathlib import Path
import os
from datetime import date, datetime, timedelta
import uuid
import click

# Add the parent directory to Python path
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.append(str(current_dir))

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate
from models import db
from config import Config
from routes.shifts import shifts
from routes.schedules import schedules
from routes.employees import employees
from routes.availability import availability
from routes.absences import bp as absences_bp
from api.coverage import bp as coverage_bp
from api.schedules import bp as api_schedules_bp
from api.settings import bp as api_settings_bp
from api.demo_data import bp as demo_data_bp
from routes import logs  # Add logs import
from utils.logger import (
    Logger,
    CustomFormatter,
)  # Import Logger class and CustomFormatter
from websocket import socketio  # Import init_app function

# Import diagnostic tools
try:
    from tools.debug.flask_diagnostic import (
        register_commands as register_diagnostic_commands,
    )
except ImportError:
    register_diagnostic_commands = None


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

    # Set the JWT secret key for WebSocket authentication
    app.config["JWT_SECRET_KEY"] = app.config.get("SECRET_KEY", "your-secret-key")

    # Configure CORS
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": "*",  # Allow all origins for API endpoints
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

    # Use the consolidated migrations directory
    migrations_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "instance", "migrations"
    )
    migrate = Migrate(app, db, directory=migrations_dir)

    # Push an application context before database operations
    app.app_context().push()

    # Create database tables
    db.create_all()
    app.logger.info("Database tables created")

    # Setup logging
    setup_logging(app)

    # Register blueprints
    app.register_blueprint(shifts, url_prefix="/api")
    app.register_blueprint(schedules, url_prefix="/api")
    app.register_blueprint(employees, url_prefix="/api")
    app.register_blueprint(availability, url_prefix="/api")
    app.register_blueprint(absences_bp, url_prefix="/api")
    app.register_blueprint(coverage_bp)
    app.register_blueprint(api_settings_bp, name="api_settings")
    app.register_blueprint(demo_data_bp, url_prefix="/api/demo-data")
    app.register_blueprint(logs.bp, url_prefix="/api/logs")
    app.register_blueprint(api_schedules_bp, name="api_schedules")

    # Register CLI commands
    try:
        from test_scheduler import register_commands

        register_commands(app)
    except ImportError:
        pass  # Ignore if test_scheduler is not available

    # Register diagnostic commands if available
    if register_diagnostic_commands:
        register_diagnostic_commands(app)

    # Health check endpoint for monitoring and port detection
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify(
            {
                "status": "ok",
                "timestamp": datetime.now().isoformat(),
                "version": "1.0.0",
                "port": request.environ.get("SERVER_PORT", 5000),
            }
        )

    # WebSocket test page
    @app.route("/websocket-test", methods=["GET"])
    def websocket_test():
        from flask import render_template

        return render_template("websocket_test.html")

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

    # Add diagnostic command
    @app.cli.command("run-diagnostic")
    @click.option("--start-date", type=str, help="Start date in YYYY-MM-DD format")
    @click.option("--end-date", type=str, help="End date in YYYY-MM-DD format")
    @click.option(
        "--days", type=int, default=7, help="Number of days if no dates provided"
    )
    def run_diagnostic(start_date=None, end_date=None, days=7):
        """Run the schedule generator diagnostic"""
        from models import Employee, ShiftTemplate, Coverage
        from services.scheduler import ScheduleGenerator

        session_id = str(uuid.uuid4())[:8]
        app.logger.info(f"Starting diagnostic session {session_id}")

        try:
            # Set up dates
            if not start_date:
                start_date = date.today()
            elif isinstance(start_date, str):
                start_date = datetime.strptime(start_date, "%Y-%m-%d").date()

            if not end_date:
                end_date = start_date + timedelta(days=days - 1)
            elif isinstance(end_date, str):
                end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

            app.logger.info(f"Schedule date range: {start_date} to {end_date}")

            # Check database state
            employee_count = Employee.query.count()
            active_employees = Employee.query.filter_by(is_active=True).count()
            keyholders = Employee.query.filter_by(is_keyholder=True).count()
            shift_count = ShiftTemplate.query.count()
            coverage_count = Coverage.query.count()

            app.logger.info(f"Total employees: {employee_count}")
            app.logger.info(f"Active employees: {active_employees}")
            app.logger.info(f"Keyholders: {keyholders}")
            app.logger.info(f"Shift templates: {shift_count}")
            app.logger.info(f"Coverage requirements: {coverage_count}")

            if employee_count == 0:
                app.logger.warning("No employees found in database")
            if shift_count == 0:
                app.logger.warning("No shift templates found in database")
            if coverage_count == 0:
                app.logger.warning("No coverage requirements found in database")

            # Generate schedule
            app.logger.info("Generating schedule")
            generator = ScheduleGenerator()
            result = generator.generate(
                start_date=start_date,
                end_date=end_date,
                version=1,
                session_id=session_id,
            )
            app.logger.info("Schedule generation completed")

            print("\n" + "=" * 80)
            print(f"Diagnostic completed successfully. Session ID: {session_id}")
            print("=" * 80 + "\n")

        except Exception as e:
            app.logger.error(f"Diagnostic failed: {str(e)}")
            app.logger.error(traceback.format_exc())
            print("\n" + "=" * 80)
            print(f"Diagnostic failed. Session ID: {session_id}")
            print(f"Error: {str(e)}")
            print("=" * 80 + "\n")

    # Initialize SocketIO with the Flask app
    socketio.init_app(
        app,
        async_mode="eventlet",
        cors_allowed_origins="*",
        manage_session=False,
        handle_sigint=True,  # Handle Ctrl+C gracefully
        message_queue=None,  # No message queue for now
    )

    return app


if __name__ == "__main__":
    app = create_app()
    socketio.run(app, debug=True)  # Use socketio.run instead of app.run
