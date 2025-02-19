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
        
        if not start_date or not end_date:
            return jsonify({'error': 'start_date and end_date are required'}), HTTPStatus.BAD_REQUEST
            
        start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        schedules = Schedule.query.filter(
            Schedule.date >= start_date,
            Schedule.date <= end_date
        ).all()
        
        return jsonify([schedule.to_dict() for schedule in schedules])
        
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
        
        generator = ScheduleGenerator()
        schedules = generator.generate_schedule(start_date, end_date)
        
        return jsonify([schedule.to_dict() for schedule in schedules]), HTTPStatus.CREATED
        
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
    """Update a schedule"""
    schedule = Schedule.query.get_or_404(schedule_id)
    data = request.get_json()
    
    try:
        if 'date' in data:
            schedule.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        if 'employee_id' in data:
            schedule.employee_id = data['employee_id']
        if 'shift_id' in data:
            schedule.shift_id = data['shift_id']
        if 'notes' in data:
            schedule.notes = data['notes']
        
        db.session.commit()
        return jsonify(schedule.to_dict())
        
    except ValueError as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST
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