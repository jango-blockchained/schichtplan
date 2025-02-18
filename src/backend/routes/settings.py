from flask import Blueprint, jsonify, request
from models.settings import Settings
from models import db
from http import HTTPStatus

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/api/settings', methods=['GET'])
def get_settings():
    """Get all settings or initialize with defaults if none exist"""
    settings = Settings.query.first()
    
    # If no settings exist, initialize with defaults
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': f'Error initializing settings: {str(e)}'}), HTTPStatus.INTERNAL_SERVER_ERROR
    
    return jsonify(settings.to_dict())

@settings_bp.route('/api/settings', methods=['PUT'])
def update_settings():
    """Update settings"""
    data = request.get_json()
    settings = Settings.query.first()
    
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)
    
    try:
        settings.update_from_dict(data)
        db.session.commit()
        return jsonify(settings.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST

@settings_bp.route('/api/settings/reset', methods=['POST'])
def reset_settings():
    """Reset settings to defaults"""
    Settings.query.delete()
    db.session.commit()
    
    settings = Settings.get_default_settings()
    db.session.add(settings)
    db.session.commit()
    
    return jsonify(settings.to_dict())

@settings_bp.route('/api/settings/<category>', methods=['GET'])
def get_category_settings(category):
    """Get settings for a specific category"""
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)
        db.session.commit()
    
    settings_dict = settings.to_dict()
    if category not in settings_dict:
        return jsonify({'error': f'Category {category} not found'}), HTTPStatus.NOT_FOUND
    
    return jsonify(settings_dict[category])

@settings_bp.route('/api/settings/<category>', methods=['PUT'])
def update_category_settings(category):
    """Update settings for a specific category"""
    data = request.get_json()
    settings = Settings.query.first()
    
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)
    
    try:
        settings.update_from_dict({category: data})
        db.session.commit()
        return jsonify(settings.to_dict()[category])
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST

@settings_bp.route('/api/settings/<category>/<key>', methods=['PUT'])
def update_setting(category, key):
    data = request.get_json()
    setting = Settings.query.filter_by(category=category, key=key).first()
    
    if not setting:
        setting = Settings(category=category, key=key)
    
    # Handle special case for store name and other string values
    value = data.get('value')
    if key in ['store_name', 'company_name', 'timezone', 'language']:
        value = str(value) if value is not None else ''
    
    setting.value = value
    db.session.add(setting)
    db.session.commit()
    
    return jsonify(setting.to_dict())

@settings_bp.route('/api/settings/<category>/<key>', methods=['DELETE'])
def delete_setting(category, key):
    setting = Settings.query.filter_by(category=category, key=key).first()
    if setting:
        db.session.delete(setting)
        db.session.commit()
        return jsonify({'message': f'Setting {category}.{key} deleted'})
    return jsonify({'message': 'Setting not found'}), 404 