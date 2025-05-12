#!/usr/bin/env python
# test_ai_settings.py - Debug tool to test AI settings and API key access

import os
import sys
import json
from pathlib import Path

# Add the parent directory to the path so imports work
current_dir = Path(__file__).parent
backend_dir = current_dir.parent.parent
sys.path.insert(0, str(backend_dir.parent.parent))

try:
    # Import app and db related modules
    from src.backend.app import create_app
    from src.backend.models import db
    
    # Create Flask app 
    app = create_app()
    
    # Create a test client to establish request context
    with app.test_client() as client:
        with app.app_context():
            # This ensures Flask-SQLAlchemy is properly initialized within app context
            
            # Import models and services after app context is established
            from src.backend.models.settings import Settings
            from src.backend.services.ai_scheduler_service import AISchedulerService
            
            # Test settings access
            print("Checking database settings...")
            settings = Settings.query.first()
            if not settings:
                print("No settings found in database!")
                sys.exit(1)
                
            # Check AI scheduling settings
            print("\nAI Scheduling Settings:")
            if hasattr(settings, 'ai_scheduling') and settings.ai_scheduling:
                print(json.dumps(settings.ai_scheduling, indent=2))
                
                # Check if API key is present (don't print the actual key)
                if isinstance(settings.ai_scheduling, dict) and 'api_key' in settings.ai_scheduling:
                    api_key = settings.ai_scheduling.get('api_key')
                    if api_key:
                        masked_key = api_key[:4] + '*' * (len(api_key) - 8) + api_key[-4:] if len(api_key) > 8 else '****'
                        print(f"\nAPI Key found in settings: {masked_key}")
                    else:
                        print("\nAPI Key entry exists but is empty")
                else:
                    print("\nNo API Key entry found in settings")
            else:
                print("No AI scheduling settings found")
            
            # Test service API key loading
            print("\nTesting AISchedulerService API key loading...")
            ai_service = AISchedulerService()
            
            if ai_service.gemini_api_key:
                masked_key = ai_service.gemini_api_key[:4] + '*' * (len(ai_service.gemini_api_key) - 8) + ai_service.gemini_api_key[-4:] if len(ai_service.gemini_api_key) > 8 else '****'
                print(f"Successfully loaded API key: {masked_key}")
                print(f"Current model: {ai_service.gemini_model_name}")
            else:
                print("Failed to load API key")
                print("Environment key check:")
                env_key = os.getenv("GEMINI_API_KEY")
                if env_key:
                    print("GEMINI_API_KEY is set in environment")
                else:
                    print("GEMINI_API_KEY is NOT set in environment")
            
            # Debug complete
            print("\nDebug complete")

except Exception as e:
    print(f"Error during testing: {str(e)}")
    import traceback
    traceback.print_exc()

if __name__ == "__main__":
    print("This script is intended to be run directly from command line.") 