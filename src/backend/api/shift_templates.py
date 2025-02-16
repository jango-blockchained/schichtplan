from flask import Blueprint, jsonify, request
from models import db
from models.shift_template import ShiftTemplate, ShiftTemplateEntry
from sqlalchemy.exc import SQLAlchemyError

bp = Blueprint('shift_templates', __name__, url_prefix='/api/shift-templates')

@bp.route('/', methods=['GET'])
def get_templates():
    """Get all shift templates"""
    try:
        templates = ShiftTemplate.query.all()
        return jsonify([template.to_dict() for template in templates])
    except SQLAlchemyError as e:
        return jsonify({'error': 'Database error', 'details': str(e)}), 500

@bp.route('/<int:id>', methods=['GET'])
def get_template(id):
    """Get a specific shift template"""
    try:
        template = ShiftTemplate.query.get_or_404(id)
        return jsonify(template.to_dict())
    except SQLAlchemyError as e:
        return jsonify({'error': 'Database error', 'details': str(e)}), 500

@bp.route('/', methods=['POST'])
def create_template():
    """Create a new shift template"""
    data = request.get_json()
    
    try:
        # Create the template
        template = ShiftTemplate(
            name=data['name'],
            description=data.get('description'),
            is_active=data.get('is_active', True),
            is_default=data.get('is_default', False)
        )
        db.session.add(template)
        
        # Create shift entries
        for shift_data in data['shifts']:
            shift = ShiftTemplateEntry(
                template=template,
                shift_type=shift_data['shift_type'],
                start_time=shift_data['start_time'],
                end_time=shift_data['end_time'],
                min_employees=shift_data['min_employees'],
                max_employees=shift_data['max_employees'],
                days=shift_data['days']
            )
            db.session.add(shift)
        
        db.session.commit()
        return jsonify(template.to_dict()), 201
    
    except KeyError as e:
        return jsonify({'error': 'Missing required field', 'details': str(e)}), 400
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Database error', 'details': str(e)}), 500

@bp.route('/<int:id>', methods=['PUT'])
def update_template(id):
    """Update a shift template"""
    template = ShiftTemplate.query.get_or_404(id)
    data = request.get_json()
    
    try:
        # Update template fields
        if 'name' in data:
            template.name = data['name']
        if 'description' in data:
            template.description = data['description']
        if 'is_active' in data:
            template.is_active = data['is_active']
        if 'is_default' in data:
            template.is_default = data['is_default']
        
        # Update shifts if provided
        if 'shifts' in data:
            # Remove existing shifts
            for shift in template.shifts:
                db.session.delete(shift)
            
            # Add new shifts
            for shift_data in data['shifts']:
                shift = ShiftTemplateEntry(
                    template=template,
                    shift_type=shift_data['shift_type'],
                    start_time=shift_data['start_time'],
                    end_time=shift_data['end_time'],
                    min_employees=shift_data['min_employees'],
                    max_employees=shift_data['max_employees'],
                    days=shift_data['days']
                )
                db.session.add(shift)
        
        db.session.commit()
        return jsonify(template.to_dict())
    
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Database error', 'details': str(e)}), 500

@bp.route('/<int:id>', methods=['DELETE'])
def delete_template(id):
    """Delete a shift template"""
    template = ShiftTemplate.query.get_or_404(id)
    
    try:
        db.session.delete(template)
        db.session.commit()
        return '', 204
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Database error', 'details': str(e)}), 500

@bp.route('/defaults', methods=['POST'])
def create_defaults():
    """Create default shift templates"""
    try:
        # Create a default template for a standard week
        template = ShiftTemplate(
            name="Standard Wochenplan",
            description="Standardvorlage für eine typische Arbeitswoche",
            is_active=True,
            is_default=True
        )
        db.session.add(template)
        
        # Add standard shifts
        shifts = [
            {
                'shift_type': 'Frühschicht',
                'start_time': '06:00',
                'end_time': '14:00',
                'min_employees': 2,
                'max_employees': 4,
                'days': ['MO', 'TU', 'WE', 'TH', 'FR', 'SA']
            },
            {
                'shift_type': 'Mittelschicht',
                'start_time': '10:00',
                'end_time': '18:00',
                'min_employees': 2,
                'max_employees': 4,
                'days': ['MO', 'TU', 'WE', 'TH', 'FR', 'SA']
            },
            {
                'shift_type': 'Spätschicht',
                'start_time': '14:00',
                'end_time': '22:00',
                'min_employees': 2,
                'max_employees': 4,
                'days': ['MO', 'TU', 'WE', 'TH', 'FR', 'SA']
            }
        ]
        
        for shift_data in shifts:
            shift = ShiftTemplateEntry(
                template=template,
                shift_type=shift_data['shift_type'],
                start_time=shift_data['start_time'],
                end_time=shift_data['end_time'],
                min_employees=shift_data['min_employees'],
                max_employees=shift_data['max_employees'],
                days=shift_data['days']
            )
            db.session.add(shift)
        
        db.session.commit()
        return jsonify({'message': 'Default template created successfully', 'template': template.to_dict()}), 201
    
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': 'Database error', 'details': str(e)}), 500 