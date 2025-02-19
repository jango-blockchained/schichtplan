from models import db, Employee, EmployeeGroup, Settings

def init_db():
    """Initialize the database with default data"""
    db.create_all()

    # Create default settings if not exists
    if not Settings.query.first():
        default_settings = Settings.get_default_settings()
        db.session.add(default_settings)
        db.session.commit()

    # Create default employee groups if not exists
    if not EmployeeGroup.query.first():
        default_groups = EmployeeGroup.get_default_groups()
        db.session.add_all(default_groups)
        db.session.commit()

if __name__ == '__main__':
    init_db() 