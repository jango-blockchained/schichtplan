#!/usr/bin/env python
"""
A diagnostic script to inspect shift templates and coverage requirements in the database.
"""

import os
import json
from datetime import datetime

# Set Flask environment variables
os.environ['FLASK_APP'] = 'src.backend.run'
os.environ['FLASK_ENV'] = 'development'

# Import Flask and create app
from flask import Flask
from src.backend.app import create_app
from src.backend.models import ShiftTemplate, Coverage, db, RecurringCoverage

def inspect_database():
    """Inspect shift templates and coverage in the database."""
    app = create_app()
    
    with app.app_context():
        print("\n=== Shift Templates ===")
        templates = ShiftTemplate.query.all()
        print(f"Found {len(templates)} shift templates:")
        
        for t in templates:
            print(f"ID: {t.id}, Type: {t.shift_type}, Start: {t.start_time}, End: {t.end_time}")
            print(f"  Active Days: {t.active_days}")
            print()
            
        print("\n=== Coverage Requirements ===")
        coverage = Coverage.query.all()
        print(f"Found {len(coverage)} coverage requirements:")
        
        for c in coverage:
            print(f"ID: {c.id}, Day Index: {c.day_index}, Start: {c.start_time}, End: {c.end_time}")
            print(f"  Min: {c.min_employees}, Max: {c.max_employees}, Keyholder: {c.requires_keyholder}")
            print()
            
        print("\n=== Recurring Coverage ===")
        recurring = RecurringCoverage.query.all()
        print(f"Found {len(recurring)} recurring coverage patterns:")
        
        for r in recurring:
            print(f"ID: {r.id}, Name: {r.name}, Days: {r.days}")
            print(f"  Start: {r.start_time}, End: {r.end_time}")
            print(f"  Start Date: {r.start_date}, End Date: {r.end_date}")
            print(f"  Min: {r.min_employees}, Max: {r.max_employees}, Keyholder: {r.requires_keyholder}")
            print()

if __name__ == "__main__":
    inspect_database() 