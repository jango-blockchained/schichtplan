"""
Script to create the schedule_version_meta table.
Run this script to create the table in the database.
"""

from flask import Flask
from models import db
from models.schedule import ScheduleVersionMeta


def create_app():
    """Create and configure a Flask app instance."""
    app = Flask(__name__)
    app.config.from_object("config.Config")
    db.init_app(app)
    return app


def create_version_meta_table(app):
    """Create the schedule_version_meta table."""
    with app.app_context():
        print("Creating schedule_version_meta table...")
        # Create the table using SQLAlchemy's metadata interface
        ScheduleVersionMeta.__table__.create(db.engine, checkfirst=True)
        print("Table created successfully.")


if __name__ == "__main__":
    app = create_app()
    create_version_meta_table(app)
