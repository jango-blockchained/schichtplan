from app import create_app
from models import db
from models.settings import Settings
from models.employee import Employee
from models.shift import Shift
from models.schedule import Schedule

app = create_app()
with app.app_context():
    # Drop all tables
    db.drop_all()
    print("All tables dropped")
    
    # Create all tables
    db.create_all()
    print("All tables created") 