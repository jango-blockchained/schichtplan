from datetime import datetime, timedelta
from typing import List
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    PageTemplate,
    Frame,
    NextPageTemplate,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import black
import math
from models import Schedule, Settings
import io


class PDFGenerator:
    def __init__(self):
        self.settings = Settings.query.first()
        if not self.settings:
            self.settings = Settings.get_default_settings()

        self.styles = getSampleStyleSheet()

        # Adjust cell style for better readability
        self.cell_style = ParagraphStyle(
            "Cell",
            parent=self.styles["Normal"],
            fontSize=5,  # Smaller font for cells
            leading=8,
            alignment=1,  # Center alignment
        )

        # Header cell style for column headers
        self.header_cell_style = ParagraphStyle(
            "HeaderCell",
            parent=self.styles["Normal"],
            fontSize=5,  # Smaller font for headers
            leading=8,
            alignment=1,  # Center alignment
            fontName="Helvetica-Bold",
        )

        # Name cell style for employee names
        self.name_cell_style = ParagraphStyle(
            "NameCell",
            parent=self.styles["Normal"],
            fontSize=6,  # Smaller font for names
            leading=10,
            alignment=0,  # Left alignment
        )

    def header_footer(self, canvas, doc, start_date, end_date):
        """Draw header and footer on each page"""
        canvas.saveState()

        # --- HEADER SECTION ---

        # Set measurements
        page_width = landscape(A4)[0]
        header_y = doc.height + doc.topMargin  # Top of the page

        # First draw a border box for the title
        title_box_height = 10 * mm
        title_box_width = page_width - doc.leftMargin - doc.rightMargin

        # Draw the box
        canvas.rect(
            doc.leftMargin,
            header_y - title_box_height,
            title_box_width,
            title_box_height,
        )

        # Draw the title text - ADJUSTED FONT SIZE
        title_text = "Mitarbeiter-Einsatz-Planung (MEP)"
        canvas.setFont("Helvetica-Bold", 10)  # Reduced from 12 to 10
        canvas.drawString(doc.leftMargin + 5 * mm, header_y - 7 * mm, title_text)

        # Draw the info text below the title - ADJUSTED FONT SIZE
        info_y = header_y - title_box_height - 6 * mm
        canvas.setFont("Helvetica", 8)  # Reduced from 9 to 8

        # Format date strings
        month_year = start_date.strftime("%B %Y")
        week_range = (
            f"{start_date.strftime('%d.%m.%y')} bis: {end_date.strftime('%d.%m.%y')}"
        )

        # Position the four information elements
        canvas.drawString(
            doc.leftMargin, info_y, f"Filiale: {self.settings.store_name}"
        )
        canvas.drawString(doc.leftMargin + 80 * mm, info_y, f"Monat/Jahr: {month_year}")
        canvas.drawString(doc.leftMargin + 160 * mm, info_y, f"Woche vom: {week_range}")
        canvas.drawString(
            doc.leftMargin + 240 * mm, info_y, "Aufbewahrung in der Filiale: 2 Jahre"
        )

        # --- FOOTER SECTION - ADJUSTED FONT SIZE ---

        footer_y = 20 * mm
        canvas.setFont("Helvetica", 8)  # Reduced from 9 to 8

        footer_texts = [
            "h : 60 Minuten",
            "Anwesenheiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.",
            "Am Ende der Woche: wöchentliche und monatliche Summe eintragen.",
            "Abwesenheiten: Feiertag, Krankheit (AU-Bescheinigung), Freizeit, Schule (Führungsnachweis), Urlaub",
        ]

        for text in footer_texts:
            canvas.drawString(doc.leftMargin, footer_y, text)
            footer_y += 5 * mm

        # Page number - ADJUSTED FONT SIZE
        page_num = canvas.getPageNumber()
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(
            page_width - doc.rightMargin, 15 * mm, f"Seite {page_num}"
        )

        canvas.restoreState()

    def generate_schedule_pdf(
        self,
        schedules: List[Schedule],
        start_date: datetime,
        end_date: datetime,
        layout_config=None,
    ) -> io.BytesIO:
        """Generate a PDF schedule in MEP format"""
        buffer = io.BytesIO()

        try:
            # Increased top margin to make room for the header
            page_size = landscape(A4)
            margins = {
                "leftMargin": 15 * mm,
                "rightMargin": 15 * mm,
                "topMargin": 35 * mm,  # Increased to make room for header
                "bottomMargin": 35 * mm,  # Increased for footer
            }

            doc = SimpleDocTemplate(buffer, pagesize=page_size, **margins)

            frame = Frame(
                doc.leftMargin,
                doc.bottomMargin,
                doc.width,
                doc.height,
                id="normal",
                leftPadding=0,
                rightPadding=0,
                topPadding=0,
                bottomPadding=0,
            )

            template = PageTemplate(
                id="main_template",
                frames=[frame],
                onPage=lambda canvas, doc: self.header_footer(
                    canvas, doc, start_date, end_date
                ),
            )
            doc.addPageTemplates([template])

            story = []
            story.append(NextPageTemplate("main_template"))

            # Group schedules by employee
            employees_schedules = {}
            for schedule in schedules:
                if not hasattr(schedule, "employee_id") or not schedule.employee_id:
                    continue
                if not hasattr(schedule, "employee") or not schedule.employee:
                    continue
                if schedule.employee_id not in employees_schedules:
                    employees_schedules[schedule.employee_id] = {
                        "employee": schedule.employee,
                        "schedules": [],
                    }
                employees_schedules[schedule.employee_id]["schedules"].append(schedule)

            # 8 employees per page
            employees_per_page = 8
            total_pages = math.ceil(len(employees_schedules) / employees_per_page)
            employee_items = list(employees_schedules.items())

            for page in range(total_pages):
                start_idx = page * employees_per_page
                end_idx = min(start_idx + employees_per_page, len(employee_items))
                page_employees = employee_items[start_idx:end_idx]

                # Create table data structure - NO HEADER INFO
                table_data = []

                # First row: Column headers only
                header_row1 = [
                    Paragraph("Name,<br/>Vorname", self.header_cell_style),
                    Paragraph("Position", self.header_cell_style),
                    Paragraph("Plan /<br/>Woche", self.header_cell_style),
                ]

                # Add day headers with dates
                days = [
                    "Montag",
                    "Dienstag",
                    "Mittwoch",
                    "Donnerstag",
                    "Freitag",
                    "Samstag",
                    "Sonntag",
                ]
                for i in range(min(7, (end_date - start_date).days + 1)):
                    day_date = (start_date + timedelta(days=i)).strftime("%d.%m")
                    header_row1.append(
                        Paragraph(f"{days[i]}<br/>{day_date}", self.header_cell_style)
                    )
                    # Each day spans 4 columns
                    header_row1.extend(["", "", ""])

                header_row1.extend(
                    [
                        Paragraph("Summe /<br/>Woche", self.header_cell_style),
                        Paragraph("Summe /<br/>Monat", self.header_cell_style),
                    ]
                )

                table_data.append(header_row1)

                # Second row: Begin/Pause/Ende/Summe headers
                header_row2 = ["", "", ""]

                for _ in range(min(7, (end_date - start_date).days + 1)):
                    header_row2.extend(
                        [
                            Paragraph("Beginn", self.header_cell_style),
                            Paragraph("Pause", self.header_cell_style),
                            Paragraph("Ende", self.header_cell_style),
                            Paragraph("Summe<br/>/ Tag", self.header_cell_style),
                        ]
                    )

                header_row2.extend(["", ""])
                table_data.append(header_row2)

                # Add employee rows
                for employee_id, employee_data in page_employees:
                    employee = employee_data["employee"]
                    employee_schedules = employee_data["schedules"]

                    # Format employee name and position
                    emp_row = [
                        Paragraph(
                            f"{employee.last_name},<br/>{employee.first_name}",
                            self.name_cell_style,
                        ),
                        Paragraph(
                            f"{getattr(employee, 'position', employee.employee_group)}",
                            self.cell_style,
                        ),
                        Paragraph(f"{employee.contracted_hours}:00", self.cell_style),
                    ]

                    # Track weekly hours
                    weekly_hours = 0

                    # Add schedule data for each day
                    for day_index in range(min(7, (end_date - start_date).days + 1)):
                        current_date = start_date + timedelta(days=day_index)
                        date_str = current_date.strftime("%Y-%m-%d")

                        # Find schedule for this day
                        schedule = next(
                            (
                                s
                                for s in employee_schedules
                                if s.date.strftime("%Y-%m-%d") == date_str
                            ),
                            None,
                        )

                        if schedule and hasattr(schedule, "shift") and schedule.shift:
                            shift = schedule.shift

                            # Format times
                            start_time = (
                                shift.start_time if hasattr(shift, "start_time") else ""
                            )
                            pause_time = ""  # You could add this to your model
                            end_time = (
                                shift.end_time if hasattr(shift, "end_time") else ""
                            )

                            # Calculate daily hours
                            duration = (
                                shift.duration_hours
                                if hasattr(shift, "duration_hours")
                                else 0
                            )
                            weekly_hours += duration

                            # Format daily sum
                            hours = int(duration)
                            minutes = int((duration - hours) * 60)
                            daily_sum = f"{hours:02d}:{minutes:02d}"

                            # Add shift data
                            emp_row.extend(
                                [
                                    start_time,
                                    pause_time,
                                    end_time,
                                    daily_sum,
                                ]
                            )
                        else:
                            # Empty cells if no schedule
                            emp_row.extend(["", "", "", ""])

                    # Format weekly and monthly totals
                    weekly_hours_int = int(weekly_hours)
                    weekly_minutes = int((weekly_hours - weekly_hours_int) * 60)
                    weekly_total = f"{weekly_hours_int:02d}:{weekly_minutes:02d}"

                    monthly_hours = weekly_hours * 4.33  # Approximate monthly hours
                    monthly_hours_int = int(monthly_hours)
                    monthly_minutes = int((monthly_hours - monthly_hours_int) * 60)
                    monthly_total = f"{monthly_hours_int:02d}:{monthly_minutes:02d}"

                    emp_row.extend(
                        [
                            weekly_total,
                            monthly_total,
                        ]
                    )

                    table_data.append(emp_row)

                # Add empty rows to reach 8 employees per page
                while len(table_data) < 10:  # 2 header rows + 8 employees
                    empty_row = [""] * len(table_data[0])
                    table_data.append(empty_row)

                # Calculate column widths
                num_days = min(7, (end_date - start_date).days + 1)

                col_widths = [
                    30 * mm,  # Name
                    20 * mm,  # Position
                    20 * mm,  # Plan/Woche
                ]

                # Day columns
                day_col_width = 15 * mm
                for _ in range(num_days):
                    col_widths.extend([day_col_width] * 4)

                # Summary columns
                col_widths.extend(
                    [
                        20 * mm,  # Weekly sum
                        20 * mm,  # Monthly sum
                    ]
                )

                # Row heights - ADJUSTED FOR SMALLER FONT
                row_heights = [8 * mm, 8 * mm] + [14 * mm] * (len(table_data) - 2)

                # Create table
                table = Table(
                    table_data,
                    colWidths=col_widths,
                    rowHeights=row_heights,
                    repeatRows=2,
                )

                # Create style commands
                style_commands = [
                    # Outer border
                    ("BOX", (0, 0), (-1, -1), 1, black),
                    # Inner grid
                    ("GRID", (0, 0), (-1, -1), 0.5, black),
                    # Header formatting - removed font settings as they're in the style now
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    # Employee data
                    ("ALIGN", (0, 2), (0, -1), "LEFT"),  # Left align names
                ]

                # Add spans for day headers
                col = 3
                for _ in range(num_days):
                    style_commands.append(("SPAN", (col, 0), (col + 3, 0)))
                    col += 4

                # Create table style
                table_style = TableStyle(style_commands)
                table.setStyle(table_style)

                story.append(table)

                # Add page break if not the last page
                if page < total_pages - 1:
                    story.append(NextPageTemplate("main_template"))
                    story.append(Spacer(0, 0))  # Force page break

            # Build PDF
            doc.build(story)
            buffer.seek(0)
            return buffer

        except Exception as e:
            import traceback

            print(f"Error generating PDF: {str(e)}")
            print(traceback.format_exc())
            raise
