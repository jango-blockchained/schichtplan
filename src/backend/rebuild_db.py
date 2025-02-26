from app import create_app
from models import db
import os

def rebuild_database():
    app = create_app()
    
    with app.app_context():
        # Get the database file path
        db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        
        # Remove the existing database file if it exists
        if os.path.exists(db_path):
            os.remove(db_path)
            print(f"Removed existing database at {db_path}")
        
        # Create all tables with current schema
        db.create_all()
        print("Created new database with current schema")

if __name__ == '__main__':
    rebuild_database() 