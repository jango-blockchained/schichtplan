import logging
from logging.handlers import RotatingFileHandler
import json
from pathlib import Path

# Get the root directory (two levels up from this file)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent


class CustomFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        # Add default values for custom fields
        if not hasattr(record, "user"):
            setattr(record, "user", "anonymous")
        if not hasattr(record, "page"):
            setattr(record, "page", "unknown")
        if not hasattr(record, "action"):
            setattr(record, "action", "unknown")

        # Convert any extra attributes to a string
        extra_data = getattr(record, "extra_data", "{}")
        if not isinstance(extra_data, str):
            setattr(record, "extra_data", json.dumps(extra_data))

        return super().format(record)


class Logger:
    def __init__(self):
        # Create logs directory in the root folder if it doesn't exist
        self.logs_dir = ROOT_DIR / "logs"
        self.logs_dir.mkdir(exist_ok=True)

        # Set up formatters
        formatter = CustomFormatter(
            '{"timestamp":"%(asctime)s","level":"%(levelname)s","module":"%(module)s",'
            '"function":"%(funcName)s","line":%(lineno)d,"message":"%(message)s",'
            '"user":"%(user)s","page":"%(page)s","action":"%(action)s","extra":%(extra_data)s}'
        )

        # User actions logger
        self.user_logger = logging.getLogger("user_actions")
        self.user_logger.setLevel(logging.INFO)
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
        error_handler = RotatingFileHandler(
            self.logs_dir / "errors.log",
            maxBytes=10485760,  # 10MB
            backupCount=5,
        )
        error_handler.setFormatter(formatter)
        self.error_logger.addHandler(error_handler)

        # Schedule logger
        self.schedule_logger = logging.getLogger("schedule")
        self.schedule_logger.setLevel(logging.INFO)
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
        app_handler = RotatingFileHandler(
            self.logs_dir / "app.log",
            maxBytes=10485760,  # 10MB
            backupCount=5,
        )
        app_handler.setFormatter(formatter)
        self.app_logger.addHandler(app_handler)


logger = Logger()
