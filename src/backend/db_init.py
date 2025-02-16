from app import create_app
from models import db, Employee, Shift, StoreConfig, EmployeeGroup
from datetime import time

def init_db():
    """Initialize database with tables and default data"""
    app = create_app()
    
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Create default store config if not exists
        if not StoreConfig.query.first():
            config = StoreConfig.get_default_config()
            db.session.add(config)
        
        # Create default shifts if not exists
        if not Shift.query.first():
            default_shifts = Shift.create_default_shifts()
            for shift in default_shifts:
                db.session.add(shift)
        
        # Create sample employees if not exists
        if not Employee.query.first():
            sample_employees = [
                Employee(
                    first_name="John",
                    last_name="Doe",
                    employee_group=EmployeeGroup.TL,
                    contracted_hours=40,
                    is_keyholder=True
                ),
                Employee(
                    first_name="Jane",
                    last_name="Smith",
                    employee_group=EmployeeGroup.VL,
                    contracted_hours=40,
                    is_keyholder=True
                ),
                Employee(
                    first_name="Bob",
                    last_name="Johnson",
                    employee_group=EmployeeGroup.TZ,
                    contracted_hours=30
                ),
                Employee(
                    first_name="Alice",
                    last_name="Brown",
                    employee_group=EmployeeGroup.TZ,
                    contracted_hours=20
                ),
                Employee(
                    first_name="Charlie",
                    last_name="Wilson",
                    employee_group=EmployeeGroup.GFB,
                    contracted_hours=40
                )
            ]
            
            for employee in sample_employees:
                db.session.add(employee)
        
        # Commit all changes
        db.session.commit()
        
        print("Database initialized successfully!")

if __name__ == '__main__':
    init_db() 