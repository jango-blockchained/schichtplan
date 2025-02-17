from datetime import datetime, date, timedelta
from typing import List, Dict, Any
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from models import Schedule, Employee, Shift, StoreConfig, Settings
import io

class PDFGenerator:
    def __init__(self, start_date: date, end_date: date, layout_config: Dict[str, Any] = None):
        self.start_date = start_date
        self.end_date = end_date
        self.store_config = self._get_store_config()
        self.styles = getSampleStyleSheet()
        self.layout_config = layout_config or Settings.get_pdf_layout_config()
        
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
            
        # Get table style configuration
        style_config = self.layout_config['table']['style']
        column_widths = [w * inch for w in self.layout_config['table']['column_widths']]
        
        # Create table with custom column widths
        table = Table(data, colWidths=column_widths)
        
        # Apply table style
        style = [
            ('ALIGN', (0,0), (-1,-1), style_config['alignment']),
            ('VALIGN', (0,0), (-1,-1), style_config['valign']),
            ('FONTNAME', (0,0), (-1,0), style_config['header_font']),
            ('FONTSIZE', (0,0), (-1,0), style_config['header_font_size']),
            ('FONTNAME', (0,1), (-1,-1), style_config['row_font']),
            ('FONTSIZE', (0,1), (-1,-1), style_config['row_font_size']),
            ('LEADING', (0,0), (-1,-1), style_config['leading']),
        ]
        
        # Add grid if enabled
        if style_config['grid']:
            style.append(('GRID', (0,0), (-1,-1), 1, colors.black))
            
        # Add header background
        style.append(('BACKGROUND', (0,0), (-1,0), HexColor(style_config['header_background'])))
        style.append(('TEXTCOLOR', (0,0), (-1,0), HexColor(style_config['header_text_color'])))
        
        # Add alternating row colors if specified
        if 'alternating_row_color' in style_config:
            for i in range(1, len(data), 2):
                style.append(('BACKGROUND', (0,i), (-1,i), HexColor(style_config['alternating_row_color'])))
                
        table.setStyle(TableStyle(style))
        return table
        
    def generate(self) -> bytes:
        """Generate PDF schedule for the date range"""
        buffer = io.BytesIO()
        
        # Get page configuration
        page_config = self.layout_config['page']
        margins = self.layout_config['margins']
        
        # Create document with custom margins
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4) if page_config['orientation'] == 'landscape' else A4,
            rightMargin=margins['right'],
            leftMargin=margins['left'],
            topMargin=margins['top'],
            bottomMargin=margins['bottom']
        )
        
        # Create document elements
        elements = []
        
        # Add title with custom style
        title_config = self.layout_config['title']
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontName=title_config['font'],
            fontSize=title_config['size'],
            textColor=HexColor(title_config['color']),
            alignment=title_config['alignment'],
            spaceAfter=title_config['spacing']
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