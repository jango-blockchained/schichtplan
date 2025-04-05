import os
import sys

# Set Python path
sys.path.insert(0, os.path.abspath('.'))

# Import the app directly
from src.backend.app import create_app

app = create_app()

with app.app_context():
    from src.backend.models import Coverage, ShiftTemplate
    
    # Get coverage data
    coverage = Coverage.query.all()
    print(f'Coverage count: {len(coverage)}')
    for c in coverage[:5]:
        print(f'Day index: {c.day_index}, Time: {c.start_time}-{c.end_time}, Min: {c.min_employees}')
    
    # Get shift templates
    shifts = ShiftTemplate.query.all()
    print(f'\nShift Template count: {len(shifts)}')
    for s in shifts[:5]:
        print(f'ID: {s.id}, Time: {s.start_time}-{s.end_time}, Type: {s.shift_type}')
        print(f'Active days: {s.active_days}') 