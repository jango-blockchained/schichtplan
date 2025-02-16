from app import create_app
from models import db, StoreConfig, Employee, EmployeeGroup, ShiftTemplate

def init_db():
    """Initialize database with default data"""
    app = create_app()
    with app.app_context():
        # Create all tables
        db.create_all()
        print("Created database tables")

        # Create default store config
        if not StoreConfig.query.first():
            default_config = StoreConfig.get_default_config()
            db.session.add(default_config)
            print("Created default store configuration")

        # Create default shift template
        if not ShiftTemplate.query.first():
            default_template = ShiftTemplate.create_default_template()
            db.session.add(default_template)
            print("Created default shift template")

        # Create some example employees
        if not Employee.query.first():
            employees = [
                Employee(
                    first_name="Max",
                    last_name="Mustermann",
                    employee_group=EmployeeGroup.VL,
                    contracted_hours=40.0,
                    is_keyholder=True
                ),
                Employee(
                    first_name="Anna",
                    last_name="Schmidt",
                    employee_group=EmployeeGroup.TZ,
                    contracted_hours=30.0,
                    is_keyholder=False
                ),
                Employee(
                    first_name="Lisa",
                    last_name="Weber",
                    employee_group=EmployeeGroup.GFB,
                    contracted_hours=20.0,
                    is_keyholder=False
                )
            ]
            for employee in employees:
                db.session.add(employee)
            print("Created example employees")

        db.session.commit()
        print("Database initialization completed")

if __name__ == '__main__':
    init_db() 