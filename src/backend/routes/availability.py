from flask import Blueprint, request, jsonify
from models import db, EmployeeAvailability, Employee
from models.employee import AvailabilityType
from datetime import datetime, time
from http import HTTPStatus
from models import Absence, Schedule, ShiftTemplate
from models.schedule import ScheduleStatus, ScheduleVersionMeta
from sqlalchemy import desc
from flask import current_app

availability = Blueprint('availability', __name__, url_prefix='/api/availability')

@availability.route('/', methods=['GET'])
def get_availabilities():
    """Get all availabilities"""
    availabilities = EmployeeAvailability.query.all()
    return jsonify([availability.to_dict() for availability in availabilities])

@availability.route('/', methods=['POST'])
def create_availability():
    """Create a new availability"""
    data = request.get_json()
    
    try:
        availability = EmployeeAvailability(
            employee_id=data['employee_id'],
            day_of_week=data['day_of_week'],
            hour=data['hour'],
            is_available=data.get('is_available', True)
        )
        
        db.session.add(availability)
        db.session.commit()
        
        return jsonify(availability.to_dict()), HTTPStatus.CREATED
        
    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@availability.route('/<int:availability_id>', methods=['GET'])
def get_availability(availability_id):
    """Get a specific availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    return jsonify(availability.to_dict())

@availability.route('/<int:availability_id>', methods=['PUT'])
def update_availability(availability_id):
    """Update an availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    data = request.get_json()
    
    try:
        if 'employee_id' in data:
            availability.employee_id = data['employee_id']
        if 'day_of_week' in data:
            availability.day_of_week = data['day_of_week']
        if 'hour' in data:
            availability.hour = data['hour']
        if 'is_available' in data:
            availability.is_available = data['is_available']
        
        db.session.commit()
        return jsonify(availability.to_dict())
        
    except ValueError as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@availability.route('/<int:availability_id>', methods=['DELETE'])
def delete_availability(availability_id):
    """Delete an availability"""
    availability = EmployeeAvailability.query.get_or_404(availability_id)
    
    try:
        db.session.delete(availability)
        db.session.commit()
        return '', HTTPStatus.NO_CONTENT
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@availability.route('/check', methods=['POST'])
def check_availability():
    """Check employee availability for a specific date and time range"""
    data = request.get_json()
    
    try:
        employee_id = data['employee_id']
        check_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        
        # Get employee
        employee = Employee.query.get_or_404(employee_id)
        
        # Get all relevant availability records
        availabilities = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == employee_id,
            EmployeeAvailability.day_of_week == check_date.weekday()
        ).all()
        
        # Check time range if provided
        hour = None
        if 'hour' in data:
            hour = data['hour']
            availabilities = [a for a in availabilities if a.hour == hour]
        
        # If no availability records exist for this time, employee is considered available
        if not availabilities:
            return jsonify({'is_available': True})
            
        # Check if any availability record indicates the employee is available
        is_available = any(a.is_available for a in availabilities)
        
        return jsonify({
            'is_available': is_available,
            'reason': None if is_available else 'Marked as unavailable for this time'
        })
        
    except KeyError as e:
        return jsonify({'error': f'Missing required field: {str(e)}'}), HTTPStatus.BAD_REQUEST
    except ValueError as e:
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@availability.route('/employees/<int:employee_id>/availabilities', methods=['PUT'])
def update_employee_availabilities(employee_id):
    """Update employee availabilities"""
    data = request.get_json()
    
    try:
        # Delete existing availabilities
        EmployeeAvailability.query.filter_by(employee_id=employee_id).delete()
        
        # Create new availabilities
        for availability_data in data:
            availability = EmployeeAvailability(
                employee_id=employee_id,
                day_of_week=availability_data['day_of_week'],
                hour=availability_data['hour'],
                is_available=availability_data['is_available'],
                availability_type=AvailabilityType(availability_data.get('availability_type', 'AVL'))
            )
            db.session.add(availability)
            
        db.session.commit()
        return jsonify({'message': 'Availabilities updated successfully'}), HTTPStatus.OK
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), HTTPStatus.BAD_REQUEST

