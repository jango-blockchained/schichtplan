#!/usr/bin/env python
# save_api_key.py - Save the provided API key to settings database

import os
import sys
import json
from pathlib import Path

# Add the parent directory to the path so imports work
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent
sys.path.insert(0, str(backend_dir.parent.parent))

def save_api_key_to_settings():
    # The API key to save
    api_key = "AIzaSyBHkmdaJzg4R249RunbNlbWo8HUjy425vM"
    
    try:
        # Import necessary modules
        from src.backend.app import create_app
        from src.backend.models import db
        from src.backend.models.settings import Settings
        
        # Create app and push context
        app = create_app()
        
        with app.app_context():
            print("Looking for existing settings...")
            settings = Settings.query.first()
            
            if not settings:
                print("No settings found. Creating default settings.")
                settings = Settings()
                db.session.add(settings)
            
            # Initialize AI scheduling dictionary if needed
            if not settings.ai_scheduling or not isinstance(settings.ai_scheduling, dict):
                settings.ai_scheduling = {}
            
            # Save the API key
            settings.ai_scheduling['api_key'] = api_key
            settings.ai_scheduling['enabled'] = True
            
            # Save to database
            db.session.commit()
            
            # Print confirmation with masked key
            masked_key = api_key[:4] + '*' * (len(api_key) - 8) + api_key[-4:] if len(api_key) > 8 else '****'
            print(f"API key saved successfully: {masked_key}")
            print("AI generation is enabled in settings.")
            
    except Exception as e:
        print(f"Error saving API key: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    save_api_key_to_settings() 