from app import create_app
from models import db
from sqlalchemy import text
import logging

def migrate():
    """Add actions_demo_data column to settings table"""
    app = create_app()
    with app.app_context():
        try:
            # First try to drop the table and recreate it
            logging.info("Recreating settings table...")
            db.drop_all()
            db.create_all()
            logging.info("Settings table recreated successfully")
            
            # Initialize with default settings
            from models import Settings
            settings = Settings.get_default_settings()
            db.session.add(settings)
            db.session.commit()
            logging.info("Default settings initialized successfully")
            
        except Exception as e:
            db.session.rollback()
            logging.error(f"Failed to recreate settings table: {str(e)}")
            
            # If recreation fails, try to add column
            try:
                logging.info("Attempting to add actions_demo_data column...")
                db.session.execute(text("""
                    ALTER TABLE settings 
                    ADD COLUMN actions_demo_data JSON
                """))
                db.session.commit()
                logging.info("Column 'actions_demo_data' added successfully")
            except Exception as e:
                db.session.rollback()
                logging.error(f"Failed to add column: {str(e)}")
                raise

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    try:
        migrate()
    except Exception as e:
        logging.error(f"Migration failed: {str(e)}")
        exit(1) 