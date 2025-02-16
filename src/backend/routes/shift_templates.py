from flask import Blueprint, jsonify, request
from models import db, ShiftTemplate
from datetime import datetime
from http import HTTPStatus

bp = Blueprint('shift_templates', __name__, url_prefix='/api/shift-templates')

@bp.route('/', methods=['GET'])
def get_templates():
    """Get all shift templates"""
    templates = ShiftTemplate.query.all()
    return jsonify([template.to_dict() for template in templates])

@bp.route('/<int:template_id>', methods=['GET'])
def get_template(template_id):
    """Get a specific shift template"""
    template = ShiftTemplate.query.get_or_404(template_id)
    return jsonify(template.to_dict())

@bp.route('/', methods=['POST'])
def create_template():
    """Create a new shift template"""
    data = request.get_json()
    
    try:
        template = ShiftTemplate(
            name=data['name'],
            shifts=data['shifts'],
            description=data.get('description'),
            is_active=data.get('is_active', True),
            is_default=data.get('is_default', False)
        )
        
        # If this template is set as default, unset any existing default
        if template.is_default:
            existing_default = ShiftTemplate.query.filter_by(is_default=True).first()
            if existing_default:
                existing_default.is_default = False
        
        db.session.add(template)
        db.session.commit()
        
        return jsonify(template.to_dict()), HTTPStatus.CREATED
        
    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST

@bp.route('/<int:template_id>', methods=['PUT'])
def update_template(template_id):
    """Update a shift template"""
    template = ShiftTemplate.query.get_or_404(template_id)
    data = request.get_json()
    
    try:
        if 'name' in data:
            template.name = data['name']
        if 'shifts' in data:
            template.shifts = data['shifts']
        if 'description' in data:
            template.description = data['description']
        if 'is_active' in data:
            template.is_active = data['is_active']
        if 'is_default' in data:
            # If setting as default, unset any existing default
            if data['is_default'] and not template.is_default:
                existing_default = ShiftTemplate.query.filter_by(is_default=True).first()
                if existing_default:
                    existing_default.is_default = False
            template.is_default = data['is_default']
        
        db.session.commit()
        return jsonify(template.to_dict())
        
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST

@bp.route('/<int:template_id>', methods=['DELETE'])
def delete_template(template_id):
    """Delete a shift template"""
    template = ShiftTemplate.query.get_or_404(template_id)
    
    if template.is_default:
        return jsonify({
            'error': 'Cannot delete the default template'
        }), HTTPStatus.BAD_REQUEST
    
    db.session.delete(template)
    db.session.commit()
    return '', HTTPStatus.NO_CONTENT

@bp.route('/default', methods=['GET'])
def get_default_template():
    """Get the default shift template"""
    template = ShiftTemplate.query.filter_by(is_default=True).first()
    if not template:
        template = ShiftTemplate.create_default_template()
        db.session.add(template)
        db.session.commit()
    return jsonify(template.to_dict())

@bp.route('/apply/<int:template_id>', methods=['POST'])
def apply_template(template_id):
    """Apply a template to create actual shifts"""
    template = ShiftTemplate.query.get_or_404(template_id)
    
    try:
        from models import Shift, ShiftType
        from datetime import datetime, time
        
        # Delete existing shifts
        Shift.query.delete()
        
        # Create new shifts from template
        for shift_data in template.shifts:
            start_time = datetime.strptime(shift_data['start_time'], '%H:%M').time()
            end_time = datetime.strptime(shift_data['end_time'], '%H:%M').time()
            
            shift = Shift(
                shift_type=ShiftType(shift_data['shift_type']),
                start_time=start_time,
                end_time=end_time,
                min_employees=shift_data['min_employees'],
                max_employees=shift_data['max_employees']
            )
            db.session.add(shift)
        
        db.session.commit()
        return jsonify({
            'message': 'Template applied successfully',
            'shifts_created': len(template.shifts)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST 