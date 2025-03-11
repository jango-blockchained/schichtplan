import logging
from logging.handlers import RotatingFileHandler
import json
from pathlib import Path

# Get the root directory (two levels up from this file)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent


class CustomFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        # Add default values for custom fields
        if not hasattr(record, "user"):
            setattr(record, "user", "anonymous")
        if not hasattr(record, "page"):
            setattr(record, "page", "unknown")
        if not hasattr(record, "action"):
            setattr(record, "action", "unknown")

        # Escape any special characters in the message
        record.message = (
            record.getMessage()
            .replace('"', '\\"')
            .replace("\n", " ")
            .replace("\r", " ")
        )

        # Convert any extra attributes to a string
        extra_data = getattr(record, "extra_data", "{}")
        if not isinstance(extra_data, str):
            try:
                extra_data = json.dumps(extra_data)
            except Exception:
                extra_data = "{}"
        setattr(record, "extra_data", extra_data)

        # Create the log entry as a dictionary first
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "message": record.message,
            "user": getattr(record, "user", "anonymous"),
            "page": getattr(record, "page", "unknown"),
            "action": getattr(record, "action", "unknown"),
            "extra": extra_data,
        }

        # Convert to JSON string
        return json.dumps(log_entry)


class Logger:
    def __init__(self):
        # Create logs directory in the src folder if it doesn't exist
        self.logs_dir = ROOT_DIR / "src" / "logs"
        self.logs_dir.mkdir(exist_ok=True)

        # Create a sessions directory for session-specific logs
        self.sessions_dir = self.logs_dir / "sessions"
        self.sessions_dir.mkdir(exist_ok=True)

        # Set up formatters
        formatter = CustomFormatter()

        # User actions logger
        self.user_logger = logging.getLogger("user_actions")
        self.user_logger.setLevel(logging.INFO)
        self.user_logger.propagate = False  # Prevent propagation to root logger
        user_handler = RotatingFileHandler(
            self.logs_dir / "user_actions.log",
            maxBytes=10485760,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        user_handler.setFormatter(formatter)
        # Remove existing handlers if any
        self.user_logger.handlers = []
        self.user_logger.addHandler(user_handler)

        # Error logger
        self.error_logger = logging.getLogger("errors")
        self.error_logger.setLevel(logging.DEBUG)
        self.error_logger.propagate = False
        error_handler = RotatingFileHandler(
            self.logs_dir / "errors.log",
            maxBytes=10485760,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        error_handler.setFormatter(formatter)
        # Remove existing handlers if any
        self.error_logger.handlers = []
        self.error_logger.addHandler(error_handler)

        # Schedule logger
        self.schedule_logger = logging.getLogger("schedule")
        self.schedule_logger.setLevel(logging.DEBUG)
        self.schedule_logger.propagate = False
        schedule_handler = RotatingFileHandler(
            self.logs_dir / "schedule.log",
            maxBytes=10485760,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        schedule_handler.setFormatter(formatter)
        # Remove existing handlers if any
        self.schedule_logger.handlers = []
        self.schedule_logger.addHandler(schedule_handler)

        # App logger for general application logs
        self.app_logger = logging.getLogger("app")
        self.app_logger.setLevel(logging.DEBUG)
        self.app_logger.propagate = False
        app_handler = RotatingFileHandler(
            self.logs_dir / "app.log",
            maxBytes=10485760,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        app_handler.setFormatter(formatter)
        # Remove existing handlers if any
        self.app_logger.handlers = []
        self.app_logger.addHandler(app_handler)

    def create_session_logger(self, session_id: str) -> logging.Logger:
        """Create a new logger for a specific session"""
        session_logger = logging.getLogger(f"session_{session_id}")
        session_logger.setLevel(logging.DEBUG)
        session_logger.propagate = False

        # Create a file handler for this session
        session_file = self.sessions_dir / f"{session_id}.log"
        handler = RotatingFileHandler(
            session_file,
            maxBytes=10485760,  # 10MB
            backupCount=2,
            encoding="utf-8",
        )
        handler.setFormatter(CustomFormatter())
        # Remove existing handlers if any
        session_logger.handlers = []
        session_logger.addHandler(handler)

        return session_logger


# Create a global logger instance
logger = Logger()
