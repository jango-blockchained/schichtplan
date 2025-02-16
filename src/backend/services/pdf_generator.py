from datetime import datetime, date, timedelta
from typing import List, Dict
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from models import Schedule, Employee, Shift, StoreConfig
from services.layout_manager import LayoutManager
import io

class PDFGenerator:
    def __init__(self, start_date: date, end_date: date, layout_manager: LayoutManager = None):
        self.start_date = start_date
        self.end_date = end_date
        self.store_config = self._get_store_config()
        self.styles = getSampleStyleSheet()
        
        # Use provided LayoutManager or create a default one
        self.layout_manager = layout_manager or LayoutManager()
        
    def _get_store_config(self) -> StoreConfig:
        config = StoreConfig.query.first()
        if not config:
            config = StoreConfig(
                store_name="Store",
                opening_time="09:00",
                closing_time="20:00",
                min_employees_per_shift=2,
                max_employees_per_shift=4,
                break_duration_minutes=60
            )
        return config
        
    def _get_week_dates(self, start_date: date) -> List[date]:
        """Get dates for a week starting from start_date"""
        return [start_date + timedelta(days=i) for i in range(6)]  # Monday to Saturday
        
    def _format_shift(self, schedule: Schedule) -> str:
        """Format shift information for display"""
        shift = Shift.query.get(schedule.shift_id)
        break_info = ""
        if schedule.break_start and schedule.break_end:
            break_info = f"\nBreak: {schedule.break_start}-{schedule.break_end}"
        return f"{shift.shift_type}\n{shift.start_time}-{shift.end_time}{break_info}"
        
    def _create_weekly_table(self, week_start: date) -> Table:
        """Create a table for one week of schedules"""
        # Get all schedules for the week
        week_dates = self._get_week_dates(week_start)
        schedules = Schedule.query.filter(
            Schedule.date.in_([d.strftime('%Y-%m-%d') for d in week_dates])
        ).all()
        
        # Create header row
        header = ['Employee'] + [d.strftime('%a\n%d.%m') for d in week_dates]
        
        # Get all employees
        employees = Employee.query.all()
        
        # Create data rows
        data = [header]
        for employee in employees:
            row = [f"{employee.first_name} {employee.last_name}"]
            for day in week_dates:
                schedule = next(
                    (s for s in schedules if s.employee_id == employee.id and s.date == day),
                    None
                )
                row.append(self._format_shift(schedule) if schedule else '')
            data.append(row)
            
        # Create table with custom column widths and style
        table = Table(data, colWidths=self.layout_manager.get_column_widths())
        table.setStyle(self.layout_manager.create_table_style())
        return table
        
    def generate(self) -> bytes:
        """Generate PDF schedule for the date range"""
        buffer = io.BytesIO()
        margins = self.layout_manager.get_margins()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=margins['right'],
            leftMargin=margins['left'],
            topMargin=margins['top'],
            bottomMargin=margins['bottom']
        )
        
        # Create document elements
        elements = []
        
        # Add title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontName=self.layout_manager.get_title_style()['font'],
            fontSize=self.layout_manager.get_title_style()['size'],
            textColor=self.layout_manager.get_title_style()['color'],
            alignment=self.layout_manager.get_title_style()['alignment'],
            spaceAfter=30
        )
        title = Paragraph(
            f"Schedule: {self.start_date.strftime('%d.%m.%Y')} - {self.end_date.strftime('%d.%m.%Y')}",
            title_style
        )
        elements.append(title)
        
        # Add store info
        store_info = Paragraph(
            f"{self.store_config.store_name}<br/>Opening Hours: {self.store_config.opening_time} - {self.store_config.closing_time}",
            self.styles['Normal']
        )
        elements.append(store_info)
        elements.append(Spacer(1, 20))
        
        # Create tables for each week
        current_date = self.start_date
        while current_date <= self.end_date:
            if current_date.weekday() == 0:  # Start new table on Mondays
                elements.append(self._create_weekly_table(current_date))
                elements.append(Spacer(1, 20))
            current_date += timedelta(days=7)
            
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue() 