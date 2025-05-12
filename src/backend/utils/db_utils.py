"""
Database utility functions to standardize SQLAlchemy session handling.
Helps with common transaction patterns and error handling.
"""

from functools import wraps
from contextlib import contextmanager
import logging
from sqlalchemy.exc import SQLAlchemyError

from models import db
from utils.logger import Logger

logger = Logger()

@contextmanager
def session_manager():
    """
    Context manager for database sessions.
    
    Handles session commit and rollback automatically.
    
    Example:
        with session_manager() as session:
            user = User(name="John")
            session.add(user)
            # Auto-commits if no errors, auto-rollbacks if error occurs
    """
    try:
        yield db.session
        db.session.commit()
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error_logger.error(f"Database error: {str(e)}", exc_info=True)
        raise
    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Unexpected error in database operation: {str(e)}", exc_info=True)
        raise

def transactional(func):
    """
    Decorator to make a function transactional.
    
    Commits the session if the function returns successfully,
    rollbacks if an exception occurs.
    
    Example:
        @transactional
        def create_user(name):
            user = User(name=name)
            db.session.add(user)
            return user
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            result = func(*args, **kwargs)
            db.session.commit()
            return result
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error_logger.error(f"Database error in {func.__name__}: {str(e)}", exc_info=True)
            raise
        except Exception as e:
            db.session.rollback()
            logger.error_logger.error(f"Error in {func.__name__}: {str(e)}", exc_info=True)
            raise
    return wrapper

def safe_commit():
    """
    Safely commit the current session, performing rollback if needed.
    
    Returns:
        bool: True if commit was successful, False otherwise
    """
    try:
        db.session.commit()
        return True
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error_logger.error(f"Failed to commit database session: {str(e)}", exc_info=True)
        return False

def add_all_or_abort(objects, error_message="Failed to add items to database"):
    """
    Add multiple objects to the session, rollback all if any fail.
    
    Args:
        objects: List of SQLAlchemy model instances to add
        error_message: Message to log if operation fails
        
    Returns:
        bool: True if all objects were added successfully, False otherwise
    """
    try:
        for obj in objects:
            db.session.add(obj)
        return True
    except SQLAlchemyError as e:
        db.session.rollback()
        logger.error_logger.error(f"{error_message}: {str(e)}", exc_info=True)
        return False

class AppContextManager:
    """
    Utility for handling application context in background tasks.
    
    Example:
        with AppContextManager(app) as context:
            # Database operations here that need app context
    """
    def __init__(self, app):
        self.app = app
        self.context = None
    
    def __enter__(self):
        self.context = self.app.app_context()
        return self.context.__enter__()
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        result = self.context.__exit__(exc_type, exc_val, exc_tb)
        self.context = None
        return result