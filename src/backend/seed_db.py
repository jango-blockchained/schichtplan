from app import create_app
from api.demo_data import generate_shift_templates, generate_employee_data, generate_coverage_data, generate_availability_data
from models import db
from models.settings import Settings

def seed_database():
    app = create_app()
    with app.app_context():
        # Make sure settings are properly configured
        print('Configuring settings...')
        settings = Settings.query.first()
        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)
        
        # Get current settings as dictionary
        settings_dict = settings.to_dict()
        
        # Update generation requirements
        if 'scheduling' not in settings_dict:
            settings_dict['scheduling'] = {}
        if 'generation_requirements' not in settings_dict['scheduling']:
            settings_dict['scheduling']['generation_requirements'] = {}
        
        # Enable key requirements
        settings_dict['scheduling']['generation_requirements'] = {
            'enforce_minimum_coverage': True,
            'enforce_contracted_hours': True,
            'enforce_availability': True,
            'enforce_keyholder_coverage': True,
            'enforce_rest_periods': True,
            'enforce_early_late_rules': True,
            'enforce_employee_group_rules': True
        }
        
        # Update scheduling advanced settings
        if 'scheduling_advanced' not in settings_dict:
            settings_dict['scheduling_advanced'] = {}
        settings_dict['scheduling_advanced']['generation_requirements'] = settings_dict['scheduling']['generation_requirements']
        
        # Update settings with the modified dictionary
        settings.update_from_dict(settings_dict)
        db.session.commit()
        print('Settings configured')
        
        # Generate shift templates
        print('Generating shift templates...')
        shifts = generate_shift_templates()
        print(f'Created {len(shifts)} shift templates')
        
        # Generate employees
        print('Generating employees...')
        employees = generate_employee_data()
        
        # Set more keyholders and update priorities
        for i, employee in enumerate(employees):
            # First 5 employees are keyholders (instead of just 3)
            if i < 5:
                employee.is_keyholder = True
            
            # Set weight/priority for assignment based on employee group
            if employee.employee_group == 'TL':  # Team Leader
                employee.weight = 100  # Highest priority
            elif employee.employee_group == 'VZ':  # Full time
                employee.weight = 80
            elif employee.employee_group == 'TZ':  # Part time
                employee.weight = 60
            else:  # GFB - Minimal hours
                employee.weight = 40
        
        db.session.add_all(employees)
        db.session.commit()
        print(f'Created {len(employees)} employees')
        
        # Generate coverage
        print('Generating coverage data...')
        coverage = generate_coverage_data()
        db.session.add_all(coverage)
        db.session.commit()
        print(f'Created {len(coverage)} coverage slots')
        
        # Generate availabilities for employees
        print('Generating availability data...')
        availabilities = generate_availability_data(employees)
        db.session.add_all(availabilities)
        db.session.commit()
        print(f'Created {len(availabilities)} availability records')
        
        print('Initialization complete!')

if __name__ == "__main__":
    seed_database() 