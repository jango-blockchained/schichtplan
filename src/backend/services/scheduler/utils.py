"""Utility functions for scheduler setup and testing."""

import logging
from typing import Dict, Any, Optional
from datetime import date

# Import the Flask app for context management
from src.backend.app import create_app
from .generator import ScheduleGenerator


def setup_scheduler_with_context(
    log_level: int = logging.DEBUG,
    diagnostic_path: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
) -> ScheduleGenerator:
    """
    Helper function to properly set up the scheduler with Flask application context.

    This is especially useful for testing and debugging the scheduler outside of
    the normal Flask request lifecycle.

    Args:
        log_level: The logging level to use
        diagnostic_path: Optional path to store diagnostic logs (defaults to src/logs/diagnostics)
        config: Optional configuration dictionary for the scheduler

    Returns:
        Initialized ScheduleGenerator instance with proper application context
    """
    # Create the Flask app
    app = create_app()

    # Push an application context
    ctx = app.app_context()
    ctx.push()

    # Initialize the scheduler within the app context
    generator = ScheduleGenerator(config=config)

    # Set up logging with the specified level and path
    # generator.logging_manager.setup_logging(
    #     log_level=log_level, log_to_file=True, log_dir=diagnostic_path
    # ) # Commented out: Logging setup is now internal to ScheduleGenerator init

    # Log the initialization
    generator.logger.info("Scheduler initialized with application context")

    return generator


def run_scheduler_test(
    start_date: date,
    end_date: date,
    create_empty_schedules: bool = True,
    version: Optional[int] = None,
    config: Optional[Dict[str, Any]] = None,
    log_level: int = logging.DEBUG,
    diagnostic_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run the scheduler with proper application context for testing or debugging.

    Args:
        start_date: The start date of the schedule
        end_date: The end date of the schedule
        create_empty_schedules: Whether to create empty schedules for days with no coverage
        version: Optional version number for the schedule
        config: Optional configuration dictionary
        log_level: The logging level to use
        diagnostic_path: Optional path to store diagnostic logs

    Returns:
        The result of the scheduler generation
    """
    # Set up the scheduler with application context
    generator = setup_scheduler_with_context(
        log_level=log_level, diagnostic_path=diagnostic_path, config=config
    )

    try:
        # Generate the schedule
        result = generator.generate_schedule(
            start_date=start_date,
            end_date=end_date,
            create_empty_schedules=create_empty_schedules,
            version=version,
        )

        # Log completion
        generator.logger.info(
            f"Schedule generation completed for {start_date} to {end_date}"
        )

        return result
    except Exception as e:
        # Log any exceptions
        generator.logger.error(f"Schedule generation failed: {str(e)}")
        raise
    finally:
        # Pop the application context
        app = create_app()
        app.app_context().pop()
