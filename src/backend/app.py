import os
import sys
from pathlib import Path

# Add the parent directory to Python path
current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.append(str(current_dir))

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate
from models import db
from routes.shifts import shifts
from routes.settings import settings
from routes.schedules import schedules
from routes.employees import employees
from routes.availability import availability

def create_app():
    app = Flask(__name__)
    CORS(app)
    
    # Configure SQLAlchemy
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///schichtplan.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize extensions
    db.init_app(app)
    migrate = Migrate(app, db)
    
    # Register blueprints
    app.register_blueprint(shifts)
    app.register_blueprint(settings)
    app.register_blueprint(schedules)
    app.register_blueprint(employees)
    app.register_blueprint(availability)
    
    # Create database tables
    with app.app_context():
        db.create_all()
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True) 