@availability.route('/employees/<int:employee_id>/availabilities', methods=['GET'])
def get_employee_availabilities(employee_id):
    """Get employee availabilities"""
    availabilities = EmployeeAvailability.query.filter_by(employee_id=employee_id).all()
    return jsonify([{
        'id': a.id,
        'employee_id': a.employee_id,
        'day_of_week': a.day_of_week,
        'hour': a.hour,
        'is_available': a.is_available,
        'availability_type': a.availability_type.value if a.availability_type else 'AVL',
        'created_at': a.created_at.isoformat() if a.created_at else None,
        'updated_at': a.updated_at.isoformat() if a.updated_at else None
    } for a in availabilities]), HTTPStatus.OK

@availability.route('/by_date', methods=['GET'])
def get_employee_status_by_date():
    """Get availability status for all active employees for a given date."""
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({'error': 'Missing date parameter'}), HTTPStatus.BAD_REQUEST

    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format, expected YYYY-MM-DD'}), HTTPStatus.BAD_REQUEST

    results = []
    
    try:
        # Determine the version_id to check against for schedules
        # Prioritize Published, then latest Draft, then latest overall.
        version_to_check = ScheduleVersionMeta.query.filter(
            ScheduleVersionMeta.date_range_start <= target_date,
            ScheduleVersionMeta.date_range_end >= target_date,
            ScheduleVersionMeta.status == ScheduleStatus.PUBLISHED
        ).order_by(desc(ScheduleVersionMeta.version)).first()

        if not version_to_check:
            version_to_check = ScheduleVersionMeta.query.filter(
                ScheduleVersionMeta.date_range_start <= target_date,
                ScheduleVersionMeta.date_range_end >= target_date,
                ScheduleVersionMeta.status == ScheduleStatus.DRAFT
            ).order_by(desc(ScheduleVersionMeta.version)).first()
        
        if not version_to_check:
            # Fallback to the absolute latest version if no specific one covers the date well
            version_to_check = ScheduleVersionMeta.query.order_by(desc(ScheduleVersionMeta.version)).first()

        version_id_to_check = version_to_check.version if version_to_check else None

        active_employees = Employee.query.filter_by(is_active=True).all()

        # Fetch all relevant absences and schedules in bulk to avoid N+1 queries
        absences_on_date = {}
        if active_employees:
            employee_ids = [emp.id for emp in active_employees]
            abs_records = Absence.query.filter(
                Absence.employee_id.in_(employee_ids),
                Absence.start_date <= target_date,
                Absence.end_date >= target_date
            ).all()
            for ab_rec in abs_records:
                absences_on_date[ab_rec.employee_id] = ab_rec

        schedules_on_date = {}
        if active_employees and version_id_to_check is not None:
            sched_records = db.session.query(Schedule, ShiftTemplate).join(
                ShiftTemplate, Schedule.shift_id == ShiftTemplate.id
            ).filter(
                Schedule.employee_id.in_(employee_ids),
                Schedule.date == target_date,
                Schedule.version == version_id_to_check
            ).all()
            for sched_rec, shift_tpl in sched_records:
                schedules_on_date[sched_rec.employee_id] = (sched_rec, shift_tpl)

        for emp in active_employees:
            status = "Available"
            details = None

            if emp.id in absences_on_date:
                absence = absences_on_date[emp.id]
                status = f"Absence: {absence.absence_type}" # Assuming absence_type field exists
                details = absence.to_dict() if hasattr(absence, 'to_dict') else {'reason': absence.reason or status}
            elif emp.id in schedules_on_date:
                schedule, shift_template = schedules_on_date[emp.id]
                status = f"Shift: {shift_template.name if hasattr(shift_template, 'name') else shift_template.shift_type_id} ({shift_template.start_time.strftime('%H:%M')} - {shift_template.end_time.strftime('%H:%M')})"
                details = schedule.to_dict() if hasattr(schedule, 'to_dict') else {'shift_id': schedule.shift_id}
            
            results.append({
                'employee_id': emp.id,
                'employee_name': f"{emp.first_name} {emp.last_name}",
                'status': status,
                'details': details # Adding a details field for richer info on frontend
            })
            
        return jsonify(results), HTTPStatus.OK

    except Exception as e:
        # Log the exception e
        current_app.logger.error(f"Error in /api/availability/by_date: {str(e)}") # Corrected logging
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), HTTPStatus.INTERNAL_SERVER_ERROR

