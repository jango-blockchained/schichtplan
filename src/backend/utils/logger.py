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

        # Convert the entire entry to JSON
        try:
            return json.dumps(log_entry)
        except Exception as e:
            # If JSON conversion fails, return a simplified error log
            return json.dumps(
                {
                    "timestamp": self.formatTime(record, self.datefmt),
                    "level": "ERROR",
                    "module": "logger",
                    "function": "format",
                    "line": 0,
                    "message": f"Failed to format log entry: {str(e)}",
                    "user": "anonymous",
                    "page": "unknown",
                    "action": "log_format_error",
                    "extra": "{}",
                }
            )


class Logger:
    def __init__(self):
        # Create logs directory in the root folder if it doesn't exist
        self.logs_dir = ROOT_DIR / "logs"
        self.logs_dir.mkdir(exist_ok=True)

        # Create a sessions directory for session-specific logs
        self.sessions_dir = self.logs_dir / "sessions"
        self.sessions_dir.mkdir(exist_ok=True)

        # Set up formatters
        formatter = CustomFormatter(
            '{"timestamp":"%(asctime)s","level":"%(levelname)s","module":"%(module)s",'
            '"function":"%(funcName)s","line":%(lineno)d,"message":"%(message)s",'
            '"user":"%(user)s","page":"%(page)s","action":"%(action)s","extra":%(extra_data)s}'
        )

        # User actions logger
        self.user_logger = logging.getLogger("user_actions")
        self.user_logger.setLevel(logging.INFO)
        self.user_logger.propagate = False  # Prevent propagation to root logger
        user_handler = RotatingFileHandler(
            self.logs_dir / "user_actions.log",
            maxBytes=10485760,  # 10MB
            backupCount=5,
        )
        user_handler.setFormatter(formatter)
        self.user_logger.addHandler(user_handler)

        # Error logger
        self.error_logger = logging.getLogger("errors")
        self.error_logger.setLevel(logging.ERROR)
        self.error_logger.propagate = False  # Prevent propagation to root logger
        error_handler = RotatingFileHandler(
            self.logs_dir / "errors.log",
            maxBytes=10485760,  # 10MB
            backupCount=5,
        )
        error_handler.setFormatter(formatter)
        self.error_logger.addHandler(error_handler)

        # Schedule logger
        self.schedule_logger = logging.getLogger("schedule")
        self.schedule_logger.setLevel(logging.DEBUG)
        self.schedule_logger.propagate = False  # Prevent propagation to root logger
        schedule_handler = RotatingFileHandler(
            self.logs_dir / "schedule.log",
            maxBytes=10485760,  # 10MB
            backupCount=5,
        )
        schedule_handler.setFormatter(formatter)
        self.schedule_logger.addHandler(schedule_handler)

        # App logger
        self.app_logger = logging.getLogger("app")
        self.app_logger.setLevel(logging.INFO)
        self.app_logger.propagate = False  # Prevent propagation to root logger
        app_handler = RotatingFileHandler(
            self.logs_dir / "app.log",
            maxBytes=10485760,  # 10MB
            backupCount=5,
        )
        app_handler.setFormatter(formatter)
        self.app_logger.addHandler(app_handler)

    def create_session_logger(self, session_id):
        """Create a logger for a specific schedule generation session"""
        session_logger = logging.getLogger(f"session_{session_id}")
        session_logger.setLevel(logging.DEBUG)
        session_logger.propagate = False

        # Create a formatter that includes the session ID
        formatter = CustomFormatter(
            '{"timestamp":"%(asctime)s","level":"%(levelname)s","module":"%(module)s",'
            '"function":"%(funcName)s","line":%(lineno)d,"message":"%(message)s",'
            '"session_id":"' + session_id + '","extra":%(extra_data)s}'
        )

        # Create a file handler for this session
        session_file = self.sessions_dir / f"session_{session_id}.log"
        file_handler = logging.FileHandler(session_file)
        file_handler.setFormatter(formatter)
        session_logger.addHandler(file_handler)

        return session_logger


logger = Logger()
