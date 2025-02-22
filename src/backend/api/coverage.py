from flask import Blueprint, request, jsonify
from models import db, Coverage
from sqlalchemy.exc import IntegrityError
from http import HTTPStatus

bp = Blueprint('coverage', __name__, url_prefix='/api/coverage')

@bp.route('/', methods=['GET'])
def get_all_coverage():
    """Get all coverage requirements"""
    coverage = Coverage.query.all()
    return jsonify([c.to_dict() for c in coverage]), HTTPStatus.OK

@bp.route('/<int:day_index>', methods=['GET'])
def get_coverage_by_day(day_index):
    """Get coverage requirements for a specific day"""
    coverage = Coverage.query.filter_by(day_index=day_index).all()
    return jsonify([c.to_dict() for c in coverage]), HTTPStatus.OK

@bp.route('/', methods=['POST'])
def create_coverage():
    """Create a new coverage requirement"""
    data = request.get_json()
    
    try:
        coverage = Coverage(
            day_index=data['day_index'],
            start_time=data['start_time'],
            end_time=data['end_time'],
            min_employees=data['min_employees'],
            max_employees=data['max_employees']
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
    coverage = Coverage.query.get_or_404(coverage_id)
    data = request.get_json()
    
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
            
        db.session.commit()
        
        return jsonify(coverage.to_dict()), HTTPStatus.OK
        
    except (ValueError, KeyError) as e:
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
    coverage = Coverage.query.get_or_404(coverage_id)
    
    try:
        db.session.delete(coverage)
        db.session.commit()
        return '', HTTPStatus.NO_CONTENT
    except:
        db.session.rollback()
        return jsonify({
            'error': 'Could not delete coverage requirement'
        }), HTTPStatus.CONFLICT

@bp.route('/bulk', methods=['POST'])
def bulk_update_coverage():
    """Bulk update coverage requirements for multiple days"""
    data = request.get_json()
    
    try:
        # Delete existing coverage
        Coverage.query.delete()
        
        # Add new coverage requirements
        for day_coverage in data:
            for time_slot in day_coverage['timeSlots']:
                coverage = Coverage(
                    day_index=day_coverage['dayIndex'],
                    start_time=time_slot['startTime'],
                    end_time=time_slot['endTime'],
                    min_employees=time_slot['minEmployees'],
                    max_employees=time_slot['maxEmployees']
                )
                db.session.add(coverage)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Coverage requirements updated successfully'
        }), HTTPStatus.OK
        
    except (KeyError, ValueError) as e:
        return jsonify({
            'error': 'Invalid data provided',
            'details': str(e)
        }), HTTPStatus.BAD_REQUEST
    except IntegrityError:
        db.session.rollback()
        return jsonify({
            'error': 'Could not update coverage requirements'
        }), HTTPStatus.CONFLICT 