from datetime import datetime, date, timedelta
from typing import List, Dict, Any
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from models import Schedule, Employee, Shift, Settings
import io

class PDFGenerator:
    def __init__(self):
        self.settings = Settings.query.first()
        if not self.settings:
            self.settings = Settings.get_default_settings()
        
        self.styles = getSampleStyleSheet()
        self.title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=16,
            spaceAfter=30,
            alignment=1  # Center alignment
        )
    
    def generate_schedule_pdf(self, schedules: List[Schedule], start_date: datetime, end_date: datetime) -> io.BytesIO:
        """Generate a PDF schedule for the given date range"""
        buffer = io.BytesIO()
        
        # Get PDF layout settings
        layout = self.settings.pdf_layout
        
        # Create the PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4) if layout['orientation'] == 'landscape' else A4,
            rightMargin=layout['margins']['right'],
            leftMargin=layout['margins']['left'],
            topMargin=layout['margins']['top'],
            bottomMargin=layout['margins']['bottom']
        )
        
        # Build the document content
        story = []
        
        # Add title
        title = Paragraph(
            f"Schedule {start_date.strftime('%d.%m.%Y')} - {end_date.strftime('%d.%m.%Y')}",
            self.title_style
        )
        story.append(title)
        
        # Create schedule table
        table_data = []
        
        # Add header row
        headers = ['Employee']
        current_date = start_date
        while current_date <= end_date:
            if current_date.weekday() < 6:  # Monday-Saturday
                headers.append(current_date.strftime('%a %d.%m'))
            current_date += timedelta(days=1)
        table_data.append(headers)
        
        # Add data rows
        employees = Employee.query.filter_by(is_active=True).all()
        for employee in employees:
            row = [f"{employee.first_name} {employee.last_name}"]
            
            current_date = start_date
            while current_date <= end_date:
                if current_date.weekday() < 6:  # Monday-Saturday
                    # Find schedule for this employee and date
                    schedule = next(
                        (s for s in schedules 
                         if s.employee_id == employee.id and s.date == current_date.date()),
                        None
                    )
                    
                    if schedule:
                        shift = Shift.query.get(schedule.shift_id)
                        cell_text = f"{shift.start_time}-{shift.end_time}"
                    else:
                        cell_text = "-"
                    
                    row.append(cell_text)
                current_date += timedelta(days=1)
            
            table_data.append(row)
        
        # Create table
        table = Table(table_data)
        
        # Apply table style
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), layout['table_style']['header_bg_color']),
            ('TEXTCOLOR', (0, 0), (-1, 0), layout['table_style']['header_text_color']),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), layout['fonts']['family']),
            ('FONTSIZE', (0, 0), (-1, 0), layout['fonts']['header_size']),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), layout['table_style']['text_color']),
            ('FONTNAME', (0, 1), (-1, -1), layout['fonts']['family']),
            ('FONTSIZE', (0, 1), (-1, -1), layout['fonts']['size']),
            ('GRID', (0, 0), (-1, -1), 1, layout['table_style']['border_color']),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ])
        table.setStyle(style)
        
        story.append(table)
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer 