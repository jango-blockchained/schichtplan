import logging
from logging.handlers import RotatingFileHandler
import json
from pathlib import Path
import os
import sys # Import sys for stderr
import traceback # Import traceback

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
        message = (
            record.getMessage()
            .replace('"', '\\"')
            .replace("\\n", " ")
            .replace("\\r", " ")
        )
        # Handle potential embedded JSON or complex structures safely
        try:
            # Attempt to parse if it looks like JSON, otherwise keep as string
            if message.startswith("{") and message.endswith("}"):
                parsed_message = json.loads(message)
                # Re-serialize to ensure valid JSON representation within the log message string
                record.message = json.dumps(parsed_message)
            else:
                # If not JSON-like, use the escaped string
                record.message = message
        except json.JSONDecodeError:
            # If parsing fails, use the already escaped message string
            record.message = message

        # Convert any extra attributes to a string
        extra_data = getattr(record, "extra_data", {})
        if not isinstance(extra_data, str):
            try:
                # Ensure valid JSON structure for the 'extra' field
                extra_data_str = json.dumps(extra_data)
            except Exception:
                extra_data_str = "{}"
        else:
            extra_data_str = extra_data

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
            "extra": json.loads(extra_data_str),
        }

        # Convert to JSON string for the final log output
        return json.dumps(log_entry)


# Simple formatter for diagnostic logs
diagnostic_formatter = logging.Formatter(
    "%(asctime)s.%(msecs)03d - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s",
    "%Y-%m-%d %H:%M:%S",
)


class Logger:
    def __init__(self):
        print("!!! Logger __init__ started !!!", file=sys.stderr) # DEBUG PRINT
        try:
            # Create logs directory in the project root if it doesn't exist
            self.logs_dir = ROOT_DIR / "logs"
            self.logs_dir.mkdir(exist_ok=True)
            print(f"!!! Logger attempting to use logs dir: {self.logs_dir}", file=sys.stderr) # DEBUG PRINT

            # Create a sessions directory for session-specific logs
            self.sessions_dir = self.logs_dir / "sessions"
            self.sessions_dir.mkdir(exist_ok=True)

            # Create diagnostics directory
            self.diagnostics_dir = self.logs_dir / "diagnostics"
            self.diagnostics_dir.mkdir(exist_ok=True)

            # Set up formatters
            formatter = CustomFormatter()

            # User actions logger
            print("!!! Setting up user_logger...", file=sys.stderr) # DEBUG PRINT
            self.user_logger = logging.getLogger("user_actions")
            self.user_logger.setLevel(logging.INFO)
            self.user_logger.propagate = False
            user_handler = RotatingFileHandler(
                self.logs_dir / "user_actions.log",
                maxBytes=1048576,  # 1MB
                backupCount=3,
                encoding="utf-8",
            )
            user_handler.setFormatter(formatter)
            # Remove existing handlers if any to prevent duplication on re-init
            if self.user_logger.hasHandlers():
                self.user_logger.handlers.clear()
            self.user_logger.addHandler(user_handler)
            print("!!! user_logger setup done.", file=sys.stderr) # DEBUG PRINT

            # Error logger
            print("!!! Setting up error_logger...", file=sys.stderr) # DEBUG PRINT
            self.error_logger = logging.getLogger("errors")
            self.error_logger.setLevel(logging.DEBUG)
            self.error_logger.propagate = False
            error_handler = RotatingFileHandler(
                self.logs_dir / "errors.log",
                maxBytes=1048576,  # 1MB
                backupCount=3,
                encoding="utf-8",
            )
            error_handler.setFormatter(formatter)
            # Remove existing handlers if any
            if self.error_logger.hasHandlers():
                self.error_logger.handlers.clear()
            self.error_logger.addHandler(error_handler)
            print("!!! error_logger setup done.", file=sys.stderr) # DEBUG PRINT

            # Schedule logger
            print("!!! Setting up schedule_logger...", file=sys.stderr) # DEBUG PRINT
            self.schedule_logger = logging.getLogger("schedule")
            self.schedule_logger.setLevel(logging.DEBUG)
            self.schedule_logger.propagate = False
            schedule_handler = RotatingFileHandler(
                self.logs_dir / "schedule.log",
                maxBytes=1048576,  # 1MB
                backupCount=3,
                encoding="utf-8",
            )
            schedule_handler.setFormatter(formatter)
            # Remove existing handlers if any
            if self.schedule_logger.hasHandlers():
                self.schedule_logger.handlers.clear()
            self.schedule_logger.addHandler(schedule_handler)
            print("!!! schedule_logger setup done.", file=sys.stderr) # DEBUG PRINT

            # App logger for general application logs
            print("!!! Setting up app_logger...", file=sys.stderr) # DEBUG PRINT
            self.app_logger = logging.getLogger("app")
            self.app_logger.setLevel(logging.DEBUG)
            self.app_logger.propagate = False
            app_handler = RotatingFileHandler(
                self.logs_dir / "app.log",
                maxBytes=1048576,  # 1MB
                backupCount=3,
                encoding="utf-8",
            )
            app_handler.setFormatter(formatter)
            # Remove existing handlers if any
            if self.app_logger.hasHandlers():
                self.app_logger.handlers.clear()
            self.app_logger.addHandler(app_handler)
            print("!!! app_logger setup done.", file=sys.stderr) # DEBUG PRINT

            # --- Add Console Handler for General Debugging ---
            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.INFO)
            console_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            console_handler.setFormatter(console_formatter)

            # Add console handler to relevant loggers if needed (optional)
            # self.app_logger.addHandler(console_handler)
            # self.schedule_logger.addHandler(console_handler)
            # self.error_logger.addHandler(console_handler)

            print("!!! Logger __init__ finished successfully !!!", file=sys.stderr) # DEBUG PRINT

        except Exception as e:
            print(f"!!! FATAL ERROR during Logger __init__: {e}", file=sys.stderr) # DEBUG PRINT
            traceback.print_exc(file=sys.stderr) # DEBUG PRINT
            raise # Re-raise

    def create_session_logger(self, session_id: str) -> logging.Logger:
        """Create a new logger for a specific session"""
        logger_name = f"session_{session_id}"
        session_logger = logging.getLogger(logger_name)
        session_logger.setLevel(logging.DEBUG)
        session_logger.propagate = False

        # Avoid adding handlers multiple times if called again for the same session_id
        if not session_logger.hasHandlers():
            # Create a file handler for this session
            session_file = self.sessions_dir / f"{session_id}.log"
            handler = RotatingFileHandler(
                session_file,
                maxBytes=1048576,  # 1MB
                backupCount=2,
                encoding="utf-8",
            )
            handler.setFormatter(CustomFormatter())
            session_logger.addHandler(handler)

        return session_logger

    def create_diagnostic_logger(self, session_id: str, log_level=logging.DEBUG) -> logging.Logger:
        """Create a new logger for diagnostic details of a specific session"""
        logger_name = f"diagnostic_{session_id}"
        diag_logger = logging.getLogger(logger_name)
        diag_logger.setLevel(log_level)
        diag_logger.propagate = False

        # Avoid adding handlers multiple times
        if not diag_logger.hasHandlers():
            # Ensure directory exists (though done in __init__, good practice here too)
            self.diagnostics_dir.mkdir(exist_ok=True)

            # Create a file handler for this diagnostic session
            diag_filename = f"schedule_diagnostic_{session_id}.log"
            diag_file_path = self.diagnostics_dir / diag_filename

            # Use FileHandler, not Rotating, for diagnostics unless rotation is desired
            handler = logging.FileHandler(diag_file_path, encoding="utf-8")
            handler.setLevel(log_level)
            handler.setFormatter(diagnostic_formatter)
            diag_logger.addHandler(handler)

            # Add console output for diagnostics too? Optional.
            # console_handler = logging.StreamHandler()
            # console_handler.setLevel(log_level)
            # console_handler.setFormatter(diagnostic_formatter)
            # diag_logger.addHandler(console_handler)

            # Log initialization message
            diag_logger.info(f"===== Diagnostic logging initialized (Session: {session_id}) =====")
            diag_logger.debug(f"Log file created at: {diag_file_path}")
            diag_logger.debug(f"Session ID: {session_id}")

        return diag_logger

    def get_diagnostic_log_path(self, session_id: str) -> str:
        """Get the path for a specific diagnostic log file"""
        diag_filename = f"schedule_diagnostic_{session_id}.log"
        return str(self.diagnostics_dir / diag_filename)


# Create a global logger instance
print("!!! About to create global Logger instance !!!", file=sys.stderr) # DEBUG PRINT
logger = Logger()
print("!!! Global Logger instance created !!!", file=sys.stderr) # DEBUG PRINT
