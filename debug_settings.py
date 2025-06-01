#!/usr/bin/env python3
import sys
import os
sys.path.append('/home/jango/Git/maike2/schichtplan')

from src.backend.app import create_app
from src.backend.models import Settings

app = create_app()
with app.app_context():
    settings = Settings.query.first()
    if settings:
        print('Settings object exists')
        print('Has total_weekly_working_hours attr:', hasattr(settings, 'total_weekly_working_hours'))
        if hasattr(settings, 'total_weekly_working_hours'):
            print('Value:', settings.total_weekly_working_hours)
        
        # Check the to_dict output
        settings_dict = settings.to_dict()
        scheduling = settings_dict.get('scheduling', {})
        print('Scheduling keys:', list(scheduling.keys()))
        print('total_weekly_working_hours in scheduling:', 'total_weekly_working_hours' in scheduling)
        if 'total_weekly_working_hours' in scheduling:
            print('Value in dict:', scheduling['total_weekly_working_hours'])
    else:
        print('No settings found') 