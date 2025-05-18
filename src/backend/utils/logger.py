import logging
from logging.handlers import RotatingFileHandler
import json
from pathlib import Path
import os
import sys # Import sys for stderr
import traceback # Import traceback
from datetime import datetime

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
    # Default status mapping for different log levels
    _default_status = {
        logging.DEBUG: "Debug",
        logging.INFO: "Info",
        logging.WARNING: "Warning",
        logging.ERROR: "Error",
        logging.CRITICAL: "Critical",
    }
    
    def __init__(self):
        self.initialized = False  # Add initialized flag
        self.console_handler = None  # Initialize handler attributes
        self.file_handler = None
        self.logger_name = "app"  # Default logger name
        
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
            self.console_handler = logging.StreamHandler()
            self.console_handler.setLevel(logging.DEBUG)  # Change from INFO to DEBUG
            console_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            self.console_handler.setFormatter(console_formatter)

            # Add console handler to relevant loggers
            self.app_logger.addHandler(self.console_handler)
            self.schedule_logger.addHandler(self.console_handler)
            self.error_logger.addHandler(self.console_handler)
            
            # Save reference to file handler for use in log_message
            self.file_handler = app_handler
            
            # Mark as initialized
            self.initialized = True
            
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

    def debug(self, message, event_type=None, details=None, status=None):
        self.log_message(logging.DEBUG, message, event_type, details, status)

    def warning(self, message, event_type=None, details=None, status=None, exc_info=None, stack_info=False, extra=None):
        # Flask's logger.warning can pass exc_info, stack_info, and extra.
        # We'll pass them to log_message if it's adapted, or handle them here.
        # For now, keeping it simple and aligned with other custom methods.
        # The standard logging.warning uses logging.WARNING (level 30)
        self.log_message(logging.WARNING, message, event_type, details, status, exc_info=exc_info, stack_info=stack_info)

    def error(self, message, event_type=None, details=None, status="Error", exc_info=None, stack_info=False):
        self.log_message(logging.ERROR, message, event_type, details, status, exc_info=exc_info, stack_info=stack_info)

    # Helper method to format time like logging.Formatter does
    def formatTime(self, datefmt=None):
        """Format current time similar to logging.Formatter.formatTime"""
        now = datetime.now()
        if datefmt:
            return now.strftime(datefmt)
        else:
            return now.strftime("%Y-%m-%d %H:%M:%S")

    def log_message(
        self,
        level,
        message,
        event_type=None,
        details=None,
        status=None,
        exc_info=None,
        stack_info=None,
    ):
        if not self.initialized:
            print("Logger not initialized, skipping log message.")
            return
            
        # Construct a log entry dictionary
        log_entry = {
            "timestamp": self.formatTime("%Y-%m-%d %H:%M:%S"),
            "level": logging.getLevelName(level),
            "module": "unknown",  # These would come from an actual LogRecord
            "function": "unknown",
            "line": 0,
            "message": str(message),
            "user": "anonymous",
            "page": "unknown",
            "action": "unknown",
        }
        
        # Use provided status or get default for this level
        log_entry["status"] = status if status else self._default_status.get(level, "")

        try:
            # Ensure details are JSON serializable if they are complex objects
            if details is not None and not isinstance(details, (str, int, float, bool, list, dict, type(None))):
                try:
                    details = json.dumps(details, default=str)
                except (TypeError, OverflowError):
                    details = str(details) # Fallback to string representation

            log_entry["details"] = details
            
            # Construct the full log message string
            full_message = f"{message}"
            if event_type:
                full_message += f" (Event: {event_type})"
            if details:
                # Avoid duplicating details if they are already part of the main message for text logger
                pass # Details are primarily for JSON output
            if status:
                full_message += f" (Status: {status})"

            # Log to console handler (text output)
            if self.console_handler:
                # Create a temporary LogRecord for the console handler to format
                record = logging.LogRecord(
                    name=self.logger_name,
                    level=level,
                    pathname="",
                    lineno=0,
                    msg=full_message, # Use the constructed full_message
                    args=(),
                    exc_info=exc_info, # Pass exc_info
                    func="",
                )
                # Assign stack_info - it must be a string or None, not bool
                if stack_info:
                    record.stack_info = ''.join(traceback.format_stack())
                else:
                    record.stack_info = None
                
                # Add other fields from log_entry if formatter expects them
                for key, value in log_entry.items():
                    if not hasattr(record, key):
                        setattr(record, key, value)
                
                self.console_handler.handle(record)

            # Log to file handler (JSON output)
            if self.file_handler:
                # Create a temporary LogRecord for the file handler
                record = logging.LogRecord(
                    name=self.logger_name,
                    level=level,
                    pathname="",
                    lineno=0,
                    msg=str(log_entry),  # Pass the whole dict for JSON
                    args=(),
                    exc_info=exc_info, # Pass exc_info
                    func="",
                )
                # Assign stack_info - it must be a string or None, not bool
                if stack_info:
                    record.stack_info = ''.join(traceback.format_stack())
                else:
                    record.stack_info = None
                    
                self.file_handler.handle(record)

        except Exception as e:
            print(f"Error during logging: {e}")
            traceback.print_exc()


# Create a global logger instance
print("!!! About to create global Logger instance !!!", file=sys.stderr) # DEBUG PRINT
logger = Logger()
print("!!! Global Logger instance created !!!", file=sys.stderr) # DEBUG PRINT
