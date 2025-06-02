"""
MEP Data Processor for schedule data preparation.

This module processes schedule data from the database into the format
required for MEP (Mitarbeiter-Einsatz-Planung) PDF generation.
"""

from datetime import datetime, timedelta, date, time
from typing import List, Dict, Optional, Any
import locale
import calendar
from collections import defaultdict
from ..models import Schedule, Employee, ShiftTemplate


class MEPDataProcessor:
    """
    Processes schedule data for MEP PDF generation.
    
    This class takes raw schedule data from the database and transforms it
    into the structured format needed for MEP PDF generation, including
    time calculations, German date formatting, and employee grouping.
    """
    
    # Employee group to position mapping
    POSITION_MAPPING = {
        'VZ': 'Vollzeit',
        'TZ': 'Teilzeit',
        'GFB': 'Geringfügig Beschäftigte',
        'TL': 'Teamleitung',
        'GfB': 'Geringfügig Beschäftigte',  # Alternative spelling
    }
    
    def __init__(self):
        """Initialize the MEP data processor."""
        # Set up German locale for date formatting
        try:
            locale.setlocale(locale.LC_TIME, 'de_DE.UTF-8')
        except locale.Error:
            try:
                locale.setlocale(locale.LC_TIME, 'German')
            except locale.Error:
                pass  # Fall back to default locale
    
    def process_schedules_for_mep(
        self,
        schedules: List[Schedule],
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Process schedules for MEP PDF generation.
        
        Args:
            schedules: List of Schedule objects to process
            start_date: Start date of the schedule period
            end_date: End date of the schedule period
            
        Returns:
            Dictionary containing processed data for MEP generation
        """
        # Extract date range information
        date_info = self._generate_date_info(start_date, end_date)
        date_range_days = self._generate_date_range_days(start_date, end_date)
        
        # Group schedules by employee
        employee_schedules = self._group_schedules_by_employee(schedules)
        
        # Process each employee's schedule data
        processed_employees = {}
        
        for employee_id, emp_schedules in employee_schedules.items():
            if not emp_schedules:
                continue
                
            # Get employee info from first schedule
            employee = emp_schedules[0].employee
            employee_info = self._extract_employee_info(employee)
            
            # Process daily schedules
            daily_schedules = self._process_daily_schedules(emp_schedules, date_range_days)
            
            # Calculate totals
            weekly_hours = self._calculate_weekly_hours(daily_schedules)
            monthly_hours = self._calculate_monthly_hours(daily_schedules, start_date)
            
            processed_employees[employee_id] = {
                'employee_info': employee_info,
                'daily_schedules': daily_schedules,
                'weekly_hours': weekly_hours,
                'weekly_hours_formatted': self._format_hours(weekly_hours),
                'monthly_hours': monthly_hours,
                'monthly_hours_formatted': self._format_hours(monthly_hours),
            }
        
        return {
            'employees': processed_employees,
            'date_info': date_info,
            'date_range_days': date_range_days,
        }
    
    def _generate_date_info(self, start_date: datetime, end_date: datetime) -> Dict[str, str]:
        """Generate formatted date information for the header."""
        try:
            # German month/year format
            month_year = start_date.strftime('%B %Y')
            
            # Week range format (German style)
            week_from = start_date.strftime('%d.%m.%Y')
            week_to = end_date.strftime('%d.%m.%Y')
            
        except Exception:
            # Fallback to English if German locale fails
            month_names_de = {
                1: 'Januar', 2: 'Februar', 3: 'März', 4: 'April',
                5: 'Mai', 6: 'Juni', 7: 'Juli', 8: 'August',
                9: 'September', 10: 'Oktober', 11: 'November', 12: 'Dezember'
            }
            
            month_year = f"{month_names_de[start_date.month]} {start_date.year}"
            week_from = start_date.strftime('%d.%m.%Y')
            week_to = end_date.strftime('%d.%m.%Y')
        
        return {
            'month_year': month_year,
            'week_from': week_from,
            'week_to': week_to,
        }
    
    def _generate_date_range_days(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """Generate list of days in the date range with German formatting."""
        days = []
        current_date = start_date.date()
        end_date_obj = end_date.date()
        
        # German day names
        day_names_de = {
            0: 'Montag', 1: 'Dienstag', 2: 'Mittwoch', 3: 'Donnerstag',
            4: 'Freitag', 5: 'Samstag', 6: 'Sonntag'
        }
        
        while current_date <= end_date_obj:
            # Python weekday: Monday=0, Sunday=6
            weekday = current_date.weekday()
            
            day_info = {
                'date': current_date,
                'name': day_names_de[weekday],
                'date_formatted': current_date.strftime('%d.%m.'),
                'weekday': weekday,
            }
            
            days.append(day_info)
            current_date += timedelta(days=1)
        
        return days
    
    def _group_schedules_by_employee(self, schedules: List[Schedule]) -> Dict[int, List[Schedule]]:
        """Group schedules by employee ID."""
        employee_schedules = defaultdict(list)
        
        for schedule in schedules:
            if schedule.employee_id and hasattr(schedule, 'employee') and schedule.employee:
                employee_schedules[schedule.employee_id].append(schedule)
        
        return dict(employee_schedules)
    
    def _extract_employee_info(self, employee: Employee) -> Dict[str, str]:
        """Extract and format employee information."""
        # Get position from employee group
        group_value = getattr(employee.employee_group, 'value', str(employee.employee_group))
        position = self.POSITION_MAPPING.get(group_value, group_value)
        
        return {
            'id': employee.id,
            'first_name': employee.first_name or '',
            'last_name': employee.last_name or '',
            'position': position,
            'employee_group': group_value,
            'is_keyholder': getattr(employee, 'is_keyholder', False),
        }
    
    def _process_daily_schedules(
        self,
        emp_schedules: List[Schedule],
        date_range_days: List[Dict]
    ) -> Dict[str, Dict]:
        """Process daily schedule data for an employee."""
        daily_schedules = {}
        
        # Create a lookup for schedules by date
        schedule_by_date = {}
        for schedule in emp_schedules:
            date_str = schedule.date.strftime('%Y-%m-%d')
            schedule_by_date[date_str] = schedule
        
        # Process each day in the range
        for day_info in date_range_days:
            date_str = day_info['date'].strftime('%Y-%m-%d')
            schedule = schedule_by_date.get(date_str)
            
            if schedule:
                daily_data = self._process_single_schedule(schedule)
            else:
                daily_data = self._create_empty_daily_data()
            
            daily_schedules[date_str] = daily_data
        
        return daily_schedules
    
    def _process_single_schedule(self, schedule: Schedule) -> Dict[str, Any]:
        """Process a single schedule entry."""
        # Extract time data
        start_time = self._format_time_for_display(schedule.shift_start)
        end_time = self._format_time_for_display(schedule.shift_end)
        break_start = self._format_time_for_display(schedule.break_start)
        break_end = self._format_time_for_display(schedule.break_end)
        
        # Calculate working hours
        working_hours = self._calculate_daily_working_hours(
            schedule.shift_start,
            schedule.shift_end,
            schedule.break_start,
            schedule.break_end,
            getattr(schedule, 'break_duration', 30)  # Default 30 minutes
        )
        
        return {
            'start_time': start_time,
            'end_time': end_time,
            'break_start': break_start,
            'break_end': break_end,
            'working_hours': working_hours,
            'hours_formatted': self._format_hours(working_hours),
            'has_data': True,
        }
    
    def _create_empty_daily_data(self) -> Dict[str, Any]:
        """Create empty daily data structure."""
        return {
            'start_time': '',
            'end_time': '',
            'break_start': '',
            'break_end': '',
            'working_hours': 0.0,
            'hours_formatted': '',
            'has_data': False,
        }
    
    def _format_time_for_display(self, time_value: Optional[Any]) -> str:
        """Format time value for display in MEP."""
        if not time_value:
            return ''
        
        # Handle different time format types
        if isinstance(time_value, str):
            # Already a string, might need formatting
            if ':' in time_value and len(time_value) >= 5:
                # Assume HH:MM or HH:MM:SS format
                return time_value[:5]  # Take only HH:MM
            return time_value
            
        elif isinstance(time_value, time):
            # Python time object
            return time_value.strftime('%H:%M')
            
        elif hasattr(time_value, 'strftime'):
            # datetime-like object
            return time_value.strftime('%H:%M')
        
        return str(time_value)
    
    def _calculate_daily_working_hours(
        self,
        start_time: Optional[Any],
        end_time: Optional[Any],
        break_start: Optional[Any],
        break_end: Optional[Any],
        break_duration_minutes: int = 30
    ) -> float:
        """Calculate daily working hours with break deduction."""
        if not start_time or not end_time:
            return 0.0
        
        try:
            # Convert times to comparable format
            start = self._parse_time_to_minutes(start_time)
            end = self._parse_time_to_minutes(end_time)
            
            if start is None or end is None:
                return 0.0
            
            # Handle overnight shifts
            if end < start:
                end += 24 * 60  # Add 24 hours in minutes
            
            # Calculate total minutes worked
            total_minutes = end - start
            
            # Deduct break time
            if break_start and break_end:
                break_start_min = self._parse_time_to_minutes(break_start)
                break_end_min = self._parse_time_to_minutes(break_end)
                
                if break_start_min is not None and break_end_min is not None:
                    if break_end_min < break_start_min:
                        break_end_min += 24 * 60
                    break_minutes = break_end_min - break_start_min
                    total_minutes -= break_minutes
            else:
                # Use default break duration for shifts > 6 hours
                if total_minutes > 6 * 60:  # More than 6 hours
                    total_minutes -= break_duration_minutes
            
            # Convert to hours
            return max(0.0, total_minutes / 60.0)
            
        except Exception as e:
            # If calculation fails, return 0
            return 0.0
    
    def _parse_time_to_minutes(self, time_value: Optional[Any]) -> Optional[int]:
        """Parse a time value to total minutes since midnight."""
        if not time_value:
            return None
        
        try:
            if isinstance(time_value, str):
                # Parse HH:MM format
                if ':' in time_value:
                    parts = time_value.split(':')
                    hours = int(parts[0])
                    minutes = int(parts[1])
                    return hours * 60 + minutes
                return None
                
            elif isinstance(time_value, time):
                return time_value.hour * 60 + time_value.minute
                
            elif hasattr(time_value, 'hour') and hasattr(time_value, 'minute'):
                return time_value.hour * 60 + time_value.minute
                
        except (ValueError, AttributeError):
            pass
        
        return None
    
    def _calculate_weekly_hours(self, daily_schedules: Dict[str, Dict]) -> float:
        """Calculate total weekly working hours."""
        total_hours = 0.0
        
        for daily_data in daily_schedules.values():
            total_hours += daily_data.get('working_hours', 0.0)
        
        return total_hours
    
    def _calculate_monthly_hours(
        self,
        daily_schedules: Dict[str, Dict],
        start_date: datetime
    ) -> float:
        """Calculate monthly working hours (simplified - same as weekly for now)."""
        # For a proper monthly calculation, you'd need to get all schedules
        # for the entire month. For now, we'll use the weekly total.
        return self._calculate_weekly_hours(daily_schedules)
    
    def _format_hours(self, hours: float) -> str:
        """Format hours for display in MEP."""
        if hours == 0:
            return ''
        
        # Round to quarter hours for display
        rounded_hours = round(hours * 4) / 4
        
        if rounded_hours == int(rounded_hours):
            return f"{int(rounded_hours)}:00"
        elif rounded_hours - int(rounded_hours) == 0.25:
            return f"{int(rounded_hours)}:15"
        elif rounded_hours - int(rounded_hours) == 0.5:
            return f"{int(rounded_hours)}:30"
        elif rounded_hours - int(rounded_hours) == 0.75:
            return f"{int(rounded_hours)}:45"
        else:
            # For other fractions, use decimal format
            return f"{rounded_hours:.2f}" 