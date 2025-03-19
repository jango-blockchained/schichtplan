from datetime import datetime, timedelta
from typing import List
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    PageTemplate,
    Frame,
    NextPageTemplate,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import black
import io
from models import Schedule, Settings


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
            fontSize=8,  # Increased font size for better readability
            leading=10,
            alignment=1,  # Center alignment
        )

        # Header cell style for column headers
        self.header_cell_style = ParagraphStyle(
            "HeaderCell",
            parent=self.styles["Normal"],
            fontSize=8,  # Increased font size
            leading=10,
            alignment=1,  # Center alignment
            fontName="Helvetica-Bold",
        )

        # Name cell style for employee names
        self.name_cell_style = ParagraphStyle(
            "NameCell",
            parent=self.styles["Normal"],
            fontSize=8,  # Increased font size
            leading=10,
            alignment=0,  # Left alignment
        )

    def header_footer(self, canvas, doc, start_date, end_date):
        """Draw header and footer on each page"""
        canvas.saveState()

        # --- HEADER SECTION ---
        page_width = landscape(A4)[0]
        header_y = doc._pagesize[1] - doc._topMargin

        # Title text
        canvas.setFont("Helvetica-Bold", 12)
        title_text = "Mitarbeiter-Einsatz-Planung (MEP)"
        canvas.drawString(doc.leftMargin, header_y - 10 * mm, title_text)

        # Branch field
        canvas.drawString(
            page_width - doc.rightMargin - 50 * mm, header_y - 10 * mm, "Filiale:"
        )
        canvas.rect(
            page_width - doc.rightMargin - 30 * mm, header_y - 11 * mm, 25 * mm, 5 * mm
        )

        # Date fields
        info_y = header_y - 20 * mm
        canvas.setFont("Helvetica", 10)

        # Month/Year field
        canvas.drawString(doc.leftMargin, info_y, "Monat/Jahr")
        canvas.rect(doc.leftMargin + 25 * mm, info_y - 1 * mm, 40 * mm, 5 * mm)

        # Week range fields
        canvas.drawString(doc.leftMargin + 80 * mm, info_y, "Woche vom:")
        canvas.rect(doc.leftMargin + 105 * mm, info_y - 1 * mm, 40 * mm, 5 * mm)
        canvas.drawString(doc.leftMargin + 150 * mm, info_y, "bis:")
        canvas.rect(doc.leftMargin + 160 * mm, info_y - 1 * mm, 40 * mm, 5 * mm)

        # Storage note
        canvas.drawString(
            doc.leftMargin + 210 * mm, info_y, "Aufbewahrung in der Filiale: 2 Jahre"
        )

        # --- FOOTER SECTION ---
        footer_y = 25 * mm
        canvas.setFont("Helvetica", 8)

        # Break times
        canvas.drawString(doc.leftMargin, footer_y, "Pausenzeiten:")
        canvas.drawString(
            doc.leftMargin + 20 * mm, footer_y, "bis 6 Stunden : keine Pause"
        )
        canvas.drawString(
            doc.leftMargin + 20 * mm,
            footer_y - 4 * mm,
            "mehr als 6 Stunden : 60 Minuten",
        )

        # Absences
        canvas.drawString(doc.leftMargin, footer_y - 12 * mm, "Abwesenheiten:")
        absences = [
            "Feiertag",
            "Freizeit",
            "Krankheit (AU-Bescheinigung)",
            "Schule (Führungsnachwuchskraft)",
            "Urlaub",
        ]
        x_pos = doc.leftMargin + 20 * mm
        for absence in absences:
            canvas.drawString(x_pos, footer_y - 12 * mm, absence)
            x_pos += 45 * mm

        # Attendance note
        canvas.drawString(
            doc.leftMargin,
            footer_y - 20 * mm,
            "Anwesenheiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen. Am Ende der Woche: wöchentliche und monatliche Summe eintragen.",
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
            page_size = landscape(A4)
            margins = {
                "leftMargin": 15 * mm,
                "rightMargin": 15 * mm,
                "topMargin": 35 * mm,
                "bottomMargin": 35 * mm,
            }

            doc = SimpleDocTemplate(buffer, pagesize=page_size, **margins)

            frame = Frame(
                margins["leftMargin"],
                margins["bottomMargin"],
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

            # Create table data structure
            table_data = []

            # First row: Name, Function, Plan/Week, Days, Sums
            header_row1 = [
                Paragraph("Name, Vorname", self.header_cell_style),
                Paragraph("Funktion", self.header_cell_style),
                Paragraph("Plan / Woche", self.header_cell_style),
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
            for i in range(7):
                day_date = (start_date + timedelta(days=i)).strftime("%d.%m")
                header_row1.append(
                    Paragraph(f"{days[i]}<br/>{day_date}", self.header_cell_style)
                )
                # Each day spans 3 columns (Beginn, Pause, Ende)
                header_row1.extend(["", "", ""])

            header_row1.extend(
                [
                    Paragraph("Summe /<br/>Woche", self.header_cell_style),
                    Paragraph("Summe /<br/>Monat", self.header_cell_style),
                ]
            )
            table_data.append(header_row1)

            # Second row: Warentag
            warentag_row = ["", "", ""]
            for _ in range(7):
                warentag_row.append(Paragraph("Warentag", self.header_cell_style))
                warentag_row.extend(["", "", ""])
            warentag_row.extend(["", ""])
            table_data.append(warentag_row)

            # Third row: Time headers
            time_headers = ["", "", ""]
            for _ in range(7):
                time_headers.extend(
                    [
                        Paragraph("Beginn", self.header_cell_style),
                        Paragraph("Pause", self.header_cell_style),
                        Paragraph("Ende", self.header_cell_style),
                        Paragraph("Summe / Tag", self.header_cell_style),
                    ]
                )
            time_headers.extend(["", ""])
            table_data.append(time_headers)

            # Add employee rows
            for employee_id, employee_data in employees_schedules.items():
                employee = employee_data["employee"]
                employee_schedules = employee_data["schedules"]

                # Basic employee info
                emp_row = [
                    Paragraph(
                        f"{employee.last_name}, {employee.first_name}",
                        self.name_cell_style,
                    ),
                    Paragraph(
                        str(getattr(employee, "position", employee.employee_group)),
                        self.cell_style,
                    ),
                    Paragraph(f"{employee.contracted_hours}:00", self.cell_style),
                ]

                # Add schedule data for each day
                weekly_hours = 0
                for day_index in range(7):
                    current_date = start_date + timedelta(days=day_index)
                    date_str = current_date.strftime("%Y-%m-%d")

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
                        start_time = (
                            shift.start_time.strftime("%H:%M")
                            if shift.start_time
                            else ""
                        )
                        end_time = (
                            shift.end_time.strftime("%H:%M") if shift.end_time else ""
                        )

                        # Calculate daily hours
                        if shift.start_time and shift.end_time:
                            duration = (
                                shift.end_time.hour
                                - shift.start_time.hour
                                + (shift.end_time.minute - shift.start_time.minute) / 60
                            )
                            weekly_hours += duration
                            hours = int(duration)
                            minutes = int((duration - hours) * 60)
                            daily_sum = f"{hours:02d}:{minutes:02d}"
                        else:
                            daily_sum = ""

                        emp_row.extend(
                            [
                                Paragraph(start_time, self.cell_style),
                                Paragraph("", self.cell_style),  # Pause
                                Paragraph(end_time, self.cell_style),
                                Paragraph(daily_sum, self.cell_style),
                            ]
                        )
                    else:
                        emp_row.extend(["", "", "", ""])

                # Add weekly and monthly sums
                weekly_hours_int = int(weekly_hours)
                weekly_minutes = int((weekly_hours - weekly_hours_int) * 60)
                monthly_hours = weekly_hours * 4.33  # Approximate monthly hours
                monthly_hours_int = int(monthly_hours)
                monthly_minutes = int((monthly_hours - monthly_hours_int) * 60)

                emp_row.extend(
                    [
                        Paragraph(
                            f"{weekly_hours_int:02d}:{weekly_minutes:02d}",
                            self.cell_style,
                        ),
                        Paragraph(
                            f"{monthly_hours_int:02d}:{monthly_minutes:02d}",
                            self.cell_style,
                        ),
                    ]
                )

                table_data.append(emp_row)

            # Create the table with the data
            col_widths = [
                30 * mm,  # Name
                25 * mm,  # Function
                20 * mm,  # Plan/Week
            ]
            # Add widths for each day (4 columns per day)
            for _ in range(7):
                col_widths.extend([15 * mm, 15 * mm, 15 * mm, 15 * mm])
            # Add widths for weekly and monthly sums
            col_widths.extend([20 * mm, 20 * mm])

            table = Table(table_data, colWidths=col_widths, repeatRows=3)

            # Add table style
            table_style = TableStyle(
                [
                    # Grid
                    ("GRID", (0, 0), (-1, -1), 0.5, black),
                    ("BOX", (0, 0), (-1, -1), 1, black),
                    # Vertical alignment
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    # Specific column alignments
                    ("ALIGN", (0, 0), (0, -1), "LEFT"),  # Name column
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),  # All other columns
                    # Row heights
                    ("ROWHEIGHT", 0, 0, 15 * mm),  # Header row
                    ("ROWHEIGHT", 1, 1, 10 * mm),  # Warentag row
                    ("ROWHEIGHT", 2, 2, 10 * mm),  # Time headers
                    ("ROWHEIGHT", 3, -1, 12 * mm),  # Data rows
                ]
            )

            table.setStyle(table_style)
            story.append(table)

            # Build the PDF
            doc.build(story)
            buffer.seek(0)
            return buffer

        except Exception as e:
            import traceback

            print(f"Error generating PDF: {str(e)}")
            print(traceback.format_exc())
            raise
