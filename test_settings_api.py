#!/usr/bin/env python3
import sys
import os
sys.path.append('/home/jango/Git/maike2/schichtplan')

from src.backend.app import create_app
from src.backend.models import Settings, db

app = create_app()
with app.app_context():
    # Delete existing settings
    Settings.query.delete()
    db.session.commit()
    
    # Create new settings with default values
    settings = Settings.get_default_settings()
    db.session.add(settings)
    db.session.commit()
    
    print("Settings created successfully")
    print(f"total_weekly_working_hours: {settings.total_weekly_working_hours}")
    
    # Test to_dict method
    settings_dict = settings.to_dict()
    scheduling = settings_dict.get('scheduling', {})
    print(f"total_weekly_working_hours in dict: {scheduling.get('total_weekly_working_hours', 'NOT_FOUND')}")
    
    # Test API endpoint
    with app.test_client() as client:
        response = client.get('/api/v2/settings/')
        print(f"API response status: {response.status_code}")
        if response.status_code == 200:
            data = response.get_json()
            scheduling_api = data.get('scheduling', {})
            print(f"total_weekly_working_hours in API response: {scheduling_api.get('total_weekly_working_hours', 'NOT_FOUND')}")
        else:
            print(f"API error: {response.get_data(as_text=True)}") 