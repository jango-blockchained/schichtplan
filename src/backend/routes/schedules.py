from flask import Blueprint, jsonify, request, send_file
from models import db, Schedule, Employee, Shift
from datetime import datetime, timedelta
from typing import Dict, Any
from services.schedule_generator import ScheduleGenerator, ScheduleGenerationError
from services.pdf_generator import PDFGenerator
from services.layout_manager import LayoutManager
import io

bp = Blueprint('schedules', __name__, url_prefix='/api/schedules')

@bp.route('/', methods=['GET'])
def get_schedules():
    schedules = Schedule.query.all()
    return jsonify([schedule.to_dict() for schedule in schedules])

@bp.route('/<int:id>', methods=['GET'])
def get_schedule(id: int):
    schedule = Schedule.query.get_or_404(id)
    return jsonify(schedule.to_dict())

@bp.route('/', methods=['POST'])
def create_schedule():
    data = request.get_json()
    
    try:
        schedule = Schedule(
            date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            employee_id=int(data['employee_id']),
            shift_id=int(data['shift_id']),
            break_start=data.get('break_start'),
            break_end=data.get('break_end')
        )
        
        db.session.add(schedule)
        db.session.commit()
        
        return jsonify(schedule.to_dict()), 201
        
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400

@bp.route('/<int:id>', methods=['PUT'])
def update_schedule(id: int):
    schedule = Schedule.query.get_or_404(id)
    data = request.get_json()
    
    try:
        schedule.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        schedule.employee_id = int(data['employee_id'])
        schedule.shift_id = int(data['shift_id'])
        schedule.break_start = data.get('break_start')
        schedule.break_end = data.get('break_end')
        
        db.session.commit()
        
        return jsonify(schedule.to_dict())
        
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400

@bp.route('/<int:id>', methods=['DELETE'])
def delete_schedule(id: int):
    schedule = Schedule.query.get_or_404(id)
    db.session.delete(schedule)
    db.session.commit()
    return '', 204

@bp.route('/generate', methods=['POST'])
def generate_schedule():
    data = request.get_json()
    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        
        # Delete existing schedules for the period
        Schedule.query.filter(
            Schedule.date >= start_date,
            Schedule.date <= end_date
        ).delete()
        
        # Generate new schedule
        generator = ScheduleGenerator(start_date, end_date)
        schedules = generator.generate()
        
        # Save generated schedules
        for schedule in schedules:
            db.session.add(schedule)
        db.session.commit()
        
        return jsonify({
            'message': 'Schedule generated successfully',
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'total_shifts': len(schedules)
        }), 201
        
    except ScheduleGenerationError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An unexpected error occurred'}), 500

@bp.route('/export', methods=['POST'])
def export_schedule():
    data = request.get_json()
    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        
        # Optional layout configuration
        layout_config = data.get('layout', {})
        layout_manager = LayoutManager()
        
        # Customize layout if configuration is provided
        if layout_config:
            if 'column_widths' in layout_config:
                layout_manager.set_column_widths(layout_config['column_widths'])
            
            if 'table_style' in layout_config:
                layout_manager.set_table_style(layout_config['table_style'])
            
            if 'title_style' in layout_config:
                title_style = layout_config['title_style']
                layout_manager.set_title_style(
                    font=title_style.get('font'),
                    size=title_style.get('size'),
                    color=title_style.get('color'),
                    alignment=title_style.get('alignment')
                )
            
            if 'margins' in layout_config:
                margins = layout_config['margins']
                layout_manager.set_margins(
                    right=margins.get('right'),
                    left=margins.get('left'),
                    top=margins.get('top'),
                    bottom=margins.get('bottom')
                )
        
        # Generate PDF
        generator = PDFGenerator(start_date, end_date, layout_manager)
        pdf_data = generator.generate()
        
        # Create response
        pdf_buffer = io.BytesIO(pdf_data)
        pdf_buffer.seek(0)
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'schedule_{start_date}_{end_date}.pdf'
        )
        
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': 'An unexpected error occurred while generating the PDF'}), 500

@bp.route('/update-break-notes/', methods=['PUT'])
def update_break_notes():
    data = request.get_json()
    
    try:
        employee_id = int(data['employee_id'])
        date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        notes = data.get('notes')
        
        schedule = Schedule.query.filter_by(
            employee_id=employee_id,
            date=date
        ).first_or_404()
        
        schedule.notes = notes
        db.session.commit()
        
        return jsonify(schedule.to_dict())
        
    except (KeyError, ValueError) as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An unexpected error occurred'}), 500 