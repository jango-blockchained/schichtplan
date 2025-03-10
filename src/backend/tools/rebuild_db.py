from app import create_app
from models import db, Settings, Coverage
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
        
        # Verify the coverage table schema
        inspector = db.inspect(db.engine)
        coverage_columns = {col['name']: col for col in inspector.get_columns('coverage')}
        expected_columns = {
            'id': {'type': db.Integer, 'primary_key': True},
            'day_index': {'type': db.Integer, 'nullable': False},
            'start_time': {'type': db.String(5), 'nullable': False},
            'end_time': {'type': db.String(5), 'nullable': False},
            'min_employees': {'type': db.Integer, 'nullable': False},
            'max_employees': {'type': db.Integer, 'nullable': False},
            'employee_types': {'type': db.JSON, 'nullable': False},
            'requires_keyholder': {'type': db.Boolean, 'nullable': False},
            'keyholder_before_minutes': {'type': db.Integer, 'nullable': True},
            'keyholder_after_minutes': {'type': db.Integer, 'nullable': True},
            'created_at': {'type': db.DateTime},
            'updated_at': {'type': db.DateTime}
        }
        
        # Check if all expected columns exist
        missing_columns = set(expected_columns.keys()) - set(coverage_columns.keys())
        if missing_columns:
            print(f"Missing columns in coverage table: {missing_columns}")
            print("Recreating coverage table...")
            Coverage.__table__.drop(db.engine, checkfirst=True)
            Coverage.__table__.create(db.engine)
            print("Coverage table recreated with correct schema")

if __name__ == '__main__':
    rebuild_database() 