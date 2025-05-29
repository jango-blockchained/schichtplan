#!/usr/bin/env python
# Simple script to check the settings table directly

from src.backend.app import create_app
from src.backend.models.settings import Settings

app = create_app()

with app.app_context():
    settings = Settings.query.first()
    if settings:
        print("Settings found!")
        print("AI Settings:", settings.ai_scheduling)

        if (
            isinstance(settings.ai_scheduling, dict)
            and "api_key" in settings.ai_scheduling
        ):
            api_key = settings.ai_scheduling.get("api_key")
            if api_key:
                masked_key = (
                    api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]
                    if len(api_key) > 8
                    else "****"
                )
                print(f"API Key: {masked_key}")
            else:
                print("API Key entry exists but is empty")
        else:
            print("No API Key entry in settings")
    else:
        print("No settings found!")
