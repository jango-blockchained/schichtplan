# Desktop Configuration
# This file contains electron-specific configuration for the desktop app

import os
import sys
from pathlib import Path

# Desktop app paths
if getattr(sys, "frozen", False):
    # Running in PyInstaller bundle
    BASE_PATH = Path(sys._MEIPASS)
    APP_PATH = Path(sys.executable).parent
else:
    # Running in development
    BASE_PATH = Path(__file__).parent.parent
    APP_PATH = BASE_PATH

# Desktop-specific settings
DESKTOP_CONFIG = {
    "database_path": APP_PATH / "database",
    "logs_path": APP_PATH / "logs",
    "temp_path": APP_PATH / "temp",
    "exports_path": APP_PATH / "exports",
    "backups_path": APP_PATH / "backups",
}

# Environment variables for desktop
DESKTOP_ENV = {
    "FLASK_ENV": "desktop",
    "DATABASE_PATH": str(DESKTOP_CONFIG["database_path"]),
    "LOGS_PATH": str(DESKTOP_CONFIG["logs_path"]),
    "TEMP_PATH": str(DESKTOP_CONFIG["temp_path"]),
    "EXPORTS_PATH": str(DESKTOP_CONFIG["exports_path"]),
    "BACKUPS_PATH": str(DESKTOP_CONFIG["backups_path"]),
}


def setup_desktop_environment():
    """Set up the desktop environment with necessary directories and settings."""

    # Create all necessary directories
    for path in DESKTOP_CONFIG.values():
        path.mkdir(parents=True, exist_ok=True)

    # Set environment variables
    for key, value in DESKTOP_ENV.items():
        os.environ.setdefault(key, value)

    # Set database URL
    database_file = DESKTOP_CONFIG["database_path"] / "schichtplan.db"
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{database_file}")

    return DESKTOP_CONFIG


def get_desktop_config():
    """Get the desktop configuration dictionary."""
    return DESKTOP_CONFIG.copy()


def is_desktop_mode():
    """Check if the app is running in desktop mode."""
    return os.environ.get("FLASK_ENV") == "desktop"
