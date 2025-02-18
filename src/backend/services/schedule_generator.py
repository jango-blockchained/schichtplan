from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Tuple
from models import Employee, Shift, Schedule, StoreConfig, EmployeeGroup, EmployeeAvailability
from models.availability import AvailabilityType
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class ScheduleGenerationError(Exception):
    pass

class ScheduleGenerator:
    def __init__(self, start_date: date, end_date: date):
        self.start_date = start_date
        self.end_date = end_date
        self.store_config = self._get_store_config()
        self.employees = self._get_employees()
        self.shifts = self._get_shifts()
        self.schedule_cache: Dict[str, List[Schedule]] = {}
        
    def _get_store_config(self) -> StoreConfig:
        config = StoreConfig.query.first()
        if not config:
            raise ScheduleGenerationError("Store configuration not found")
        return config
    
    def _get_employees(self) -> List[Employee]:
        employees = Employee.query.all()
        if not employees:
            raise ScheduleGenerationError("No employees found")
        return employees
    
    def _get_shifts(self) -> List[Shift]:
        shifts = Shift.query.all()
        if not shifts:
            raise ScheduleGenerationError("No shifts found")
        return shifts
    
    def _get_employee_hours(self, employee: Employee, week_start: date) -> float:
        """Get total scheduled hours for an employee in a given week"""
        week_key = week_start.strftime('%Y-%m-%d')
        if week_key not in self.schedule_cache:
            week_end = week_start + timedelta(days=6)
            schedules = Schedule.query.filter(
                Schedule.employee_id == employee.id,
                Schedule.date >= week_start,
                Schedule.date <= week_end
            ).all()
            self.schedule_cache[week_key] = schedules
            
        total_hours = 0.0
        for schedule in self.schedule_cache[week_key]:
            shift = next(s for s in self.shifts if s.id == schedule.shift_id)
            total_hours += shift.duration_hours
        return total_hours
    
    def _check_availability(self, employee: Employee, day: date, shift: Shift) -> bool:
        """Check if employee is available for the given shift"""
        # Get all relevant availability records
        availabilities = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == employee.id,
            (
                (EmployeeAvailability.start_date <= day) &
                (EmployeeAvailability.end_date >= day)
            ) |
            EmployeeAvailability.is_recurring == True
        ).all()
        
        # If no availability records exist, employee is considered available
        if not availabilities:
            return True
            
        # Check each availability record
        for availability in availabilities:
            if not availability.is_available_for_date(day, shift.start_time, shift.end_time):
                return False
                
        return True
    
    def _assign_breaks(self, schedule: Schedule, shift: Shift) -> Tuple[Optional[str], Optional[str]]:
        """Assign break times for a shift based on German labor law"""
        if not shift.requires_break():
            return None, None
            
        shift_duration = shift.duration_hours
        start_time = datetime.strptime(shift.start_time, '%H:%M')
        
        # Break rules based on shift duration according to German labor law
        if shift_duration > 9:
            # For shifts > 9 hours: 45 minutes total break
            # Split into two breaks: 30 minutes + 15 minutes
            first_break_start = start_time + timedelta(hours=2)  # First break after 2 hours
            first_break_end = first_break_start + timedelta(minutes=30)
            
            second_break_start = start_time + timedelta(hours=6)  # Second break after 6 hours
            second_break_end = second_break_start + timedelta(minutes=15)
            
            # Return the first break only in the break fields
            # The second break will be stored in the schedule notes
            schedule.notes = f"Second break: {second_break_start.strftime('%H:%M')}-{second_break_end.strftime('%H:%M')}"
            return first_break_start.strftime('%H:%M'), first_break_end.strftime('%H:%M')
            
        elif shift_duration > 6:
            # For shifts 6-9 hours: 30 minutes break
            # Must be taken after 2-6 hours of work
            break_start = start_time + timedelta(hours=3)  # Take break after 3 hours (middle of the allowed window)
            break_end = break_start + timedelta(minutes=30)
            return break_start.strftime('%H:%M'), break_end.strftime('%H:%M')
            
        return None, None

    def _validate_break_rules(self, shift: Shift, break_start: Optional[str], break_end: Optional[str]) -> bool:
        """Validate that break times comply with German labor law"""
        if not shift.requires_break():
            return True
            
        if not break_start or not break_end:
            return False
            
        shift_start = datetime.strptime(shift.start_time, '%H:%M')
        shift_end = datetime.strptime(shift.end_time, '%H:%M')
        break_start_time = datetime.strptime(break_start, '%H:%M')
        break_end_time = datetime.strptime(break_end, '%H:%M')
        
        # Break must be within shift hours
        if break_start_time < shift_start or break_end_time > shift_end:
            return False
            
        # Calculate hours worked before break
        hours_before_break = (break_start_time - shift_start).total_seconds() / 3600
        
        # Break must be taken after at least 2 hours of work
        if hours_before_break < 2:
            return False
            
        # For shifts > 6 hours, break must be taken before 6 hours of work
        if shift.duration_hours > 6 and hours_before_break > 6:
            return False
            
        return True
    
    def _check_daily_hours(self, employee: Employee, day: date, shift: Shift) -> bool:
        """Check if adding this shift would exceed daily hour limits"""
        # Get all shifts for this day
        existing_shifts = Schedule.query.filter(
            Schedule.employee_id == employee.id,
            Schedule.date == day
        ).all()
        
        total_hours = sum(s.shift.duration_hours for s in existing_shifts) + shift.duration_hours
        return total_hours <= 10  # Max 10 hours per day
    
    def _check_weekly_hours(self, employee: Employee, week_start: date, shift: Shift) -> bool:
        """Check if adding this shift would exceed weekly hour limits"""
        week_hours = self._get_employee_hours(employee, week_start)
        
        # Different limits based on employee group
        if employee.employee_group in [EmployeeGroup.VL, EmployeeGroup.TL]:
            # For VL and TL: max 48 hours per week
            return week_hours + shift.duration_hours <= 48
        elif employee.employee_group == EmployeeGroup.TZ:
            # For TZ: respect contracted hours
            return week_hours + shift.duration_hours <= employee.contracted_hours
        else:  # GFB
            # For GFB: Check monthly hours for minijobs
            month_start = date(week_start.year, week_start.month, 1)
            month_hours = Schedule.query.filter(
                Schedule.employee_id == employee.id,
                Schedule.date >= month_start,
                Schedule.date <= week_start + timedelta(days=6)
            ).join(Shift).with_entities(
                db.func.sum(Shift.duration_hours)
            ).scalar() or 0
            
            # Calculate approximate monthly limit based on 556 EUR limit and minimum wage
            # Assuming minimum wage of 12.41 EUR in 2025
            max_monthly_hours = 556 / 12.41
            return month_hours + shift.duration_hours <= max_monthly_hours
    
    def _check_rest_period(self, employee: Employee, day: date, shift: Shift) -> bool:
        """Check if minimum rest period between shifts is respected (11 hours)"""
        # Get previous day's shift
        prev_day = day - timedelta(days=1)
        prev_shift = Schedule.query.filter(
            Schedule.employee_id == employee.id,
            Schedule.date == prev_day
        ).join(Shift).first()
        
        if not prev_shift:
            return True
            
        # Calculate rest period
        prev_end = datetime.combine(prev_day, prev_shift.shift.end_time)
        curr_start = datetime.combine(day, shift.start_time)
        rest_hours = (curr_start - prev_end).total_seconds() / 3600
        
        return rest_hours >= 11

    def _check_consecutive_days(self, employee: Employee, day: date) -> bool:
        """Check if employee would exceed maximum consecutive working days (6)"""
        # Check previous 6 days
        for i in range(1, 7):
            check_day = day - timedelta(days=i)
            if not Schedule.query.filter(
                Schedule.employee_id == employee.id,
                Schedule.date == check_day
            ).first():
                return True
        return False

    def _check_shift_distribution(self, employee: Employee, day: date, shift: Shift) -> bool:
        """Check if shift distribution is fair and follows employee group rules"""
        # Team Leaders and Full-time employees should have priority for Tuesday/Thursday shifts
        if day.weekday() in [1, 3]:  # Tuesday or Thursday
            if employee.employee_group not in [EmployeeGroup.TL, EmployeeGroup.VL]:
                # Check if any TL/VL employees are available and not yet scheduled
                available_priority = Employee.query.filter(
                    Employee.employee_group.in_([EmployeeGroup.TL, EmployeeGroup.VL]),
                    ~Employee.schedules.any(Schedule.date == day)
                ).all()
                if available_priority:
                    return False

        # Ensure fair distribution of weekend shifts
        if day.weekday() == 5:  # Saturday
            # Count weekend shifts in the last 4 weeks
            four_weeks_ago = day - timedelta(weeks=4)
            weekend_shifts = Schedule.query.filter(
                Schedule.employee_id == employee.id,
                Schedule.date >= four_weeks_ago,
                Schedule.date <= day,
                db.extract('dow', Schedule.date) == 5  # Saturday
            ).count()
            
            # Maximum 2 weekend shifts per 4 weeks for part-time and minijob employees
            if employee.employee_group in [EmployeeGroup.TZ, EmployeeGroup.GFB] and weekend_shifts >= 2:
                return False

        return True

    def _check_keyholder_coverage(self, shift: Shift, day: date, current_schedules: List[Schedule]) -> bool:
        """Check if keyholder coverage requirements are met for early/late shifts"""
        if shift.shift_type not in [ShiftType.EARLY, ShiftType.LATE]:
            return True
            
        # Check if any keyholder is already assigned to this shift
        for schedule in current_schedules:
            if schedule.date == day and schedule.shift_id == shift.id:
                employee = next(e for e in self.employees if e.id == schedule.employee_id)
                if employee.is_keyholder:
                    return True
                    
        return False

    def _can_assign_shift(self, employee: Employee, shift: Shift, day: date) -> bool:
        """Check if an employee can be assigned to a shift on a given day"""
        # First check availability
        if not self._check_availability(employee, day, shift):
            return False
            
        # Check if employee is already assigned on this day
        if Schedule.query.filter(
            Schedule.employee_id == employee.id,
            Schedule.date == day
        ).first():
            return False
            
        # Check daily and weekly hour limits
        week_start = day - timedelta(days=day.weekday())
        if not self._check_daily_hours(employee, day, shift):
            return False
        if not self._check_weekly_hours(employee, week_start, shift):
            return False
            
        # Check rest period between shifts
        if not self._check_rest_period(employee, day, shift):
            return False
            
        # Check consecutive working days
        if not self._check_consecutive_days(employee, day):
            return False
            
        # Check shift distribution rules
        if not self._check_shift_distribution(employee, day, shift):
            return False
            
        # Enhanced keyholder constraints
        if shift.shift_type in [ShiftType.EARLY, ShiftType.LATE]:
            # If this is an early/late shift and employee is not a keyholder,
            # only allow assignment if we already have a keyholder assigned
            if not employee.is_keyholder:
                current_schedules = [s for s in self.generated_schedules if s.date == day]
                if not self._check_keyholder_coverage(shift, day, current_schedules):
                    return False
            # For keyholders, check next day early shift constraint
            elif shift.shift_type == ShiftType.LATE:
                next_day = day + timedelta(days=1)
                next_day_schedule = Schedule.query.filter(
                    Schedule.employee_id == employee.id,
                    Schedule.date == next_day,
                    Schedule.shift.has(shift_type=ShiftType.EARLY)
                ).first()
                if next_day_schedule:
                    return False
                    
        return True
    
    def generate(self) -> List[Schedule]:
        """Generate schedule for the given date range"""
        self.generated_schedules = []  # Make generated_schedules an instance variable
        current_date = self.start_date
        
        while current_date <= self.end_date:
            if current_date.weekday() < 6:  # Monday (0) to Saturday (5)
                # Sort shifts by priority (early/late shifts for keyholders)
                prioritized_shifts = sorted(
                    self.shifts,
                    key=lambda s: (
                        # Early/Late shifts first (need keyholders)
                        0 if s.shift_type in [ShiftType.EARLY, ShiftType.LATE] else 1,
                        # Sort by start time for equal priority shifts
                        s.start_time
                    )
                )
                
                for shift in prioritized_shifts:
                    # Sort employees by priority and availability
                    prioritized_employees = sorted(
                        [emp for emp in self.employees if self._check_availability(emp, current_date, shift)],
                        key=lambda e: (
                            # Keyholders first for early/late shifts
                            0 if e.is_keyholder and shift.shift_type in [ShiftType.EARLY, ShiftType.LATE] else 1,
                            # TL/VL employees priority for Tuesday/Thursday
                            0 if e.employee_group in [EmployeeGroup.TL, EmployeeGroup.VL] and current_date.weekday() in [1, 3] else 1,
                            # Full-time employees next
                            0 if e.employee_group in [EmployeeGroup.VL, EmployeeGroup.TL] else 1,
                            # Part-time employees next
                            1 if e.employee_group == EmployeeGroup.TZ else 2,
                            # Sort by contracted hours (higher first)
                            -e.contracted_hours,
                            # Preferred work time
                            0 if any(a.availability_type == AvailabilityType.PREFERRED_WORK for a in e.availabilities) else 1
                        )
                    )
                    
                    assigned_count = 0
                    keyholder_assigned = False
                    
                    # First pass: Try to assign a keyholder for early/late shifts
                    if shift.shift_type in [ShiftType.EARLY, ShiftType.LATE]:
                        for employee in [e for e in prioritized_employees if e.is_keyholder]:
                            if self._can_assign_shift(employee, shift, current_date):
                                break_start, break_end = self._assign_breaks(None, shift)
                                schedule = Schedule(
                                    date=current_date,
                                    employee_id=employee.id,
                                    shift_id=shift.id,
                                    break_start=break_start,
                                    break_end=break_end
                                )
                                self.generated_schedules.append(schedule)
                                assigned_count += 1
                                keyholder_assigned = True
                                break
                    
                    # Second pass: Assign remaining employees
                    for employee in prioritized_employees:
                        if assigned_count >= shift.max_employees:
                            break
                            
                        # Skip if we already assigned this employee
                        if any(s.employee_id == employee.id and s.date == current_date for s in self.generated_schedules):
                            continue
                            
                        if self._can_assign_shift(employee, shift, current_date):
                            break_start, break_end = self._assign_breaks(None, shift)
                            schedule = Schedule(
                                date=current_date,
                                employee_id=employee.id,
                                shift_id=shift.id,
                                break_start=break_start,
                                break_end=break_end
                            )
                            self.generated_schedules.append(schedule)
                            assigned_count += 1
                            
                    # Check minimum requirements with improved error messages
                    if assigned_count < shift.min_employees or (shift.shift_type in [ShiftType.EARLY, ShiftType.LATE] and not keyholder_assigned):
                        error_msg = []
                        if assigned_count < shift.min_employees:
                            error_msg.append(f"minimum number of employees ({shift.min_employees})")
                        if shift.shift_type in [ShiftType.EARLY, ShiftType.LATE] and not keyholder_assigned:
                            error_msg.append("keyholder requirement (early/late shifts must have at least one keyholder)")
                        
                        raise ScheduleGenerationError(
                            f"Could not satisfy {' and '.join(error_msg)} for {shift.shift_type.value} shift on {current_date.strftime('%Y-%m-%d')}"
                        )
                            
            current_date += timedelta(days=1)
            
        return self.generated_schedules 