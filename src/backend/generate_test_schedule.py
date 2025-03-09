#!/usr/bin/env python3
"""
Script to generate a test schedule using the ScheduleGenerator class.
"""

import os
import sys
import json
from datetime import date, datetime, timedelta
from services.scheduler.generator import ScheduleGenerator
from models.schedule import ScheduleStatus
from models import db
from flask import Flask
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


def create_app():
    """Create a Flask app instance"""
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///instance/app.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)
    return app


def generate_schedule(start_date_str=None, end_date_str=None):
    """Generate a schedule for the given date range"""
    # Set default date range to next week if not provided
    if not start_date_str:
        today = date.today()
        next_monday = today + timedelta(days=(7 - today.weekday()))
        start_date = next_monday
    else:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()

    if not end_date_str:
        end_date = start_date + timedelta(days=6)  # 1 week
    else:
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()

    logger.info(f"Generating schedule from {start_date} to {end_date}")

    # Create schedule generator
    generator = ScheduleGenerator()

    try:
        # Generate schedule
        result = generator.generate(start_date, end_date)

        # Save result to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"schedule_result_{timestamp}.json"

        # Ensure schedules directory exists
        os.makedirs("schedules", exist_ok=True)

        with open(os.path.join("schedules", filename), "w") as f:
            # Convert to JSON-compatible format
            json_data = {
                "schedule": [
                    {
                        "employee_id": entry.get("employee_id"),
                        "shift_id": entry.get("shift_id"),
                        "date": entry.get("date"),
                        "status": entry.get("status", ScheduleStatus.DRAFT.value),
                    }
                    for entry in result.get("schedule", [])
                ],
                "warnings": result.get("warnings", []),
                "version": result.get("version", 1),
                "generation_time": result.get(
                    "generation_time", datetime.now().isoformat()
                ),
            }
            json.dump(json_data, f, indent=2)

        logger.info(f"Schedule saved to {filename}")

        # Print summary
        schedule_entries = result.get("schedule", [])
        warnings = result.get("warnings", [])

        logger.info(f"Generated {len(schedule_entries)} schedule entries")
        logger.info(f"Found {len(warnings)} warnings")

        # Print warning summary by type if there are any
        if warnings:
            warning_types = {}
            for warning in warnings:
                warning_type = warning.get("type", "unknown")
                warning_types[warning_type] = warning_types.get(warning_type, 0) + 1

            logger.info("Warning summary:")
            for warning_type, count in warning_types.items():
                logger.info(f"  - {warning_type}: {count}")

        return result

    except Exception as e:
        logger.error(f"Error generating schedule: {str(e)}")
        return {"error": str(e)}


if __name__ == "__main__":
    # Parse command line arguments
    start_date = None
    end_date = None

    if len(sys.argv) > 1:
        start_date = sys.argv[1]

    if len(sys.argv) > 2:
        end_date = sys.argv[2]

    # Create app context
    app = create_app()

    with app.app_context():
        generate_schedule(start_date, end_date)
