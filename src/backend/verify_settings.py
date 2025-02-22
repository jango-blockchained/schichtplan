from app import create_app
from models.settings import Settings

app = create_app()
with app.app_context():
    settings = Settings.query.first()
    print('Settings found:', settings is not None)
    print('Employee Types:', settings.employee_types)
    print('Min Employees Per Shift:', settings.min_employees_per_shift)
    print('Max Employees Per Shift:', settings.max_employees_per_shift) 