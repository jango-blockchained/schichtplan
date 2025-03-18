"""Logging utilities for the scheduler."""

import logging
import os
import uuid
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional


class LoggingManager:
    """
    Manages logging for the scheduler, providing both console and file-based logging.
    """

    def __init__(self, app_name="scheduler"):
        self.app_name = app_name
        self.logger = logging.getLogger(app_name)
        self.session_id = str(uuid.uuid4())[:8]  # Create a unique session ID
        self.log_path = None

    def setup_logging(
        self, log_level=logging.INFO, log_to_file=True, log_dir=None
    ) -> str:
        """
        Set up logging with the specified configuration
        Returns the path to the log file
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

        return log_file_path

    def _setup_file_logging(self, log_dir=None, log_level=logging.INFO) -> str:
        """Set up file-based logging to capture detailed diagnostic information"""
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

    def log_debug(self, message):
        """Log a debug message"""
        self.logger.debug(message)

    def log_info(self, message):
        """Log an info message"""
        self.logger.info(message)

    def log_warning(self, message):
        """Log a warning message"""
        self.logger.warning(message)

    def log_error(self, message):
        """Log an error message"""
        self.logger.error(message)

    def get_logger(self):
        """Get the configured logger"""
        return self.logger

    def get_log_path(self) -> Optional[str]:
        """Get the current log file path"""
        return self.log_path
