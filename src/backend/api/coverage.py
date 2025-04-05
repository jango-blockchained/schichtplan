from flask import Blueprint, request, jsonify
from ..models import Coverage
from sqlalchemy.exc import IntegrityError
from http import HTTPStatus
import logging

bp = Blueprint('coverage', __name__, url_prefix='/api/coverage')

@bp.route('/', methods=['GET'])
def get_all_coverage():
    """Get all coverage requirements"""
    try:
        coverage = Coverage.query.all()
        # Group coverage by day
        coverage_by_day = {}
        for c in coverage:
            if c.day_index not in coverage_by_day:
                coverage_by_day[c.day_index] = {
                    'dayIndex': c.day_index,
                    'timeSlots': []
                }
            
            # Calculate actual start and end times including keyholder requirements
            start_time = c.start_time
            end_time = c.end_time
            
            # Don't modify the visual times, just pass the keyholder information
            coverage_by_day[c.day_index]['timeSlots'].append({
                'startTime': start_time,
                'endTime': end_time,
                'minEmployees': c.min_employees,
                'maxEmployees': c.max_employees,
                'employeeTypes': c.employee_types,
                'requiresKeyholder': c.requires_keyholder,
                'keyholderBeforeMinutes': c.keyholder_before_minutes,
                'keyholderAfterMinutes': c.keyholder_after_minutes
            })
        
        # Convert to list and sort by day index
        result = list(coverage_by_day.values())
        result.sort(key=lambda x: x['dayIndex'])
        
        return jsonify(result), HTTPStatus.OK
    except Exception as e:
        logging.error(f"Error getting coverage: {str(e)}")
        return jsonify({
            'error': 'Could not fetch coverage requirements',
            'details': str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR

@bp.route('/<int:day_index>', methods=['GET'])
def get_coverage_by_day(day_index):
    """Get coverage requirements for a specific day"""
    coverage = Coverage.query.filter_by(day_index=day_index).all()
    return jsonify([c.to_dict() for c in coverage]), HTTPStatus.OK

@bp.route('/', methods=['POST'])
def create_coverage():
    """Create a new coverage requirement"""
    from ..models import db
    data = request.get_json()
    
    try:
        coverage = Coverage(
            day_index=data['day_index'],
            start_time=data['start_time'],
            end_time=data['end_time'],
            min_employees=data['min_employees'],
            max_employees=data['max_employees'],
            employee_types=data.get('employee_types', []),  # Default to empty list if not provided
            requires_keyholder=data.get('requires_keyholder', False),  # Default to False if not provided
            keyholder_before_minutes=data.get('keyholder_before_minutes'),  # Default to None if not provided
            keyholder_after_minutes=data.get('keyholder_after_minutes')  # Default to None if not provided
        )
        
        db.session.add(coverage)
        db.session.commit()
        
        return jsonify(coverage.to_dict()), HTTPStatus.CREATED
        
    except (KeyError, ValueError) as e:
        return jsonify({
            'error': 'Invalid data provided',
            'details': str(e)
        }), HTTPStatus.BAD_REQUEST
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            'error': 'Could not create coverage requirement'
        }), HTTPStatus.CONFLICT

@bp.route('/<int:coverage_id>', methods=['PUT'])
def update_coverage(coverage_id):
    """Update a coverage requirement"""
    from ..models import db
    data = request.get_json()
    coverage = Coverage.query.get_or_404(coverage_id)
    
    try:
        if 'day_index' in data:
            coverage.day_index = data['day_index']
        if 'start_time' in data:
            coverage.start_time = data['start_time']
        if 'end_time' in data:
            coverage.end_time = data['end_time']
        if 'min_employees' in data:
            coverage.min_employees = data['min_employees']
        if 'max_employees' in data:
            coverage.max_employees = data['max_employees']
        if 'employee_types' in data:
            coverage.employee_types = data['employee_types']
        if 'requires_keyholder' in data:
            coverage.requires_keyholder = data['requires_keyholder']
        if 'keyholder_before_minutes' in data:
            coverage.keyholder_before_minutes = data['keyholder_before_minutes']
        if 'keyholder_after_minutes' in data:
            coverage.keyholder_after_minutes = data['keyholder_after_minutes']
        
        db.session.commit()
        return jsonify(coverage.to_dict())
        
    except (ValueError, KeyError) as e:
        db.session.rollback()
        return jsonify({
            'error': 'Invalid data provided',
            'details': str(e)
        }), HTTPStatus.BAD_REQUEST
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            'error': 'Could not update coverage requirement'
        }), HTTPStatus.CONFLICT

@bp.route('/<int:coverage_id>', methods=['DELETE'])
def delete_coverage(coverage_id):
    """Delete a coverage requirement"""
    from ..models import db
    coverage = Coverage.query.get_or_404(coverage_id)
    
    try:
        db.session.delete(coverage)
        db.session.commit()
        return '', HTTPStatus.NO_CONTENT
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': 'Could not delete coverage requirement',
            'details': str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR

@bp.route('/bulk', methods=['POST'])
def bulk_update_coverage():
    """Bulk update coverage requirements for multiple days"""
    from ..models import db
    data = request.get_json()
    
    try:
        logging.info(f"Received coverage data: {data}")
        
        # Delete existing coverage
        Coverage.query.delete()
        
        # Add new coverage requirements
        for day_coverage in data:
            for time_slot in day_coverage['timeSlots']:
                # Store the original times without keyholder adjustments
                coverage = Coverage(
                    day_index=day_coverage['dayIndex'],
                    start_time=time_slot['startTime'],
                    end_time=time_slot['endTime'],
                    min_employees=time_slot['minEmployees'],
                    max_employees=time_slot['maxEmployees'],
                    employee_types=time_slot.get('employeeTypes', []),
                    requires_keyholder=time_slot.get('requiresKeyholder', False),
                    keyholder_before_minutes=time_slot.get('keyholderBeforeMinutes'),
                    keyholder_after_minutes=time_slot.get('keyholderAfterMinutes')
                )
                db.session.add(coverage)
        
        db.session.commit()
        logging.info("Coverage requirements updated successfully")
        
        return jsonify({
            'message': 'Coverage requirements updated successfully'
        }), HTTPStatus.OK
        
    except (KeyError, ValueError) as e:
        db.session.rollback()
        logging.error(f"Error updating coverage (invalid data): {str(e)}")
        return jsonify({
            'error': 'Invalid data provided',
            'details': str(e)
        }), HTTPStatus.BAD_REQUEST
    except IntegrityError as e:
        db.session.rollback()
        logging.error(f"Error updating coverage (integrity error): {str(e)}")
        return jsonify({
            'error': 'Could not update coverage requirements',
            'details': str(e)
        }), HTTPStatus.CONFLICT
    except Exception as e:
        db.session.rollback()
        logging.error(f"Unexpected error updating coverage: {str(e)}")
        return jsonify({
            'error': 'An unexpected error occurred',
            'details': str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR 