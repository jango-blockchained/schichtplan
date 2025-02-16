from flask import Blueprint, jsonify, request
from models import db, StoreConfig
from datetime import time, datetime

bp = Blueprint('store_config', __name__, url_prefix='/api/store/config')

@bp.route('/', methods=['GET'])
def get_config():
    config = StoreConfig.query.first()
    if not config:
        config = StoreConfig(
            store_name="ShiftWise Store",
            opening_time=time(9, 0),
            closing_time=time(20, 0),
            min_employees_per_shift=2,
            max_employees_per_shift=5,
            break_duration_minutes=60
        )
        db.session.add(config)
        db.session.commit()
    return jsonify(config.to_dict())

@bp.route('/', methods=['PUT'])
def update_config():
    config = StoreConfig.query.first()
    if not config:
        config = StoreConfig.get_default_config()
        db.session.add(config)
    
    data = request.get_json()
    try:
        if 'store_name' in data:
            config.store_name = data['store_name']
            
        if 'opening_time' in data:
            time_obj = datetime.strptime(data['opening_time'], '%H:%M').time()
            config.opening_time = time_obj
            
        if 'closing_time' in data:
            time_obj = datetime.strptime(data['closing_time'], '%H:%M').time()
            config.closing_time = time_obj
            
        if 'min_employees_per_shift' in data:
            config.min_employees_per_shift = int(data['min_employees_per_shift'])
            
        if 'max_employees_per_shift' in data:
            config.max_employees_per_shift = int(data['max_employees_per_shift'])
            
        if 'break_duration_minutes' in data:
            config.break_duration_minutes = int(data['break_duration_minutes'])
        
        db.session.commit()
        return jsonify(config.to_dict())
        
    except (ValueError, TypeError) as e:
        return jsonify({'error': f'Invalid data format: {str(e)}'}), 400

@bp.route('/reset', methods=['POST'])
def reset_config():
    config = StoreConfig.query.first()
    if config:
        db.session.delete(config)
    
    config = StoreConfig.get_default_config()
    db.session.add(config)
    db.session.commit()
    return jsonify(config.to_dict()) 