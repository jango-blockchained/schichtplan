#!/usr/bin/env python
"""Script to correctly update the Gemini API key in database settings"""

import os
import sys
import json
from pathlib import Path

# Add the project directory to the Python path
current_dir = Path(__file__).resolve().parent
backend_dir = current_dir.parent
project_root = backend_dir.parent.parent
sys.path.insert(0, str(project_root))


def update_gemini_api_key():
    """Update Gemini API key in the database settings"""
    print("Initialize environment for database update...")

    # Get the API key from input
    api_key = input("Enter your Gemini API key: ").strip()
    if not api_key:
        print("No API key provided. Exiting.")
        return

    # Create a Flask app with the application factory
    from src.backend.app import create_app

    app = create_app()

    # Use the app context to ensure proper Flask-SQLAlchemy setup
    with app.app_context():
        # Import models inside app context to avoid initialization errors
        from src.backend.models import db
        from src.backend.models.settings import Settings

        # Create tables if they don't exist
        print("Ensuring database tables exist...")
        db.create_all()

        # Get or create settings
        settings = Settings.query.first()
        if not settings:
            print("No settings found in database. Creating default settings...")
            settings = Settings()
            db.session.add(settings)

        # Initialize ai_scheduling dict if needed
        if not hasattr(settings, "ai_scheduling") or settings.ai_scheduling is None:
            settings.ai_scheduling = {}

        if not isinstance(settings.ai_scheduling, dict):
            settings.ai_scheduling = {}

        # Update API key and enable AI scheduling
        settings.ai_scheduling["api_key"] = api_key
        settings.ai_scheduling["enabled"] = True

        # Save to database
        print("Saving API key to database...")
        db.session.commit()

        # Print confirmation with masked key for security
        masked_key = (
            api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]
            if len(api_key) > 8
            else "****"
        )
        print(f"\nSettings updated successfully:")
        print(f"API Key: {masked_key}")
        print(f"Enabled: {settings.ai_scheduling.get('enabled', False)}")

        print("\nNow testing if the AISchedulerService can access the key:")
        # Test the service can access the key
        from src.backend.services.ai_scheduler_service import AISchedulerService

        ai_service = AISchedulerService()

        if ai_service.gemini_api_key:
            print("Success! The AISchedulerService can access the API key.")
            print("KI generation should now work properly.")
        else:
            print("Warning: AISchedulerService could not access the API key.")
            print("Please check the implementation in ai_scheduler_service.py")


if __name__ == "__main__":
    update_gemini_api_key()
