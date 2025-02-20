from flask import Blueprint, jsonify, request, send_file
from datetime import datetime, timedelta
from models import db, Schedule, Employee, Shift
from services.schedule_generator import ScheduleGenerator, ScheduleGenerationError
from services.pdf_generator import PDFGenerator
from http import HTTPStatus

schedules = Blueprint('schedules', __name__)

@schedules.route('/api/schedules', methods=['GET'])
@schedules.route('/api/schedules/', methods=['GET'])
def get_schedules():
    """Get all schedules within a date range"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        version = request.args.get('version', type=int)  # Optional version filter
        
        if not start_date or not end_date:
            return jsonify({'error': 'start_date and end_date are required'}), HTTPStatus.BAD_REQUEST
            
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # Build query
        query = Schedule.query.filter(
            Schedule.date >= start_date,
            Schedule.date <= end_date
        )
        
        # Filter by version if specified
        if version is not None:
            query = query.filter(Schedule.version == version)
            
        schedules = query.all()
        
        # Get all versions for this date range
        versions = db.session.query(Schedule.version).filter(
            Schedule.date >= start_date,
            Schedule.date <= end_date
        ).distinct().order_by(Schedule.version.desc()).all()
        
        return jsonify({
            'schedules': [schedule.to_dict() for schedule in schedules],
            'versions': [v[0] for v in versions]
        })
        
    except ValueError as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@schedules.route('/api/schedules/generate', methods=['POST'])
@schedules.route('/api/schedules/generate/', methods=['POST'])
def generate_schedule():
    """Generate a schedule for a date range"""
    try:
        data = request.get_json()
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        
        # Get the latest version for this date range
        latest_version = Schedule.get_latest_version(start_date, end_date)
        next_version = latest_version + 1
        
        generator = ScheduleGenerator()
        schedules, errors = generator.generate_schedule(start_date, end_date)
        
        # Set version for all new schedules
        for schedule in schedules:
            schedule.version = next_version
            db.session.add(schedule)
            
        db.session.commit()
        
        return jsonify({
            'schedules': [schedule.to_dict() for schedule in schedules],
            'errors': errors,
            'version': next_version,
            'total_shifts': len(schedules)
        }), HTTPStatus.CREATED
        
    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@schedules.route('/api/schedules/pdf', methods=['GET'])
def get_schedule_pdf():
    """Get schedule as PDF"""
    try:
        start_date = datetime.strptime(request.args.get('start_date'), '%Y-%m-%d')
        end_date = datetime.strptime(request.args.get('end_date'), '%Y-%m-%d')
        
        # Get schedules for the date range
        schedules = Schedule.query.filter(
            Schedule.date >= start_date.date(),
            Schedule.date <= end_date.date()
        ).all()
        
        # Generate PDF
        generator = PDFGenerator()
        pdf_buffer = generator.generate_schedule_pdf(schedules, start_date, end_date)
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'schedule_{start_date.strftime("%Y%m%d")}_{end_date.strftime("%Y%m%d")}.pdf'
        )
        
    except (KeyError, ValueError) as e:
        return jsonify({'error': f'Invalid input: {str(e)}'}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@schedules.route('/api/schedules/<int:schedule_id>', methods=['GET'])
@schedules.route('/api/schedules/<int:schedule_id>/', methods=['GET'])
def get_schedule(schedule_id):
    """Get a specific schedule"""
    schedule = Schedule.query.get_or_404(schedule_id)
    return jsonify(schedule.to_dict())

@schedules.route('/api/schedules/<int:schedule_id>', methods=['PUT'])
@schedules.route('/api/schedules/<int:schedule_id>/', methods=['PUT'])
def update_schedule(schedule_id):
    """Update a schedule (for drag and drop functionality)"""
    try:
        schedule = Schedule.query.get_or_404(schedule_id)
        data = request.get_json()
        
        if 'employee_id' in data:
            schedule.employee_id = data['employee_id']
        if 'shift_id' in data:
            schedule.shift_id = data['shift_id']
        if 'date' in data:
            schedule.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        if 'break_start' in data:
            schedule.break_start = data['break_start']
        if 'break_end' in data:
            schedule.break_end = data['break_end']
        if 'notes' in data:
            schedule.notes = data['notes']
            
        db.session.commit()
        return jsonify(schedule.to_dict())
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@schedules.route('/api/schedules/<int:schedule_id>', methods=['DELETE'])
@schedules.route('/api/schedules/<int:schedule_id>/', methods=['DELETE'])
def delete_schedule(schedule_id):
    """Delete a schedule"""
    schedule = Schedule.query.get_or_404(schedule_id)
    
    try:
        db.session.delete(schedule)
        db.session.commit()
        return '', HTTPStatus.NO_CONTENT
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR 