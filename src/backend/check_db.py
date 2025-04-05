import sys
import os

# Set up the path
sys.path.insert(0, os.path.abspath('..'))

# Import models and app
from src.backend.models import db, Employee, ShiftTemplate
from src.backend.app import create_app

app = create_app()
with app.app_context():
    print("Database URI:", app.config.get("SQLALCHEMY_DATABASE_URI"))
    print("Tables:")
    try:
        engine = db.engine
        conn = engine.connect()
        print("  - Employee table exists:", db.engine.dialect.has_table(conn, 'employee'))
        print("  - Shift template table exists:", db.engine.dialect.has_table(conn, 'shifts'))
        
        # Check if employees exist
        employees = Employee.query.all()
        print(f"  - Found {len(employees)} employees")
        
        # Check if shift templates exist
        shifts = ShiftTemplate.query.all()
        print(f"  - Found {len(shifts)} shift templates")
        
    except Exception as e:
        print(f"Error: {e}")


def _get_functional_interface():
    return {
        "check_db": check_shifts
    }
