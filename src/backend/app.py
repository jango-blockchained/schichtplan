import json
import logging
import os
import traceback
import uuid
from datetime import date, datetime, timedelta
from logging.handlers import RotatingFileHandler
from pathlib import Path

import click
from sqlalchemy import inspect

# Try to import flask_sse but don't fail if not available
try:
    from flask_sse import sse

    has_sse = True
except ImportError:
    has_sse = False
    print("Warning: flask_sse not available. SSE functionality will be disabled.")

# Add the parent directory to Python path
# current_dir = Path(__file__).resolve().parent
# if str(current_dir) not in sys.path:
#     sys.path.append(str(current_dir))

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate

from src.backend.api.coverage import bp as coverage_bp
from src.backend.api.demo_data import bp as demo_data_bp
from src.backend.api.pdf_settings import bp as pdf_settings_bp
from src.backend.api.schedules import bp as api_schedules_bp
from src.backend.api.settings import bp as api_settings_bp
from src.backend.api.week_navigation import bp as week_navigation_bp
from src.backend.config import Config
from src.backend.models import db

# Import AI models to ensure they're registered with SQLAlchemy
from src.backend.routes import logs
from src.backend.routes.absences import bp as absences_bp
from src.backend.routes.ai_schedule_routes import ai_schedule_bp
from src.backend.routes.auth import bp as auth_bp
from src.backend.routes.availability import availability
from src.backend.routes.employees import employees
from src.backend.routes.holiday_import import holiday_import as holiday_import_bp
from src.backend.routes.holiday_routes import holidays as holidays_bp
from src.backend.routes.schedules import schedules
from src.backend.routes.settings import settings
from src.backend.routes.shifts import shifts
from src.backend.routes.special_days import special_days as special_days_bp
from src.backend.utils.logger import (
    CustomFormatter,
)
from src.backend.utils.logger import (
    logger as global_logger,
)

# Import diagnostic tools
try:
    from src.backend.tools.debug.flask_diagnostic import (
        register_commands as register_diagnostic_commands,
    )
except ImportError:
    register_diagnostic_commands = None


def check_and_init_db(app):
    """Check if the database is initialized and initialize it if not."""
    with app.app_context():
        inspector = inspect(db.engine)
        if not inspector.has_table("employees"):  # Check for a key table
            print("Database not initialized. Initializing...")
            from src.backend.tools.initialization.init_db import init_db

            init_db(app)
            print("Database initialization complete.")


