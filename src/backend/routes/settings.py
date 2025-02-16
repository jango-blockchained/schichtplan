from flask import Blueprint, jsonify, request
from models.settings import Settings
from models import db

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/api/settings', methods=['GET'])
def get_settings():
    settings = Settings.query.all()
    settings_dict = {}
    
    # If no settings exist, initialize with defaults
    if not settings:
        defaults = Settings.get_default_settings()
        for category, values in defaults.items():
            for key, value in values.items() if isinstance(values, dict) else [(None, values)]:
                setting = Settings(category=category, key=key, value=value)
                db.session.add(setting)
        db.session.commit()
        settings = Settings.query.all()
    
    # Convert to dictionary format
    for setting in settings:
        if setting.category not in settings_dict:
            settings_dict[setting.category] = {}
        settings_dict[setting.category][setting.key] = setting.value
    
    return jsonify(settings_dict)

@settings_bp.route('/api/settings/<category>/<key>', methods=['PUT'])
def update_setting(category, key):
    data = request.get_json()
    setting = Settings.query.filter_by(category=category, key=key).first()
    
    if not setting:
        setting = Settings(category=category, key=key)
    
    setting.value = data.get('value')
    db.session.add(setting)
    db.session.commit()
    
    return jsonify(setting.to_dict())

@settings_bp.route('/api/settings/reset', methods=['POST'])
def reset_settings():
    Settings.query.delete()
    db.session.commit()
    
    defaults = Settings.get_default_settings()
    for category, values in defaults.items():
        for key, value in values.items() if isinstance(values, dict) else [(None, values)]:
            setting = Settings(category=category, key=key, value=value)
            db.session.add(setting)
    db.session.commit()
    
    return jsonify({'message': 'Settings reset to defaults'})

@settings_bp.route('/api/settings/<category>', methods=['GET'])
def get_category_settings(category):
    settings = Settings.query.filter_by(category=category).all()
    return jsonify({setting.key: setting.value for setting in settings})

@settings_bp.route('/api/settings/<category>/<key>', methods=['DELETE'])
def delete_setting(category, key):
    setting = Settings.query.filter_by(category=category, key=key).first()
    if setting:
        db.session.delete(setting)
        db.session.commit()
        return jsonify({'message': f'Setting {category}.{key} deleted'})
    return jsonify({'message': 'Setting not found'}), 404 