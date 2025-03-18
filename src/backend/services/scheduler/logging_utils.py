"""Logging utilities for the scheduler."""

import logging
import os
import uuid
import json
import traceback
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional, Dict, Any


class LoggingManager:
    """
    Enhanced logging manager for the scheduler, providing both console and file-based logging.

    Features:
    - Detailed process tracking with step information
    - Performance tracking
    - Integration with application-level logging
    - Structured logging with contextual information
    """

    def __init__(self, app_name="scheduler"):
        self.app_name = app_name
        self.logger = logging.getLogger(app_name)
        self.session_id = str(uuid.uuid4())[:8]  # Create a unique session ID
        self.log_path = None
        self.app_log_path = None
        self.diagnostic_log_path = None
        self.current_step = None
        self.step_count = 0
        self.steps_completed = []
        self.step_start_time = None
        self.generation_start_time = None

    def setup_logging(
        self, log_level=logging.INFO, log_to_file=True, log_dir=None, app_log_dir=None
    ) -> str:
        """
        Set up logging with the specified configuration

        Args:
            log_level: The logging level to use
            log_to_file: Whether to log to a file
            log_dir: Optional directory for scheduler-specific logs
            app_log_dir: Directory for application logs integration

        Returns:
            The path to the main log file
        """
        # Configure logger
        self.logger.setLevel(log_level)

        # Clear any existing handlers
        if self.logger.hasHandlers():
            self.logger.handlers.clear()

        # Add console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_format = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
        console_handler.setFormatter(console_format)
        self.logger.addHandler(console_handler)

        # Add file handler if requested
        log_file_path = None
        if log_to_file:
            log_file_path = self._setup_file_logging(log_dir, log_level)

            # Set up application log integration if directory is provided
            if app_log_dir:
                self._setup_app_logging(app_log_dir, log_level)

            # Set up diagnostic logging in standard location
            self._setup_diagnostic_logging(log_level)

        return log_file_path

    def _setup_file_logging(self, log_dir=None, log_level=logging.INFO) -> str:
        """Set up detailed file-based logging to capture diagnostic information"""
        try:
            # Create log directory if not specified
            if log_dir is None:
                # Create in user's home directory
                home_dir = str(Path.home())
                log_dir = os.path.join(home_dir, ".schichtplan", "logs")

            # Ensure directory exists
            os.makedirs(log_dir, exist_ok=True)

            # Create a unique log file for this session
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_filename = f"{self.app_name}_{timestamp}_{self.session_id}.log"
            log_file_path = os.path.join(log_dir, log_filename)

            # Set up rotating file handler (10 MB max size, keep 3 backups)
            file_handler = RotatingFileHandler(
                log_file_path, maxBytes=10 * 1024 * 1024, backupCount=3
            )
            file_handler.setLevel(log_level)

            # Create formatter with more details for file logging
            file_format = logging.Formatter(
                "%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s"
            )
            file_handler.setFormatter(file_format)

            # Add the handler to logger
            self.logger.addHandler(file_handler)
            self.log_path = log_file_path

            self.logger.info(f"Logging to file: {log_file_path}")
            return log_file_path

        except Exception as e:
            self.logger.error(f"Failed to set up file logging: {str(e)}")
            return None

    def _setup_app_logging(self, app_log_dir=None, log_level=logging.INFO) -> str:
        """Set up integration with the application's main logging system"""
        try:
            # Use src/logs as default app log directory
            if app_log_dir is None:
                # Try to find the src/logs directory
                current_dir = Path.cwd()
                src_dir = current_dir

                # Look for src directory
                while src_dir.name != "src" and src_dir.parent != src_dir:
                    src_dir = src_dir.parent

                if src_dir.name == "src":
                    app_log_dir = os.path.join(src_dir, "logs")
                else:
                    # Fallback to the current directory with logs subdirectory
                    app_log_dir = os.path.join(current_dir, "logs")

            # Ensure directory exists
            os.makedirs(app_log_dir, exist_ok=True)

            # Create a handler for the application's schedule log
            app_log_path = os.path.join(app_log_dir, "schedule.log")
            app_handler = RotatingFileHandler(
                app_log_path, maxBytes=10 * 1024 * 1024, backupCount=3
            )
            app_handler.setLevel(log_level)

            # Create formatter compatible with the application's logging format
            app_format = logging.Formatter(
                '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "module": "scheduler", '
                '"function": "%(funcName)s", "line": %(lineno)d, "message": "%(message)s", '
                '"user": "scheduler", "page": "backend", "action": "generate", "extra": "{}"}'
            )
            app_handler.setFormatter(app_format)

            # Add the handler to logger
            self.logger.addHandler(app_handler)
            self.app_log_path = app_log_path

            return app_log_path

        except Exception as e:
            self.logger.error(f"Failed to set up application logging: {str(e)}")
            return None

    def _setup_diagnostic_logging(self, log_level=logging.DEBUG) -> str:
        """Set up diagnostic logging in the standard application diagnostic directory"""
        try:
            # Try to find the src/logs/diagnostics directory
            current_dir = Path.cwd()
            src_dir = current_dir

            # Look for src directory
            while src_dir.name != "src" and src_dir.parent != src_dir:
                src_dir = src_dir.parent

            if src_dir.name == "src":
                diagnostic_dir = os.path.join(src_dir, "logs", "diagnostics")
            else:
                # Fallback to the current directory with logs/diagnostics subdirectory
                diagnostic_dir = os.path.join(current_dir, "logs", "diagnostics")

            # Ensure directory exists
            os.makedirs(diagnostic_dir, exist_ok=True)

            # Create a unique diagnostic log file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            diag_filename = f"schedule_diagnostic_{self.session_id}.log"
            diagnostic_path = os.path.join(diagnostic_dir, diag_filename)

            # Create a file handler for diagnostic logging
            diag_handler = logging.FileHandler(diagnostic_path)
            diag_handler.setLevel(log_level)

            # Create a simple formatter for diagnostic logs
            diag_format = logging.Formatter(
                "%(asctime)s.%(msecs)03d - %(levelname)s - %(message)s",
                "%Y-%m-%d %H:%M:%S",
            )
            diag_handler.setFormatter(diag_format)

            # Don't add to the logger - we'll use this separately for summary information
            self.diagnostic_log_path = diagnostic_path

            # Write initial diagnostic entry
            with open(diagnostic_path, "w") as f:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                f.write(
                    f"{timestamp} - INFO - ===== Diagnostic logging initialized (Session: {self.session_id}) =====\n"
                )
                f.write(
                    f"{timestamp} - DEBUG - Log file created at: {diagnostic_path}\n"
                )
                f.write(f"{timestamp} - DEBUG - Session ID: {self.session_id}\n")

            return diagnostic_path

        except Exception as e:
            self.logger.error(f"Failed to set up diagnostic logging: {str(e)}")
            return None

    def start_process(self, process_name: str) -> None:
        """Start timing a new scheduling process"""
        self.generation_start_time = datetime.now()
        self.step_count = 0
        self.steps_completed = []
        self.log_info(f"===== STARTING PROCESS: {process_name} =====")
        self.log_info(f"Process ID: {self.session_id}")

        # Write to diagnostic log
        self._write_to_diagnostic(f"Starting scheduling process: {process_name}")

    def start_step(self, step_name: str) -> None:
        """Log the start of a processing step"""
        self.step_count += 1
        self.current_step = step_name
        self.step_start_time = datetime.now()
        self.log_info(f"Step {self.step_count}: {step_name} - Started")

        # Write to diagnostic log
        self._write_to_diagnostic(f"STEP {self.step_count}: {step_name}")

    def end_step(self, results: Optional[Dict[str, Any]] = None) -> None:
        """Log the completion of a processing step with optional results"""
        if self.current_step and self.step_start_time:
            duration = datetime.now() - self.step_start_time
            self.steps_completed.append(self.current_step)

            # Format duration in milliseconds
            duration_ms = duration.total_seconds() * 1000

            # Log step completion
            self.log_info(
                f"Step {self.step_count}: {self.current_step} - Completed in {duration_ms:.1f}ms"
            )

            # Log results if provided
            if results:
                result_str = json.dumps(results, default=str)
                self.log_debug(f"Step {self.step_count} results: {result_str}")

            # Write to diagnostic log
            self._write_to_diagnostic(
                f"Completed step {self.step_count}: {self.current_step} in {duration_ms:.1f}ms"
            )

            self.current_step = None
            self.step_start_time = None

    def end_process(self, stats: Optional[Dict[str, Any]] = None) -> None:
        """Log the completion of the entire scheduling process"""
        if self.generation_start_time:
            duration = datetime.now() - self.generation_start_time
            duration_sec = duration.total_seconds()

            # Create summary information
            summary = {
                "session_id": self.session_id,
                "total_steps": self.step_count,
                "steps_completed": len(self.steps_completed),
                "duration_seconds": duration_sec,
            }

            # Add any additional stats
            if stats:
                summary.update(stats)

            # Log process completion
            self.log_info("===== PROCESS COMPLETED =====")
            self.log_info(f"Total runtime: {duration_sec:.2f} seconds")
            self.log_info(
                f"Steps completed: {len(self.steps_completed)}/{self.step_count}"
            )

            # Log summary as JSON
            summary_str = json.dumps(summary, default=str)
            self.log_info(f"Process summary: {summary_str}")

            # Write final summary to diagnostic log
            self._write_to_diagnostic(
                f"PROCESS COMPLETED - Runtime: {duration_sec:.2f}s - Steps: {len(self.steps_completed)}/{self.step_count}"
            )

            if stats:
                stats_str = json.dumps(stats, default=str, indent=2)
                self._write_to_diagnostic(f"STATS:\n{stats_str}")

    def log_step_data(self, data_name: str, data: Any) -> None:
        """Log detailed data for the current step"""
        if self.current_step:
            # Convert data to string representation based on type
            if isinstance(data, dict) or isinstance(data, list):
                data_str = json.dumps(data, default=str)
            else:
                data_str = str(data)

            # Truncate if too long
            if len(data_str) > 1000:
                data_str = data_str[:1000] + "... [truncated]"

            self.log_debug(f"[Step {self.step_count}] {data_name}: {data_str}")

    def log_debug(self, message: str) -> None:
        """Log a debug message"""
        self.logger.debug(message)

    def log_info(self, message: str) -> None:
        """Log an info message"""
        self.logger.info(message)

    def log_warning(self, message: str) -> None:
        """Log a warning message"""
        self.logger.warning(message)

    def log_error(self, message: str, exc_info=None) -> None:
        """
        Log an error message with optional exception information

        Args:
            message: The error message
            exc_info: Optional exception information. If True, includes current exception info
        """
        if exc_info:
            self.logger.error(message, exc_info=True)

            # Also add to diagnostic log
            if self.diagnostic_log_path:
                exc_type, exc_value, exc_traceback = sys.exc_info()
                if exc_type and exc_value:
                    tb_lines = traceback.format_exception(
                        exc_type, exc_value, exc_traceback
                    )
                    self._write_to_diagnostic(f"ERROR: {message}\n{''.join(tb_lines)}")
        else:
            self.logger.error(message)

            # Also add to diagnostic log
            if self.diagnostic_log_path:
                self._write_to_diagnostic(f"ERROR: {message}")

    def get_logger(self) -> logging.Logger:
        """Get the configured logger"""
        return self.logger

    def get_log_path(self) -> Optional[str]:
        """Get the main log file path"""
        return self.log_path

    def get_diagnostic_log_path(self) -> Optional[str]:
        """Get the diagnostic log file path"""
        return self.diagnostic_log_path

    def get_app_log_path(self) -> Optional[str]:
        """Get the application log file path"""
        return self.app_log_path

    def _write_to_diagnostic(self, message: str) -> None:
        """Write a message directly to the diagnostic log file"""
        if self.diagnostic_log_path:
            try:
                with open(self.diagnostic_log_path, "a") as f:
                    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                    f.write(f"{timestamp} - INFO - {message}\n")
            except Exception as e:
                # Just log to normal logger if this fails
                self.logger.error(f"Failed to write to diagnostic log: {str(e)}")
