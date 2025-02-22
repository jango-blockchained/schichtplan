from app import create_app
from models import db
from utils.fixtures import load_all_fixtures

def init_db():
    """Initialize the database with default data"""
    app = create_app()
    with app.app_context():
        db.create_all()
        load_all_fixtures()

if __name__ == '__main__':
    init_db() 