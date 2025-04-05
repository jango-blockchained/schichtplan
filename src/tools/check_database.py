import os
import sys

# Set Python path
sys.path.insert(0, os.path.abspath('.'))

# Import the app directly
from src.backend.app import create_app

app = create_app()

with app.app_context():
    from src.backend.models import ShiftTemplate, Coverage, Employee, db
    from sqlalchemy import inspect
    
    # Get direct table inspection 
    inspector = inspect(db.engine)
    
    print("==== DATABASE TABLES ====")
    tables = inspector.get_table_names()
    print(f"Available tables: {tables}")
    
    print("\n==== DATABASE SCHEMA INSPECTION ====")
    
    # Check Coverage table schema
    print("\nCoverage Table Columns:")
    for column in inspector.get_columns('coverage'):
        print(f"  {column['name']} ({column['type']})")
    
    # Check ShiftTemplate table schema - get actual model table name
    shift_table_name = ShiftTemplate.__tablename__
    print(f"\n{shift_table_name} Table Columns:")
    try:
        for column in inspector.get_columns(shift_table_name):
            print(f"  {column['name']} ({column['type']})")
    except Exception as e:
        print(f"Error inspecting {shift_table_name} table: {e}")
    
    print("\n==== DATABASE CONTENTS ====")
    shift_count = ShiftTemplate.query.count()
    coverage_count = Coverage.query.count()
    employee_count = Employee.query.count()
    
    print(f'Shift Templates: {shift_count}, Coverage: {coverage_count}, Employees: {employee_count}')

    # If shifts exist, print details of the first few
    if shift_count > 0:
        print("\nSample Shift Templates:")
        for shift in ShiftTemplate.query.limit(5).all():
            print(f"ID: {shift.id}, Start: {shift.start_time}, End: {shift.end_time}, Type: {shift.shift_type_id}")
            print(f"  Model Class: {shift.__class__.__name__}")
            print(f"  Table Name: {shift.__class__.__tablename__}")
            
            # Print important attributes for scheduling
            print(f"  Active Days: {getattr(shift, 'active_days', 'Not set')}")
            print(f"  Valid Days: {getattr(shift, 'valid_days', 'Not set')}")
            print(f"  Day of Week: {getattr(shift, 'day_of_week', 'Not set')}")
            
            # Print all direct attributes from database
            print("  All DB columns:")
            shift_dict = {c.name: getattr(shift, c.name) 
                         for c in shift.__table__.columns 
                         if hasattr(shift, c.name)}
            for k, v in shift_dict.items():
                print(f"    {k}: {v}")
            print()

    # If coverage exists, print details of the first few
    if coverage_count > 0:
        print("\nSample Coverage Requirements:")
        for cov in Coverage.query.limit(5).all():
            print(f"ID: {cov.id}")
            print(f"  Model Class: {cov.__class__.__name__}")
            print(f"  Table Name: {cov.__class__.__tablename__}")
            
            # Print all direct attributes from database
            print("  All DB columns:")
            cov_dict = {c.name: getattr(cov, c.name) 
                       for c in cov.__table__.columns 
                       if hasattr(cov, c.name)}
            for k, v in cov_dict.items():
                print(f"    {k}: {v}")
            print()
            
    # Show all models in the ORM
    print("\n==== ORM MODELS ====")
    for cls in [ShiftTemplate, Coverage, Employee]:
        print(f"Model: {cls.__name__}")
        print(f"  Table: {cls.__tablename__}")
        print(f"  Columns: {[c.name for c in cls.__table__.columns]}")
        print() 