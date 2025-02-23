import logging
import os
from datetime import datetime
from logging.handlers import RotatingFileHandler
from flask import request, has_request_context
import json

class CustomFormatter(logging.Formatter):
    def format(self, record):
        # Add default values for custom fields
        if not hasattr(record, 'user'):
            record.user = 'anonymous'
        if not hasattr(record, 'page'):
            record.page = 'unknown'
        if not hasattr(record, 'action'):
            record.action = 'unknown'
            
        # Convert any extra attributes to a string
        if hasattr(record, 'extra_data'):
            record.extra_data = json.dumps(record.extra_data)
        else:
            record.extra_data = '{}'
            
        return super().format(record)

class StructuredLogger:
    def __init__(self, app_name: str, log_dir: str = "logs"):
        self.app_name = app_name
        self.log_dir = log_dir
        
        # Create logs directory if it doesn't exist
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        # Create different log files for different purposes
        self.setup_loggers()
    
    def setup_loggers(self):
        # Main application logger
        self.app_logger = self._create_logger('app', 'app.log')
        
        # Schedule generation logger
        self.schedule_logger = self._create_logger('schedule', 'schedule.log')
        
        # User actions logger
        self.user_logger = self._create_logger('user', 'user_actions.log')
        
        # Error logger
        self.error_logger = self._create_logger('error', 'errors.log')
    
    def _create_logger(self, name: str, filename: str):
        logger = logging.getLogger(f"{self.app_name}.{name}")
        logger.setLevel(logging.DEBUG)
        
        # Create handlers
        file_handler = RotatingFileHandler(
            os.path.join(self.log_dir, filename),
            maxBytes=10485760,  # 10MB
            backupCount=10
        )
        file_handler.setLevel(logging.DEBUG)
        
        # Create formatters and add it to handlers
        file_format = (
            '{'
            '"timestamp":"%(asctime)s",'
            '"level":"%(levelname)s",'
            '"module":"%(module)s",'
            '"function":"%(funcName)s",'
            '"line":%(lineno)d,'
            '"message":"%(message)s",'
            '"user":"%(user)s",'
            '"page":"%(page)s",'
            '"action":"%(action)s",'
            '"extra":%(extra_data)s'
            '}'
        )
        file_handler.setFormatter(CustomFormatter(file_format))
        
        # Add handlers to logger
        logger.addHandler(file_handler)
        
        return logger
    
    def _get_context(self, **kwargs):
        context = {
            'user': 'anonymous',
            'page': 'unknown',
            'action': 'unknown'
        }
        
        if has_request_context():
            context['user'] = getattr(request, 'user', 'anonymous')
            context['page'] = request.path
            context['action'] = request.method
        
        context.update(kwargs)
        return context
    
    def _log(self, logger, level, message, **kwargs):
        """Helper method to handle logging with extra fields"""
        extra = self._get_context(**kwargs)
        extra['extra_data'] = json.dumps(kwargs)
        logger.log(level, message, extra=extra)
    
    def log_schedule_generation(self, message: str, **kwargs):
        """Log schedule generation events with proper context"""
        self._log(self.schedule_logger, logging.DEBUG, message, **kwargs)
    
    def log_user_action(self, message: str, **kwargs):
        """Log user actions with proper context"""
        self._log(self.user_logger, logging.INFO, message, **kwargs)
    
    def log_error(self, message: str, error: Exception = None, **kwargs):
        """Log errors with proper context"""
        if error:
            kwargs.update({
                'error_type': type(error).__name__,
                'error_message': str(error)
            })
        self._log(self.error_logger, logging.ERROR, message, **kwargs)

# Create global logger instance
logger = StructuredLogger('schichtplan') 