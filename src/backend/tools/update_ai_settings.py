#!/usr/bin/env python
# Script to update AI settings in the database

import sys
import os
import json
from pathlib import Path

# Add necessary paths
current_path = Path(__file__).resolve().parent
backend_path = current_path.parent
project_path = backend_path.parent.parent

# Add project path to Python path
sys.path.append(str(project_path))

# Import required modules
from src.backend.app import create_app
from src.backend.models.settings import Settings


def update_ai_settings():
    """Update AI settings in the database"""
    # Get API key from environment variable or use a default for testing
    api_key = os.environ.get("GEMINI_API_KEY", "")

    if not api_key:
        print("Warning: No GEMINI_API_KEY found in environment variables.")
        answer = input(
            "Enter an API key manually or 'test123' for testing (or press Enter to abort): "
        )

        if not answer:
            print("Aborted.")
            return

        api_key = answer

    # Create Flask app and context
    app = create_app()

    with app.app_context():
        # Get settings
        settings = Settings.query.first()

        if not settings:
            print("Error: No settings found in database. Creating default settings...")
            settings = Settings.get_default_settings()
            from src.backend.models import db

            db.session.add(settings)
            db.session.commit()
            print("Default settings created.")

        # Update AI settings
        if settings.ai_scheduling is None:
            settings.ai_scheduling = {}

        if not isinstance(settings.ai_scheduling, dict):
            settings.ai_scheduling = {}

        # Update the API key
        settings.ai_scheduling["api_key"] = api_key

        # Ensure enabled is set
        if "enabled" not in settings.ai_scheduling:
            settings.ai_scheduling["enabled"] = True

        # Save to database
        from src.backend.models import db

        db.session.commit()

        # Print confirmation (mask the key for security)
        masked_key = (
            api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]
            if len(api_key) > 8
            else "****"
        )

        print(f"AI settings updated successfully:")
        print(f"API Key: {masked_key}")
        print(f"Enabled: {settings.ai_scheduling.get('enabled', False)}")


if __name__ == "__main__":
    update_ai_settings()
