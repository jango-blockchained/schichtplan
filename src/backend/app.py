import sys
import logging
import traceback
from logging.handlers import RotatingFileHandler
from pathlib import Path
import os
from datetime import date, datetime, timedelta
import uuid
import click
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate
# Make imports relative to the package
from .config import Config
# from .routes.shifts import shifts
# from .routes.settings import settings
# # from .routes.schedules import schedules # Removed old import
# from .routes.employees import employees
# from .routes.availability import availability
# from .routes.absences import bp as absences_bp
# from .api.coverage import bp as coverage_bp
# from .api.schedules import bp as api_schedules_bp
# from .api.settings import bp as api_settings_bp
# from .api.demo_data import bp as demo_data_bp
# from .routes import logs  # Assuming routes is a subpackage

# Import new schedule blueprints
# from .routes.schedule_crud import crud_bp
# from .routes.schedule_generation import generation_bp
# from .routes.schedule_versions import versions_bp
# from .routes.schedule_export import export_bp
# from .routes.schedule_validation import validation_bp

# Re-add Logger and CustomFormatter import
from .utils.logger import (
    Logger,
    CustomFormatter,
) 

# Add the parent directory to Python path
# (Keep this for potential direct script execution, though relative imports are preferred)
# noqa: E42 - Necessary for factory pattern / conditional imports
current_dir = Path(__file__).resolve().parent.parent.parent
if str(current_dir) not in sys.path:
    sys.path.append(str(current_dir))

# Import diagnostic tools
try:
    # Assuming tools is a subpackage or needs explicit path
    from .tools.debug.flask_diagnostic import (
        register_commands as register_diagnostic_commands,
    )
    # noqa: E402
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


def create_app(config_class=Config, testing=False):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Configure for testing if needed
    if testing:
        app.config["TESTING"] = True
        app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        app.config["WTF_CSRF_ENABLED"] = False

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

    # Import and initialize extensions *inside* create_app
    from .models import db # Import db here
    db.init_app(app)
    # Point to the desired migrations directory: src/migrations
    # Note: This path is relative to the project root where flask commands
    # are run
    migrations_dir = os.path.join("src", "migrations")
    _migrate = Migrate(app, db, directory=migrations_dir)  # noqa: F841

    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Create database tables - Re-commented after initial creation
    # with app.app_context():
    #     db.create_all()
    #     app.logger.info("Database tables created")

    # Setup logging
    setup_logging(app)

    # Import and Register blueprints *after* db.init_app()
    from .routes.shifts import shifts
    from .routes.settings import settings
    from .routes.employees import employees
    from .routes.availability import availability
    from .routes.absences import bp as absences_bp
    from .api.coverage import bp as coverage_bp
    from .api.schedules import bp as api_schedules_bp
    from .api.settings import bp as api_settings_bp
    from .api.demo_data import bp as demo_data_bp
    from .routes import logs  # Assuming routes is a subpackage
    from .api.employee_absences import bp as employee_absences_bp

    # New schedule blueprints
    from .routes.schedule_crud import crud_bp
    from .routes.schedule_generation import generation_bp
    from .routes.schedule_versions import versions_bp
    from .routes.schedule_export import export_bp
    from .routes.schedule_validation import validation_bp

    # Register blueprints
    app.register_blueprint(shifts, url_prefix="/api")
    app.register_blueprint(settings, url_prefix="/api")
    # app.register_blueprint(schedules, url_prefix="/api") # Old registration removed
    app.register_blueprint(employees, url_prefix="/api")
    app.register_blueprint(availability, url_prefix="/api")
    app.register_blueprint(absences_bp, url_prefix="/api")
    app.register_blueprint(coverage_bp)
    app.register_blueprint(
        api_settings_bp, name="api_settings"
    )  # Register API settings blueprint
    app.register_blueprint(demo_data_bp, url_prefix="/api/demo-data")
    app.register_blueprint(logs.bp, url_prefix="/api/logs")
    app.register_blueprint(
        api_schedules_bp, name="api_schedules"
    )  # Register with unique name
    app.register_blueprint(employee_absences_bp)

    # Register new schedule blueprints
    # Note: They already have the /api/schedules prefix defined in their files
    app.register_blueprint(crud_bp)
    app.register_blueprint(generation_bp)
    app.register_blueprint(versions_bp)
    app.register_blueprint(export_bp)
    app.register_blueprint(validation_bp)

    # Register CLI commands
    try:
        from .test_scheduler import register_commands

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

    @app.errorhandler(Exception)
    def handle_error(error):
        # Use configured logger if available
        logger = app.config.get("logger")
        if logger:
            logger.error_logger.error(
                f"Unhandled exception: {str(error)}\n"
                f"{traceback.format_exc()}"
            )
        else:  # Fallback to app logger # Added space before comment
            app.logger.error(
                f"Unhandled exception (fallback logger): {str(error)}\n"
                f"{traceback.format_exc()}"
            )
        return (
            jsonify(
                {
                    "error": str(error),
                    "message": "An unexpected error occurred. "
                               "Please try again later.",
                }
            ),
            500,
        )

    # Add diagnostic command
    @app.cli.command("run-diagnostic")
    @click.option("--start-date", type=str, 
                  help="Start date (YYYY-MM-DD)")
    @click.option("--end-date", type=str, 
                  help="End date (YYYY-MM-DD)")
    @click.option(
        "--days", type=int, default=7, 
        help="Number of days if no dates provided"
    )
    def run_diagnostic(start_date=None, end_date=None, days=7):
        """Run the schedule generator diagnostic"""
        # Import models only when command runs
        from .models import Employee, ShiftTemplate, Coverage, Settings
        from .services.scheduler import ScheduleGenerator

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
            settings_obj = Settings.query.first()

            app.logger.info(f"Total employees: {employee_count}")
            app.logger.info(f"Active employees: {active_employees}")
            app.logger.info(f"Keyholders: {keyholders}")
            app.logger.info(f"Shift templates: {shift_count}")
            app.logger.info(f"Coverage requirements: {coverage_count}")
            app.logger.info(f"Settings found: {bool(settings_obj)}")

            if employee_count == 0:
                app.logger.warning("No employees found in database")
            if shift_count == 0:
                app.logger.warning("No shift templates found in database")
            if coverage_count == 0:
                app.logger.warning(
                    "No coverage requirements found in database"
                )
            if not settings_obj:
                app.logger.warning("No settings found in the database!")

            # Generate schedule
            app.logger.info("Generating schedule")
            generator = ScheduleGenerator(logger=app.logger)
            result = generator.generate(  # noqa: F841
                start_date=start_date,
                end_date=end_date,
                version=1,
                session_id=session_id,
            )
            app.logger.info("Schedule generation completed")

            print("\n" + "=" * 80)
            print(
                f"Diagnostic completed successfully. Session ID: {session_id}"
            )
            print("=" * 80 + "\n")

        except Exception as e:
            app.logger.error(f"Diagnostic failed: {str(e)}")
            app.logger.error(traceback.format_exc())
            print("\n" + "=" * 80)
            print(f"Diagnostic failed. Session ID: {session_id}")
            print(f"Error: {str(e)}")
            print("=" * 80 + "\n")

    return app


if __name__ == "__main__":
    # This part might need adjustment if run directly
    # For direct execution, imports might need to be absolute again
    app = create_app()
    app.run(debug=True)
