from app import create_app
from models import db
from models.settings import Settings

def init_db():
    """Initialize the database with default data"""
    app = create_app()
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Create default settings
        default_settings = Settings.get_or_create_default()
        
        # Commit the changes
        db.session.commit()
        
        print("Database initialized with default settings")

if __name__ == '__main__':
    init_db() 