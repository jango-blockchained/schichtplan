from app import create_app
from models import db, Settings

def reset_database():
    app = create_app()
    
    with app.app_context():
        # Drop all tables
        db.drop_all()
        
        # Create all tables with new schema
        db.create_all()
        
        try:
            # Initialize with default settings
            settings = Settings.get_default_settings()
            db.session.add(settings)
            db.session.commit()
            print("Database has been reset and initialized with default settings!")
        except Exception as e:
            db.session.rollback()
            print(f"Error initializing settings: {str(e)}")
            raise

if __name__ == '__main__':
    reset_database() 