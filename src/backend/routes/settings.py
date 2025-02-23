from flask import Blueprint, jsonify, request
from models import db, Settings
from http import HTTPStatus
import logging

settings = Blueprint('settings', __name__, url_prefix='/api/settings')

@settings.route('/', methods=['GET'])
def get_settings():
    """Get all settings or initialize with defaults if none exist"""
    try:
        settings = Settings.query.first()
        
        # If no settings exist, initialize with defaults
        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                logging.error(f'Error initializing settings: {str(e)}')
                return jsonify({'error': f'Error initializing settings: {str(e)}'}), HTTPStatus.INTERNAL_SERVER_ERROR
        
        return jsonify(settings.to_dict())
    except Exception as e:
        logging.error(f'Unexpected error retrieving settings: {str(e)}')
        # If there's an unexpected error, try to reset and recreate settings
        try:
            Settings.query.delete()
            db.session.commit()
            
            settings = Settings.get_default_settings()
            db.session.add(settings)
            db.session.commit()
            
            return jsonify(settings.to_dict())
        except Exception as reset_error:
            logging.error(f'Error resetting settings: {str(reset_error)}')
            return jsonify({'error': f'Critical error retrieving settings: {str(reset_error)}'}), HTTPStatus.INTERNAL_SERVER_ERROR

@settings.route('/', methods=['PUT'])
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

@settings.route('/reset', methods=['POST'])
def reset_settings():
    """Reset settings to defaults"""
    Settings.query.delete()
    db.session.commit()
    
    settings = Settings.get_default_settings()
    db.session.add(settings)
    db.session.commit()
    
    return jsonify(settings.to_dict())

@settings.route('/<category>', methods=['GET'])
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

@settings.route('/<category>', methods=['PUT'])
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

@settings.route('/<category>/<key>', methods=['PUT'])
def update_setting(category, key):
    """Update a specific setting"""
    data = request.get_json()
    settings = Settings.query.first()
    
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)
    
    try:
        value = data.get('value')
        settings_dict = settings.to_dict()
        
        if category not in settings_dict:
            return jsonify({'error': f'Category {category} not found'}), HTTPStatus.NOT_FOUND
            
        category_dict = settings_dict[category]
        if key not in category_dict:
            return jsonify({'error': f'Key {key} not found in category {category}'}), HTTPStatus.NOT_FOUND
            
        settings.update_from_dict({category: {key: value}})
        db.session.commit()
        return jsonify({key: value})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST

@settings.route('/<category>/<key>', methods=['DELETE'])
def delete_setting(category, key):
    """Delete a specific setting (reset to default)"""
    settings = Settings.query.first()
    if not settings:
        return jsonify({'error': 'Settings not found'}), HTTPStatus.NOT_FOUND
        
    try:
        default_settings = Settings.get_default_settings()
        settings_dict = default_settings.to_dict()
        
        if category not in settings_dict:
            return jsonify({'error': f'Category {category} not found'}), HTTPStatus.NOT_FOUND
            
        category_dict = settings_dict[category]
        if key not in category_dict:
            return jsonify({'error': f'Key {key} not found in category {category}'}), HTTPStatus.NOT_FOUND
            
        # Reset the specific setting to its default value
        settings.update_from_dict({category: {key: category_dict[key]}})
        db.session.commit()
        return jsonify({'message': f'Setting {category}.{key} reset to default'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST 