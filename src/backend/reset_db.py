import os
from app import create_app
from models import db, Settings

def reset_database():
    app = create_app()
    
    with app.app_context():
        # Get the database file path
        db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        
        # Remove the existing database file if it exists
        if os.path.exists(db_path):
            os.remove(db_path)
            print(f"Removed existing database at {db_path}")
        
        # Drop all tables (in case they exist)
        db.drop_all()
        print("Dropped all existing tables")
        
        # Create all tables with current schema
        db.create_all()
        print("Created new database with current schema")
        
        try:
            # Initialize with default settings
            settings = Settings.get_default_settings()
            db.session.add(settings)
            db.session.commit()
            print("Initialized database with default settings")
        except Exception as e:
            db.session.rollback()
            print(f"Error initializing settings: {str(e)}")
            raise

if __name__ == '__main__':
    reset_database() 