@availability.route('/shifts_for_employee', methods=['GET'])
def get_shifts_for_employee_on_date():
    """Get applicable shifts for an employee on a given date, considering their availability."""
    date_str = request.args.get('date')
    employee_id_str = request.args.get('employee_id')

    if not date_str or not employee_id_str:
        return jsonify({'error': 'Missing date or employee_id parameter'}), HTTPStatus.BAD_REQUEST

    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        employee_id = int(employee_id_str)
    except ValueError:
        return jsonify({'error': 'Invalid date format or employee_id'}), HTTPStatus.BAD_REQUEST

    try:
        _ = Employee.query.get_or_404(employee_id) # Ensure employee exists
        day_of_week_str = str(target_date.weekday()) # Monday is 0, Sunday is 6. Key for active_days JSON.

        # 1. Fetch shift templates that are active on this day_of_week
        # ShiftTemplate.active_days is a JSON like: {"0": true, "1": false, ...}
        # We need to query where the key for the current day_of_week_str is true.
        # This requires a JSON-specific query if the DB supports it well, or fetching more and filtering.
        # For simplicity and broad compatibility, fetch all and filter in Python first.
        # TODO: Optimize this query if performance becomes an issue for many shift templates.
        
        potential_shift_templates = ShiftTemplate.query.all()
        active_shift_templates = [
            st for st in potential_shift_templates 
            if st.active_days and isinstance(st.active_days, dict) and st.active_days.get(day_of_week_str, False)
        ]
        
        # 2. Fetch employee's availability for that day_of_week
        employee_availabilities_for_day = EmployeeAvailability.query.filter_by(
            employee_id=employee_id,
            day_of_week=target_date.weekday() # Stored as integer in EmployeeAvailability
        ).all()

        availability_map = {avail.hour: avail for avail in employee_availabilities_for_day}
        applicable_shifts = []

        for shift_template in active_shift_templates:
            try:
                # Ensure start_time and end_time are time objects for .hour access
                # ShiftTemplate stores them as strings "HH:MM"
                st_start_time_obj = datetime.strptime(shift_template.start_time, '%H:%M').time()
                st_end_time_obj = datetime.strptime(shift_template.end_time, '%H:%M').time()
            except ValueError:
                current_app.logger.warning(f"ShiftTemplate ID {shift_template.id} has invalid time format. Skipping.")
                continue # Skip this shift template if times are malformed

            shift_start_hour = st_start_time_obj.hour
            shift_end_hour = st_end_time_obj.hour
            
            # Handle overnight shifts or shifts ending exactly at midnight (represented as hour 0 but day+1)
            # If end_hour is 00:00, it usually means the end of the day, so range up to 24.
            # If end_hour < shift_start_hour, it's an overnight shift. This simple model doesn't fully cover overnight for availability check.
            # For now, if end_hour is 0 (midnight), treat it as 24 for range purposes for single-day availability.
            current_day_shift_end_hour = shift_end_hour
            if shift_end_hour == 0 and st_end_time_obj.minute == 0: # Ends exactly at midnight
                 current_day_shift_end_hour = 24
            elif shift_end_hour < shift_start_hour: # Overnight shift, only consider hours for the current target_date
                 current_day_shift_end_hour = 24


            is_fully_available = True
            shift_hours_availability_types = []

            for hour_of_day in range(shift_start_hour, current_day_shift_end_hour):
                hourly_availability = availability_map.get(hour_of_day)
                if not hourly_availability or not hourly_availability.is_available:
                    is_fully_available = False
                    break
                shift_hours_availability_types.append(hourly_availability.availability_type)
            
            if is_fully_available and shift_hours_availability_types:
                effective_availability_type = AvailabilityType.AVAILABLE # Default
                # Enum comparison: AvailabilityType.FIXED should be compared with enum members
                if AvailabilityType.FIXED in shift_hours_availability_types:
                    effective_availability_type = AvailabilityType.FIXED
                elif AvailabilityType.PREFERRED in shift_hours_availability_types:
                    effective_availability_type = AvailabilityType.PREFERRED
                
                shift_name = shift_template.shift_type_id or shift_template.shift_type.value

                applicable_shifts.append({
                    'shift_id': shift_template.id,
                    'name': shift_name,
                    'start_time': st_start_time_obj.strftime('%H:%M'),
                    'end_time': st_end_time_obj.strftime('%H:%M'),
                    'availability_type': effective_availability_type.value
                })

        return jsonify(applicable_shifts), HTTPStatus.OK

    except Exception as e:
        current_app.logger.error(f"Error in /api/availability/shifts_for_employee: {str(e)} - {type(e)}") # Corrected logging
        import traceback # For more detailed logs during dev
        current_app.logger.error(traceback.format_exc()) # For more detailed logs during dev
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), HTTPStatus.INTERNAL_SERVER_ERROR 