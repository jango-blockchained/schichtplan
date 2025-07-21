#!/usr/bin/env python3
"""
Desktop version of the Flask backend server.
This version is optimized for desktop deployment with Electron.
"""

import logging
import os
import sys
from pathlib import Path

# Set up paths for desktop deployment
if getattr(sys, "frozen", False):
    # Running in PyInstaller bundle
    base_path = Path(sys._MEIPASS)
    app_path = Path(sys.executable).parent
else:
    # Running in development
    base_path = Path(__file__).parent.parent
    app_path = base_path

# Configure environment for desktop
os.environ.setdefault("FLASK_ENV", "desktop")
os.environ.setdefault("DATABASE_PATH", str(app_path / "database"))

# Add base path to Python path
sys.path.insert(0, str(base_path))

# Configure logging for desktop
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(app_path / "logs" / "desktop.log"),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger(__name__)


def configure_desktop_environment():
    """Configure the environment for desktop deployment."""
    # Create necessary directories
    database_dir = Path(os.environ.get("DATABASE_PATH", app_path / "database"))
    logs_dir = app_path / "logs"

    database_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    # Set database URL for desktop
    database_file = database_dir / "schichtplan.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{database_file}"

    logger.info("Desktop environment configured:")
    logger.info(f"  Database: {database_file}")
    logger.info(f"  Logs: {logs_dir}")

    return database_file, logs_dir


def create_desktop_app():
    """Create Flask app configured for desktop deployment."""
    # Configure environment
    database_file, logs_dir = configure_desktop_environment()

    # Import and create app
    try:
        from src.backend.app import create_app
        from src.backend.config import Config

        # Desktop-specific configuration
        class DesktopConfig(Config):
            DEBUG = False
            TESTING = False
            SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
            SQLALCHEMY_TRACK_MODIFICATIONS = False
            SECRET_KEY = os.environ.get(
                "SECRET_KEY", "desktop-secret-key-change-in-production"
            )

        app = create_app(DesktopConfig)

        # Initialize database if needed
        with app.app_context():
            from src.backend.models import db

            db.create_all()

            # Create default settings if they don't exist
            try:
                from src.backend.models.settings import Settings

                Settings.get_or_create_default()
            except Exception as e:
                logger.warning(f"Could not create default settings: {e}")

        logger.info("Desktop app created successfully")
        return app

    except Exception as e:
        logger.error(f"Failed to create desktop app: {e}")
        raise


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Schichtplan Desktop Backend Server")
    parser.add_argument("command", choices=["runserver"], help="Command to run")
    parser.add_argument("--port", type=int, default=5000, help="Port to run on")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")

    args = parser.parse_args()

    if args.command == "runserver":
        try:
            app = create_desktop_app()

            logger.info(f"Starting desktop server on {args.host}:{args.port}")

            # Run the server
            app.run(
                host=args.host,
                port=args.port,
                debug=args.debug,
                use_reloader=False,  # Disable reloader for desktop
                threaded=True,
            )

        except Exception as e:
            logger.error(f"Server error: {e}")
            sys.exit(1)
    else:
        logger.error(f"Unknown command: {args.command}")
        sys.exit(1)
