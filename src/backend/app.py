import os
import sys
import logging
from logging.handlers import RotatingFileHandler
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
from routes.absences import bp as absences_bp
from api.coverage import bp as coverage_bp
from api.demo_data import bp as demo_data_bp

def setup_logging(app):
    # Create logs directory if it doesn't exist
    log_dir = os.path.join(current_dir, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Set up logging
    log_file = os.path.join(log_dir, 'backend.log')
    file_handler = RotatingFileHandler(log_file, maxBytes=1024 * 1024, backupCount=10)
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    
    # Configure root logger
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]',
        handlers=[file_handler]
    )
    
    # Add file handler to app logger
    app.logger.addHandler(file_handler)
    
    # Also log to console in debug mode
    if app.debug:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(logging.Formatter('%(levelname)s: %(message)s'))
        app.logger.addHandler(console_handler)
        logging.getLogger().addHandler(console_handler)
    
    app.logger.setLevel(logging.INFO)
    app.logger.info('Backend startup')

def create_app():
    app = Flask(__name__, instance_relative_config=True)
    
    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass
        
    CORS(app, 
         resources={r"/api/*": {
             "origins": ["http://localhost:5173"],
             "allow_credentials": True,
             "allow_headers": ["Content-Type", "Authorization"],
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
         }})
    
    # Configure SQLAlchemy
    # We use Flask's instance folder (src/backend/instance) for the database
    # This follows Flask's best practices for instance-specific files
    db_path = os.path.join(app.instance_path, 'schichtplan.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Set up logging
    setup_logging(app)
    
    # Initialize extensions
    db.init_app(app)
    migrate = Migrate(app, db)
    
    # Register blueprints
    app.register_blueprint(shifts)
    app.register_blueprint(settings)
    app.register_blueprint(schedules)
    app.register_blueprint(employees)
    app.register_blueprint(availability)
    app.register_blueprint(absences_bp)
    app.register_blueprint(coverage_bp)
    app.register_blueprint(demo_data_bp)
    
    # Create database tables
    with app.app_context():
        db.create_all()
        app.logger.info('Database tables created/verified')
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True) 