def setup_logging(app):
    # Create a new logger instance
    app_logger = global_logger

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
    if isinstance(config_class, str):
        if config_class.lower() == "testing":
            from src.backend.testing import TestingConfig

            config_class = TestingConfig
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Configure CORS with more permissive settings
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": [
                    "Content-Type",
                    "Authorization",
                    "Accept",
                    "X-Requested-With",
                ],
                "expose_headers": ["Content-Type", "Authorization"],
                "supports_credentials": True,
                "max_age": 86400,  # Cache preflight requests for 24 hours
            },
            r"/api/v2/*": {  # Explicit configuration for /api/v2/ endpoints
                "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": [
                    "Content-Type",
                    "Authorization",
                    "Accept",
                    "X-Requested-With",
                ],
                "expose_headers": ["Content-Type", "Authorization"],
                "supports_credentials": True,
                "max_age": 86400,
            },
            r"/v2/*": {  # Added block for /v2/* endpoints
                "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": [
                    "Content-Type",
                    "Authorization",
                    "Accept",
                    "X-Requested-With",
                ],
                "expose_headers": ["Content-Type", "Authorization"],
                "supports_credentials": True,
                "max_age": 86400,
            },
        },
    )

    # Initialize extensions
    db.init_app(app)
    print(f"Debug: db instance ID after init_app in create_app: {id(db)}")
    # Use the consolidated migrations directory
    migrations_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "instance", "migrations"
    )
    Migrate(app, db, directory=migrations_dir)

    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    check_and_init_db(app)

    # Setup logging
    setup_logging(app)

    # Register blueprints
    app.register_blueprint(shifts, url_prefix="/api/v2")
    app.register_blueprint(settings, url_prefix="/api/v2")
    app.register_blueprint(schedules, url_prefix="/api/v2")
    app.register_blueprint(employees, url_prefix="/api/v2")
    app.register_blueprint(availability)
    app.register_blueprint(absences_bp, url_prefix="/api/v2")
    app.register_blueprint(ai_schedule_bp, url_prefix="/api/v2")
    app.register_blueprint(holidays_bp, url_prefix="/api/v2")
    app.register_blueprint(holiday_import_bp, url_prefix="/api/v2")
    app.register_blueprint(special_days_bp, url_prefix="/api/v2")
    app.register_blueprint(auth_bp)  # Register auth blueprint
    app.register_blueprint(coverage_bp)
    app.register_blueprint(pdf_settings_bp)  # Register PDF settings blueprint
    app.register_blueprint(
        api_settings_bp, name="api_settings"
    )  # Register API settings blueprint
    app.register_blueprint(demo_data_bp, url_prefix="/api/v2")
    app.register_blueprint(logs.bp, url_prefix="/api/v2/logs")
    app.register_blueprint(
        api_schedules_bp, name="api_schedules"
    )  # Register with unique name to avoid conflict
    app.register_blueprint(week_navigation_bp)  # Register week navigation

    # Register MCP routes
    from src.backend.routes.mcp_routes import bp as mcp_bp

    app.register_blueprint(mcp_bp, url_prefix="/api/v2")

    # Register AI routes
    from src.backend.routes.ai_routes import ai_bp, init_ai_services

    app.register_blueprint(ai_bp, url_prefix="/api/v2")
    init_ai_services(app)

    # Register SSE blueprint for /sse endpoint if available
    if has_sse:
        try:
            app.config["REDIS_URL"] = "redis://localhost:6379/0"  # Adjust if needed
            app.register_blueprint(sse, url_prefix="/sse")
            app.logger.info("SSE blueprint registered successfully")
        except Exception as e:
            app.logger.warning(f"Failed to register SSE blueprint: {str(e)}")
            app.logger.warning("SSE functionality will be disabled")
    else:
        app.logger.warning("SSE module not available. SSE functionality is disabled.")

    # Register diagnostic commands if available
    if register_diagnostic_commands:
        register_diagnostic_commands(app)

    # Health check endpoint for monitoring and port detection
    @app.route("/api/v2/health", methods=["GET"])
    def health_check():
        return jsonify(
            {
                "status": "ok",
                "timestamp": datetime.now().isoformat(),
                "version": "1.0.0",
                "port": request.environ.get("SERVER_PORT", 5000),
            }
        )

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
        from src.backend.models import Coverage, Employee, ShiftTemplate
        from src.backend.services.scheduler import ScheduleGenerator

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

    # Add AI diagnostic command
    @app.cli.command("run-ai-diagnostic")
    @click.option("--start-date", type=str, help="Start date in YYYY-MM-DD format")
    @click.option("--end-date", type=str, help="End date in YYYY-MM-DD format")
    @click.option(
        "--days", type=int, default=7, help="Number of days if no dates provided"
    )
    def run_ai_diagnostic(start_date=None, end_date=None, days=7):
        """Run the AI schedule generator diagnostic"""
        from src.backend.models import Coverage, Employee, ShiftTemplate
        from src.backend.services.ai_scheduler_service import AISchedulerService

        session_id = str(uuid.uuid4())[:8]
        app.logger.info(f"Starting AI diagnostic session {session_id}")

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

            start_date_str = start_date.strftime("%Y-%m-%d")
            end_date_str = end_date.strftime("%Y-%m-%d")

            app.logger.info(
                f"AI Schedule date range: {start_date_str} to {end_date_str}"
            )

            # Check database state
            employee_count = Employee.query.count()
            active_employees = Employee.query.filter_by(is_active=True).count()
            shift_count = ShiftTemplate.query.count()
            coverage_count = Coverage.query.count()

            app.logger.info(f"Total employees: {employee_count}")
            app.logger.info(f"Active employees: {active_employees}")
            app.logger.info(f"Shift templates: {shift_count}")
            app.logger.info(f"Coverage requirements: {coverage_count}")

            if employee_count == 0:
                app.logger.warning("No employees found in database")
            if shift_count == 0:
                app.logger.warning("No shift templates found in database")
            if coverage_count == 0:
                app.logger.warning("No coverage requirements found in database")

            # Generate AI schedule
            app.logger.info("Generating AI schedule")
            ai_scheduler = AISchedulerService()
            result = ai_scheduler.generate_schedule_via_ai(
                start_date_str=start_date_str,
                end_date_str=end_date_str,
                version_id=None,  # New version will be created
                ai_model_params=None,  # Use defaults
            )

            app.logger.info("AI Schedule generation completed")

            print("\n" + "=" * 80)
            print(f"AI Diagnostic completed. Session ID: {session_id}")
            print(f"Result: {json.dumps(result, indent=2)}")

            # Check if diagnostic log was created
            if result.get("status") == "success" and result.get("diagnostic_log"):
                log_path_str = result.get("diagnostic_log")
                if log_path_str:
                    log_path = Path(log_path_str)
                    print(f"Diagnostic log created at: {log_path}")

                    # Display the last few lines of the diagnostic log
                    try:
                        if log_path.exists():
                            with open(log_path, "r") as f:
                                lines = f.readlines()
                                if lines:
                                    print("\nLast 10 lines of diagnostic log:")
                                    for line in lines[-10:]:
                                        print(f"  {line.strip()}")
                    except Exception as log_error:
                        print(f"Error reading diagnostic log: {str(log_error)}")

            print("=" * 80 + "\n")

        except Exception as e:
            app.logger.error(f"AI Diagnostic failed: {str(e)}")
            app.logger.error(traceback.format_exc())
            print("\n" + "=" * 80)
            print(f"AI Diagnostic failed. Session ID: {session_id}")
            print(f"Error: {str(e)}")
            print("=" * 80 + "\n")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True)
