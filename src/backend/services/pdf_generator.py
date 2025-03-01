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
from reportlab.lib.colors import black, Color
import math
from models import Schedule, Settings
import io


class PDFGenerator:
    def __init__(self):
        self.settings = Settings.query.first()
        if not self.settings:
            self.settings = Settings.get_default_settings()

        self.styles = getSampleStyleSheet()
        # Title style matching the image exactly
        self.title_style = ParagraphStyle(
            "CustomTitle",
            parent=self.styles["Heading1"],
            fontSize=11,
            spaceAfter=1,
            alignment=0,  # Left alignment
            leading=13,
            borderWidth=1,
            borderColor=black,
            borderPadding=3,
        )

        # Header style for subtitle
        self.header_style = ParagraphStyle(
            "Header",
            parent=self.styles["Normal"],
            fontSize=10,
            leading=12,
            alignment=0,  # Left alignment
            spaceBefore=5,
        )

        # Cell style for table content
        self.cell_style = ParagraphStyle(
            "Cell",
            parent=self.styles["Normal"],
            fontSize=9,
            leading=11,
            alignment=1,  # Center alignment
        )

        # Footer style
        self.footer_style = ParagraphStyle(
            "Footer",
            parent=self.styles["Normal"],
            fontSize=9,
            leading=11,
            spaceBefore=2,
            spaceAfter=1,
        )

    def header_footer(self, canvas, doc, start_date, end_date):
        """Draw header and footer on each page"""
        canvas.saveState()

        # Header section
        title_text = "Mitarbeiter-Einsatz-Planung (MEP)"
        canvas.setFont("Helvetica-Bold", 11)
        canvas.rect(
            doc.leftMargin, doc.height - 15 * mm, 60 * mm, 8 * mm
        )  # Border for title
        canvas.drawString(doc.leftMargin + 3 * mm, doc.height - 10 * mm, title_text)

        subtitle_text = (
            f"Filiale: {self.settings.store_name}    "
            f"Monat/Jahr: {start_date.strftime('%B %Y')}    "
            f"Woche vom: {start_date.strftime('%d.%m.%y')} "
            f"bis: {end_date.strftime('%d.%m.%y')}    "
            f"Aufbewahrung in der Filiale: 2 Jahre"
        )
        canvas.setFont("Helvetica", 10)
        canvas.drawString(doc.leftMargin, doc.height - 20 * mm, subtitle_text)

        # Footer section
        footer_y = 25 * mm  # Start position from bottom
        canvas.setFont("Helvetica", 9)
        footer_texts = [
            "h : 60 Minuten",
            "Anwesenheiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.",
            "Am Ende der Woche: wöchentliche und monatliche Summe eintragen.",
            "Abwesenheiten: Feiertag, Krankheit (AU-Bescheinigung), Freizeit, Schule (Führungsnachweis), Urlaub",
        ]

        for text in footer_texts:
            canvas.drawString(doc.leftMargin, footer_y, text)
            footer_y += 4 * mm

        # Page number
        page_num = canvas.getPageNumber()
        canvas.drawRightString(
            doc.width + doc.rightMargin, 10 * mm, f"Seite {page_num}"
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
            # Fixed A4 Landscape with specific margins
            page_size = landscape(A4)
            margins = {
                "leftMargin": 20 * mm,
                "rightMargin": 20 * mm,
                "topMargin": 30 * mm,  # Increased for header
                "bottomMargin": 40 * mm,  # Increased for footer
            }

            doc = SimpleDocTemplate(buffer, pagesize=page_size, **margins)

            # Create page template with header and footer
            frame = Frame(
                doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal"
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
            # Apply the template to all pages
            story.append(NextPageTemplate("main_template"))

            # Table headers with exact formatting
            headers = [
                Paragraph("Name, Vorname", self.cell_style),
                Paragraph("Position", self.cell_style),
                Paragraph("Plan /\nWoche", self.cell_style),
            ]

            # Add day headers with exact date format
            current_date = start_date
            while current_date <= end_date:
                day_header = Paragraph(
                    f"{current_date.strftime('%A')}<br/>{current_date.strftime('%d.%m')}",
                    self.cell_style,
                )
                headers.append(day_header)
                current_date += timedelta(days=1)

            headers.extend(
                [
                    Paragraph("Summe /\nWoche", self.cell_style),
                    Paragraph("Summe /\nMonat", self.cell_style),
                ]
            )

            # Group schedules by employee and create table rows
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

            # Process employee data
            all_rows = []
            for employee_data in employees_schedules.values():
                employee = employee_data["employee"]
                employee_schedules = employee_data["schedules"]

                row = [
                    Paragraph(
                        f"{employee.last_name},<br/>{employee.first_name}",
                        self.cell_style,
                    ),
                    Paragraph(
                        getattr(employee, "position", employee.employee_group),
                        self.cell_style,
                    ),
                    Paragraph(f"{employee.contracted_hours}:00", self.cell_style),
                ]

                current_date = start_date
                weekly_hours = 0

                while current_date <= end_date:
                    schedule = next(
                        (
                            s
                            for s in employee_schedules
                            if s.date == current_date.date()
                        ),
                        None,
                    )

                    if schedule and hasattr(schedule, "shift") and schedule.shift:
                        shift = schedule.shift
                        cell_lines = [
                            f"Beginn: {shift.start_time}",
                            "Pause:",
                            f"Ende: {shift.end_time}",
                            f"Summe/Tag: {shift.duration_hours:.2f}",
                        ]
                        row.append(Paragraph("<br/>".join(cell_lines), self.cell_style))
                        weekly_hours += shift.duration_hours
                    else:
                        row.append("")

                    current_date += timedelta(days=1)

                row.extend(
                    [
                        Paragraph(f"{weekly_hours:.2f}", self.cell_style),
                        Paragraph(f"{weekly_hours * 4.33:.2f}", self.cell_style),
                    ]
                )
                all_rows.append(row)

            # Split rows into pages of 9 rows each
            rows_per_page = 9
            total_pages = math.ceil(len(all_rows) / rows_per_page)

            for page in range(total_pages):
                start_idx = page * rows_per_page
                end_idx = min(start_idx + rows_per_page, len(all_rows))
                page_rows = all_rows[start_idx:end_idx]

                # Add empty rows to reach 9 rows if needed
                while len(page_rows) < rows_per_page:
                    page_rows.append([""] * len(headers))

                # Create table for this page
                table_data = [headers] + page_rows

                # Column widths
                col_widths = [
                    40 * mm,  # Name
                    20 * mm,  # Position
                    25 * mm,  # Plan/Woche
                    30 * mm,  # Monday
                    30 * mm,  # Tuesday
                    30 * mm,  # Wednesday
                    30 * mm,  # Thursday
                    30 * mm,  # Friday
                    30 * mm,  # Saturday
                    30 * mm,  # Sunday
                    25 * mm,  # Weekly sum
                    25 * mm,  # Monthly sum
                ]

                # Create table with fixed row heights
                row_heights = [15 * mm] + [25 * mm] * rows_per_page
                table = Table(
                    table_data,
                    colWidths=col_widths,
                    rowHeights=row_heights,
                    repeatRows=1,
                )

                # Table style
                table_style = TableStyle(
                    [
                        # Outer border - thick black line
                        ("BOX", (0, 0), (-1, -1), 1.5, black),
                        # Header formatting
                        ("BACKGROUND", (0, 0), (-1, 0), Color(0.95, 0.95, 0.95)),
                        ("TEXTCOLOR", (0, 0), (-1, 0), black),
                        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, 0), 9),
                        ("TOPPADDING", (0, 0), (-1, 0), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
                        # Grid lines - thinner black lines
                        ("GRID", (0, 0), (-1, -1), 0.5, black),
                        # Content formatting
                        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                        ("FONTSIZE", (0, 1), (-1, -1), 9),
                        ("ALIGN", (0, 1), (0, -1), "LEFT"),
                        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("TOPPADDING", (0, 1), (-1, -1), 5),
                        # Specific column alignments
                        ("ALIGN", (2, 1), (2, -1), "CENTER"),
                        ("ALIGN", (-2, 1), (-1, -1), "CENTER"),
                    ]
                )

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
