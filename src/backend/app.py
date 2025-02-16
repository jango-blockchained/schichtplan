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
from config import Config
from routes import employees
from api import shifts, schedules, store, shift_templates
from routes.settings import settings_bp

def create_app(config_class=Config):
    """Application factory function"""
    app = Flask(__name__)
    
    # Configure SQLite database
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'app.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Disable trailing slash enforcement
    app.url_map.strict_slashes = False
    
    # Initialize extensions with proper CORS configuration
    CORS(app, 
         resources={
             r"/*": {  # Allow CORS for all routes
                 "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "*"],
                 "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                 "allow_headers": ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
                 "expose_headers": ["Content-Type", "Authorization"],
                 "supports_credentials": True,  # Explicitly set credentials support
                 "max_age": 3600
             }
         }
    )
    
    db.init_app(app)
    Migrate(app, db)
    
    # Register blueprints
    app.register_blueprint(employees.bp)
    app.register_blueprint(shifts.bp)
    app.register_blueprint(schedules.bp)
    app.register_blueprint(store.bp)
    app.register_blueprint(shift_templates.bp)
    app.register_blueprint(settings_bp)
    
    @app.route('/health')
    def health_check():
        return {'status': 'healthy'}, 200
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True) 