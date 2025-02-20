from flask import Blueprint, request, jsonify, send_file
from models import db, Schedule, Employee, Shift, ShiftType, StoreConfig, EmployeeGroup
from sqlalchemy.exc import IntegrityError
from http import HTTPStatus
from datetime import datetime, timedelta, date
import calendar
from typing import List, Dict, Any
from io import BytesIO
import reportlab.lib.pagesizes as pagesizes
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch

bp = Blueprint('schedules', __name__, url_prefix='/api/schedules')

def get_next_month_dates():
    today = date.today()
    next_month = today.replace(day=1) + timedelta(days=32)
    next_month = next_month.replace(day=1)
    last_day = calendar.monthrange(next_month.year, next_month.month)[1]
    return next_month, next_month.replace(day=last_day)

@bp.route('/', methods=['GET'])
def get_schedules():
    """Get all schedules for a given period"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = Schedule.query
    
    if start_date:
        query = query.filter(Schedule.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
    if end_date:
        query = query.filter(Schedule.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
    schedules = query.all()
    
    return jsonify([{
        'id': schedule.id,
        'date': schedule.date.strftime('%Y-%m-%d'),
        'employee': {
            'id': schedule.employee.id,
            'name': f"{schedule.employee.first_name} {schedule.employee.last_name}"
        },
        'shift': {
            'id': schedule.shift.id,
            'type': schedule.shift.shift_type.value,
            'start_time': schedule.shift.start_time.strftime('%H:%M'),
            'end_time': schedule.shift.end_time.strftime('%H:%M')
        },
        'break_start': schedule.break_start.strftime('%H:%M') if schedule.break_start else None,
        'break_end': schedule.break_end.strftime('%H:%M') if schedule.break_end else None
    } for schedule in schedules]), HTTPStatus.OK

@bp.route('/generate', methods=['POST'])
def generate_schedule():
    """Generate a new schedule for the given date range"""
    try:
        data = request.get_json()
        if not data or 'start_date' not in data or 'end_date' not in data:
            return jsonify({
                'error': 'Missing required fields: start_date and end_date'
            }), HTTPStatus.BAD_REQUEST

        try:
            start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({
                'error': 'Invalid date format. Use YYYY-MM-DD'
            }), HTTPStatus.BAD_REQUEST

        # Delete existing schedules for the period
        Schedule.query.filter(
            Schedule.date >= start_date,
            Schedule.date <= end_date
        ).delete()
        
        # Generate new schedules
        generator = ScheduleGenerator()
        schedules = generator.generate_schedule(start_date, end_date)
        
        # Save all schedules
        for schedule in schedules:
            db.session.add(schedule)
            
        db.session.commit()
        
        return jsonify({
            'message': 'Schedule generated successfully',
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'total_shifts': len(schedules)
        }), HTTPStatus.CREATED
        
    except ScheduleGenerationError as e:
        db.session.rollback()
        return jsonify({
            'error': str(e)
        }), HTTPStatus.BAD_REQUEST
        
    except Exception as e:
        db.session.rollback()
        print(f"Schedule generation error: {str(e)}")  # Debug print
        return jsonify({
            'error': 'Could not generate schedule',
            'details': str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR

def _generate_day_schedule(
    current_date: date,
    employees: List[Employee],
    shifts: List[Shift],
    store_config: StoreConfig
) -> List[Schedule]:
    """Generate schedule for a single day"""
    day_schedules = []
    
    # Sort shifts by start time
    sorted_shifts = sorted(shifts, key=lambda x: x.start_time)
    
    # Track employee hours
    employee_hours = {emp.id: 0 for emp in employees}
    
    for shift in sorted_shifts:
        # Determine number of employees needed for this shift
        if current_date.weekday() in [1, 3]:  # Tuesday and Thursday
            required_employees = shift.max_employees
        else:
            required_employees = max(
                shift.min_employees,
                (shift.max_employees + shift.min_employees) // 2
            )
            
        # Find available employees for this shift
        available_employees = [
            emp for emp in employees
            if _can_work_shift(emp, shift, current_date, employee_hours)
        ]
        
        # Assign employees to shift
        for _ in range(required_employees):
            if not available_employees:
                break
                
            # Prioritize keyholders for early and late shifts
            if shift.shift_type in [ShiftType.EARLY, ShiftType.LATE]:
                keyholder = next(
                    (emp for emp in available_employees if emp.is_keyholder),
                    None
                )
                if keyholder:
                    employee = keyholder
                else:
                    employee = available_employees[0]
            else:
                employee = available_employees[0]
                
            # Create schedule entry
            schedule = Schedule(
                date=current_date,
                employee_id=employee.id,
                shift_id=shift.id
            )
            
            # Add break if shift is long enough
            if shift.requires_break():
                mid_point = (
                    datetime.combine(date.today(), shift.start_time) +
                    (datetime.combine(date.today(), shift.end_time) -
                     datetime.combine(date.today(), shift.start_time)) / 2
                ).time()
                schedule.set_break(mid_point, store_config.break_duration_minutes)
                
            day_schedules.append(schedule)
            
            # Update employee hours and remove from available list
            employee_hours[employee.id] += shift.duration_hours
            available_employees.remove(employee)
            
    return day_schedules

def _can_work_shift(
    employee: Employee,
    shift: Shift,
    current_date: date,
    employee_hours: Dict[int, float]
) -> bool:
    """Check if employee can work the given shift"""
    # Check weekly hours limit
    week_start = current_date - timedelta(days=current_date.weekday())
    weekly_hours = Schedule.query.filter(
        Schedule.employee_id == employee.id,
        Schedule.date >= week_start,
        Schedule.date <= current_date
    ).join(Shift).with_entities(
        db.func.sum(
            db.func.cast(
                (db.func.strftime('%H', Shift.end_time) + 
                 db.func.strftime('%M', Shift.end_time) / 60.0) -
                (db.func.strftime('%H', Shift.start_time) + 
                 db.func.strftime('%M', Shift.start_time) / 60.0),
                db.Float
            )
        )
    ).scalar() or 0
    
    weekly_hours += employee_hours.get(employee.id, 0)
    
    if employee.employee_group in [EmployeeGroup.VL, EmployeeGroup.TL]:
        if weekly_hours + shift.duration_hours > 40:
            return False
    elif employee.employee_group == EmployeeGroup.TZ:
        if weekly_hours + shift.duration_hours > employee.contracted_hours:
            return False
    else:  # GFB
        # Check monthly hours
        month_start = date(current_date.year, current_date.month, 1)
        monthly_hours = Schedule.query.filter(
            Schedule.employee_id == employee.id,
            Schedule.date >= month_start,
            Schedule.date <= current_date
        ).join(Shift).with_entities(
            db.func.sum(
                db.func.cast(
                    (db.func.strftime('%H', Shift.end_time) + 
                     db.func.strftime('%M', Shift.end_time) / 60.0) -
                    (db.func.strftime('%H', Shift.start_time) + 
                     db.func.strftime('%M', Shift.start_time) / 60.0),
                    db.Float
                )
            )
        ).scalar() or 0
        
        if monthly_hours + shift.duration_hours > 40:
            return False
            
    # Check if already working that day
    if Schedule.query.filter(
        Schedule.employee_id == employee.id,
        Schedule.date == current_date
    ).first():
        return False
        
    return True

@bp.route('/export', methods=['POST'])
def export_schedule():
    """Export schedule as PDF"""
    try:
        data = request.get_json()
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        
        # Get schedules for the period
        schedules = Schedule.query.filter(
            Schedule.date >= start_date,
            Schedule.date <= end_date
        ).order_by(Schedule.date, Schedule.shift_id).all()
        
        # Create PDF
        buffer = BytesIO()
        p = canvas.Canvas(buffer, pagesize=pagesizes.landscape(pagesizes.A4))
        
        # Add header
        p.setFont("Helvetica-Bold", 14)
        p.drawString(1*inch, 7.5*inch, f"Schedule: {start_date} to {end_date}")
        
        # Add column headers
        p.setFont("Helvetica-Bold", 12)
        headers = ["Date", "Employee", "Shift", "Time", "Break"]
        x_positions = [1*inch, 2.5*inch, 4.5*inch, 6*inch, 7.5*inch]
        y_position = 7*inch
        
        for header, x in zip(headers, x_positions):
            p.drawString(x, y_position, header)
            
        # Add schedule entries
        p.setFont("Helvetica", 10)
        entries_per_page = 30
        entry_count = 0
        
        for schedule in schedules:
            if entry_count >= entries_per_page:
                p.showPage()
                entry_count = 0
                y_position = 7*inch
                
                # Add headers to new page
                p.setFont("Helvetica-Bold", 12)
                for header, x in zip(headers, x_positions):
                    p.drawString(x, y_position, header)
                p.setFont("Helvetica", 10)
            
            y_position -= 0.3*inch
            entry_count += 1
            
            # Date
            p.drawString(1*inch, y_position, schedule.date.strftime('%Y-%m-%d'))
            
            # Employee
            p.drawString(2.5*inch, y_position,
                        f"{schedule.employee.first_name} {schedule.employee.last_name}")
            
            # Shift
            p.drawString(4.5*inch, y_position, schedule.shift.shift_type.value)
            
            # Time
            p.drawString(6*inch, y_position,
                        f"{schedule.shift.start_time.strftime('%H:%M')}-"
                        f"{schedule.shift.end_time.strftime('%H:%M')}")
            
            # Break
            if schedule.break_start and schedule.break_end:
                p.drawString(7.5*inch, y_position,
                           f"{schedule.break_start.strftime('%H:%M')}-"
                           f"{schedule.break_end.strftime('%H:%M')}")
            
        p.save()
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"schedule_{start_date}_{end_date}.pdf",
            mimetype='application/pdf'
        )
        
    except Exception as e:
        return jsonify({
            'error': 'Could not export schedule',
            'details': str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR 