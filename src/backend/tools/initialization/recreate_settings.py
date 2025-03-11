from models import db, Settings
from app import create_app

app = create_app()

with app.app_context():
    # Drop all tables
    print("Dropping all tables...")
    db.drop_all()
    
    # Create all tables
    print("Creating tables...")
    db.create_all()
    
    # Create default settings
    print("Creating default settings...")
    settings = Settings.get_default_settings()
    db.session.add(settings)
    try:
        db.session.commit()
        print("Default settings created successfully!")
    except Exception as e:
        db.session.rollback()
        print(f"Error creating settings: {str(e)}")
        
    # Verify settings
    settings = Settings.query.first()
    if settings:
        print("Settings verified in database!")
        print(f"min_employees_per_shift: {settings.min_employees_per_shift}")
    else:
        print("Error: Settings not found in database after creation!") 