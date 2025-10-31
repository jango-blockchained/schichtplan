"""
Vacation Planning PDF Generator for German vacation management forms.

This module generates various PDF forms for vacation planning:
1. Admin yearly vacation planning form
2. Employee vacation request form
3. Comprehensive overview form (all employees)
4. Yearly calendar view (6 months per page with rotated text)
"""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.colors import black, lightgrey, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from ..models import Absence, Employee, Settings


class VacationPDFGenerator:
    """
    Generator for vacation planning PDF documents.

    Creates various forms for vacation planning and management.
    """

    # DIN A4 dimensions
    PAGE_WIDTH_PORTRAIT = A4[0]
    PAGE_HEIGHT_PORTRAIT = A4[1]
    PAGE_WIDTH_LANDSCAPE = landscape(A4)[0]
    PAGE_HEIGHT_LANDSCAPE = landscape(A4)[1]

    # Margins
    MARGIN = 15 * mm

    # Font sizes
    TITLE_FONT_SIZE = 14
    HEADER_FONT_SIZE = 10
    NORMAL_FONT_SIZE = 9
    SMALL_FONT_SIZE = 7

    def __init__(self):
        """Initialize the vacation PDF generator."""
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        self.title_style = ParagraphStyle(
            "VacationTitle",
            parent=self.styles["Normal"],
            fontSize=self.TITLE_FONT_SIZE,
            fontName="Helvetica-Bold",
            alignment=1,  # Center
            spaceAfter=12,
        )

        self.header_style = ParagraphStyle(
            "VacationHeader",
            parent=self.styles["Normal"],
            fontSize=self.HEADER_FONT_SIZE,
            fontName="Helvetica-Bold",
            alignment=0,  # Left
            spaceAfter=6,
        )

        self.normal_style = ParagraphStyle(
            "VacationNormal",
            parent=self.styles["Normal"],
            fontSize=self.NORMAL_FONT_SIZE,
            fontName="Helvetica",
            alignment=0,  # Left
        )

        self.small_style = ParagraphStyle(
            "VacationSmall",
            parent=self.styles["Normal"],
            fontSize=self.SMALL_FONT_SIZE,
            fontName="Helvetica",
            alignment=0,  # Left
        )

    def generate_admin_yearly_form(
        self,
        year: int,
        employees: list[Employee],
        absences: list[Absence],
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate admin yearly vacation planning form.

        This form is used by administrators to plan and track yearly vacations
        for all employees, including approval status and remaining vacation days.

        Args:
            year: The year for vacation planning
            employees: List of employees
            absences: List of vacation absences for the year
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(
            Paragraph(
                f"Urlaubsplanung {year} - Administratorformular", self.title_style
            )
        )
        story.append(Spacer(1, 10))

        # Store info if available
        if settings:
            info_text = f"<b>Filiale:</b> {settings.store_name}"
            if settings.store_address:
                info_text += f" | <b>Adresse:</b> {settings.store_address}"
            story.append(Paragraph(info_text, self.normal_style))
            story.append(Spacer(1, 15))

        # Create vacation overview table
        # Group absences by employee
        employee_vacations = {}
        for absence in absences:
            if absence.absence_type_id == "vacation":
                emp_id = absence.employee_id
                if emp_id not in employee_vacations:
                    employee_vacations[emp_id] = []
                employee_vacations[emp_id].append(absence)

        # Table headers
        table_data = [
            [
                Paragraph("<b>Mitarbeiter</b>", self.normal_style),
                Paragraph("<b>Personal-Nr.</b>", self.normal_style),
                Paragraph("<b>Jahres-<br/>anspruch</b>", self.normal_style),
                Paragraph("<b>Genommen</b>", self.normal_style),
                Paragraph("<b>Geplant</b>", self.normal_style),
                Paragraph("<b>Verbleibend</b>", self.normal_style),
                Paragraph("<b>Status</b>", self.normal_style),
                Paragraph("<b>Bemerkungen</b>", self.normal_style),
            ]
        ]

        # Add employee rows
        for employee in sorted(employees, key=lambda e: (e.last_name, e.first_name)):
            emp_absences = employee_vacations.get(employee.id, [])

            # Calculate taken days (approved)
            taken_days = sum(
                (abs.end_date - abs.start_date).days + 1
                for abs in emp_absences
                if abs.status == "approved" and abs.end_date < datetime.now().date()
            )

            # Calculate planned days (approved but future)
            planned_days = sum(
                (abs.end_date - abs.start_date).days + 1
                for abs in emp_absences
                if abs.status == "approved" and abs.end_date >= datetime.now().date()
            )

            # Calculate remaining days
            total_entitlement = employee.vacation_per_year or 30
            remaining_days = total_entitlement - taken_days - planned_days

            # Determine status
            if remaining_days < 0:
                status = "Überbucht"
                status_color = colors.red
            elif remaining_days == 0:
                status = "Voll"
                status_color = colors.orange
            else:
                status = "OK"
                status_color = colors.green

            table_data.append(
                [
                    f"{employee.last_name}, {employee.first_name}",
                    employee.employee_id,
                    str(total_entitlement),
                    str(taken_days),
                    str(planned_days),
                    str(remaining_days),
                    status,
                    "",  # Remarks column for manual notes
                ]
            )

        # Create table
        col_widths = [
            50 * mm,
            25 * mm,
            20 * mm,
            20 * mm,
            20 * mm,
            25 * mm,
            20 * mm,
            70 * mm,
        ]
        table = Table(table_data, colWidths=col_widths, repeatRows=1)

        # Table style
        table_style = TableStyle(
            [
                # Header
                ("BACKGROUND", (0, 0), (-1, 0), lightgrey),
                ("TEXTCOLOR", (0, 0), (-1, 0), black),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), self.NORMAL_FONT_SIZE),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                # Body
                ("ALIGN", (2, 1), (6, -1), "CENTER"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), self.SMALL_FONT_SIZE),
                ("GRID", (0, 0), (-1, -1), 0.5, black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [white, colors.Color(0.95, 0.95, 0.95)],
                ),
            ]
        )

        table.setStyle(table_style)
        story.append(table)

        # Footer with instructions
        story.append(Spacer(1, 15))
        story.append(Paragraph("<b>Hinweise:</b>", self.header_style))
        story.append(
            Paragraph(
                "• Jahresanspruch gemäß Arbeitsvertrag<br/>"
                "• Genommen: Bereits genommener Urlaub (genehmigt und vergangen)<br/>"
                "• Geplant: Genehmigter aber zukünftiger Urlaub<br/>"
                "• Verbleibend: Noch verfügbare Urlaubstage<br/>"
                "• Bitte prüfen Sie regelmäßig die Urlaubsplanung und achten Sie auf "
                "ausreichende Personaldeckung",
                self.small_style,
            )
        )

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_employee_request_form(
        self,
        employee: Employee,
        absence: Absence | None = None,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate employee vacation request form.

        This form is filled out by employees to request vacation time.
        Includes fields for signatures and dates.

        Args:
            employee: Employee requesting vacation
            absence: Optional existing absence to pre-fill
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(Paragraph("Urlaubsantrag", self.title_style))
        story.append(Spacer(1, 10))

        # Store info
        if settings:
            story.append(
                Paragraph(f"<b>Filiale:</b> {settings.store_name}", self.normal_style)
            )
            story.append(Spacer(1, 15))

        # Employee information section
        story.append(Paragraph("<b>Mitarbeiterdaten</b>", self.header_style))

        emp_data = [
            ["Name:", f"{employee.first_name} {employee.last_name}"],
            ["Personal-Nr.:", employee.employee_id],
            ["E-Mail:", employee.email or ""],
            ["Jahresurlaubsanspruch:", f"{employee.vacation_per_year} Tage"],
        ]

        emp_table = Table(emp_data, colWidths=[50 * mm, 100 * mm])
        emp_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(emp_table)
        story.append(Spacer(1, 20))

        # Vacation request section
        story.append(Paragraph("<b>Urlaubsantrag</b>", self.header_style))

        if absence:
            start_date = absence.start_date.strftime("%d.%m.%Y")
            end_date = absence.end_date.strftime("%d.%m.%Y")
            days = (absence.end_date - absence.start_date).days + 1
            note = absence.note or ""
        else:
            start_date = "_______________"
            end_date = "_______________"
            days = "____"
            note = ""

        request_data = [
            ["Von:", start_date, "Bis:", end_date],
            ["Anzahl Tage:", str(days), "", ""],
            ["Bemerkungen:", note, "", ""],
        ]

        request_table = Table(
            request_data, colWidths=[35 * mm, 55 * mm, 25 * mm, 55 * mm]
        )
        request_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("SPAN", (1, 2), (3, 2)),
                ]
            )
        )
        story.append(request_table)
        story.append(Spacer(1, 30))

        # Signature section for employee
        story.append(Paragraph("<b>Unterschriften</b>", self.header_style))
        story.append(Spacer(1, 10))

        sig_data = [
            ["", ""],
            ["_" * 50, "_" * 50],
            ["Ort, Datum", "Unterschrift Mitarbeiter"],
        ]

        sig_table = Table(sig_data, colWidths=[85 * mm, 85 * mm])
        sig_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 2), (-1, 2), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 30),
                ]
            )
        )
        story.append(sig_table)
        story.append(Spacer(1, 30))

        # Approval section
        story.append(
            Paragraph("<b>Genehmigung durch Vorgesetzten</b>", self.header_style)
        )
        story.append(Spacer(1, 10))

        approval_data = [
            ["☐ Genehmigt", "☐ Abgelehnt"],
            ["", ""],
            ["_" * 50, "_" * 50],
            ["Ort, Datum", "Unterschrift Vorgesetzter"],
        ]

        approval_table = Table(approval_data, colWidths=[85 * mm, 85 * mm])
        approval_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 3), (-1, 3), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, 1), 30),
                ]
            )
        )
        story.append(approval_table)

        # Footer note
        story.append(Spacer(1, 20))
        story.append(
            Paragraph(
                "<i>Hinweis: Dieser Antrag muss mindestens 2 Wochen vor Urlaubsbeginn "
                "eingereicht werden. Die Genehmigung erfolgt unter Vorbehalt der "
                "betrieblichen Erfordernisse.</i>",
                self.small_style,
            )
        )

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_overview_form(
        self,
        employees: list[Employee],
        absences: list[Absence],
        year: int,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate comprehensive overview form with all employees and details.

        Shows all vacation requests, dates, status, and remaining days for
        all employees in a comprehensive table format.

        Args:
            employees: List of all employees
            absences: List of vacation absences
            year: Year to display
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(
            Paragraph(f"Urlaubsübersicht {year} - Alle Mitarbeiter", self.title_style)
        )
        story.append(Spacer(1, 10))

        # Store info and generation date
        info_parts = []
        if settings:
            info_parts.append(f"<b>Filiale:</b> {settings.store_name}")
        info_parts.append(
            f"<b>Erstellt am:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        )
        story.append(Paragraph(" | ".join(info_parts), self.normal_style))
        story.append(Spacer(1, 15))

        # Group absences by employee
        employee_vacations = {}
        for absence in absences:
            if absence.absence_type_id == "vacation":
                emp_id = absence.employee_id
                if emp_id not in employee_vacations:
                    employee_vacations[emp_id] = []
                employee_vacations[emp_id].append(absence)

        # Table headers
        table_data = [
            [
                Paragraph("<b>Nr.</b>", self.small_style),
                Paragraph("<b>Mitarbeiter</b>", self.small_style),
                Paragraph("<b>Pers.-Nr.</b>", self.small_style),
                Paragraph("<b>Anspruch</b>", self.small_style),
                Paragraph("<b>Von</b>", self.small_style),
                Paragraph("<b>Bis</b>", self.small_style),
                Paragraph("<b>Tage</b>", self.small_style),
                Paragraph("<b>Status</b>", self.small_style),
                Paragraph("<b>Verbleib.</b>", self.small_style),
                Paragraph("<b>Bemerkung</b>", self.small_style),
            ]
        ]

        # Add employee rows
        row_num = 1
        for employee in sorted(employees, key=lambda e: (e.last_name, e.first_name)):
            emp_absences = employee_vacations.get(employee.id, [])

            # Calculate total days used
            total_used = sum(
                (abs.end_date - abs.start_date).days + 1
                for abs in emp_absences
                if abs.status == "approved"
            )

            total_entitlement = employee.vacation_per_year or 30
            remaining = total_entitlement - total_used

            if not emp_absences:
                # Employee with no vacation entries
                table_data.append(
                    [
                        str(row_num),
                        f"{employee.last_name}, {employee.first_name}",
                        employee.employee_id,
                        str(total_entitlement),
                        "-",
                        "-",
                        "0",
                        "-",
                        str(remaining),
                        "",
                    ]
                )
                row_num += 1
            else:
                # First absence row for employee
                first_absence = emp_absences[0]
                days = (first_absence.end_date - first_absence.start_date).days + 1

                table_data.append(
                    [
                        str(row_num),
                        f"{employee.last_name}, {employee.first_name}",
                        employee.employee_id,
                        str(total_entitlement),
                        first_absence.start_date.strftime("%d.%m.%y"),
                        first_absence.end_date.strftime("%d.%m.%y"),
                        str(days),
                        self._get_status_text(first_absence.status),
                        str(remaining) if len(emp_absences) == 1 else "",
                        first_absence.note or "",
                    ]
                )
                row_num += 1

                # Additional absence rows for same employee
                for absence in emp_absences[1:]:
                    days = (absence.end_date - absence.start_date).days + 1
                    is_last = absence == emp_absences[-1]

                    table_data.append(
                        [
                            "",
                            "",
                            "",
                            "",
                            absence.start_date.strftime("%d.%m.%y"),
                            absence.end_date.strftime("%d.%m.%y"),
                            str(days),
                            self._get_status_text(absence.status),
                            str(remaining) if is_last else "",
                            absence.note or "",
                        ]
                    )

        # Create table
        col_widths = [
            12 * mm,
            40 * mm,
            20 * mm,
            18 * mm,
            18 * mm,
            18 * mm,
            12 * mm,
            18 * mm,
            18 * mm,
            50 * mm,
        ]
        table = Table(table_data, colWidths=col_widths, repeatRows=1)

        # Table style
        table_style = TableStyle(
            [
                # Header
                ("BACKGROUND", (0, 0), (-1, 0), lightgrey),
                ("TEXTCOLOR", (0, 0), (-1, 0), black),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), self.SMALL_FONT_SIZE),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                # Body
                ("ALIGN", (0, 1), (0, -1), "CENTER"),
                ("ALIGN", (3, 1), (8, -1), "CENTER"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), self.SMALL_FONT_SIZE),
                ("GRID", (0, 0), (-1, -1), 0.5, black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [white, colors.Color(0.95, 0.95, 0.95)],
                ),
            ]
        )

        table.setStyle(table_style)
        story.append(table)

        # Summary statistics
        story.append(Spacer(1, 15))
        total_employees = len(employees)
        total_vacation_days = sum(
            (abs.end_date - abs.start_date).days + 1
            for abs in absences
            if abs.absence_type_id == "vacation" and abs.status == "approved"
        )

        story.append(
            Paragraph(
                f"<b>Zusammenfassung:</b> {total_employees} Mitarbeiter | "
                f"{total_vacation_days} genehmigte Urlaubstage",
                self.normal_style,
            )
        )

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_yearly_calendar(
        self,
        year: int,
        employees: list[Employee],
        absences: list[Absence],
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate yearly calendar with 6 months per page (6 columns).

        Displays vacation periods with rotated text (90°) when multiple
        employees have vacation on the same date range.

        Args:
            year: Year to display
            employees: List of employees
            absences: List of vacation absences
            year: Year for the calendar
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        c = pdf_canvas.Canvas(buffer, pagesize=landscape(A4))

        # Filter vacation absences for the year
        vacation_absences = [
            abs
            for abs in absences
            if abs.absence_type_id == "vacation" and abs.start_date.year == year
        ]

        # Sort absences by date
        vacation_absences.sort(key=lambda x: x.start_date)

        # Create employee name mapping
        emp_map = {emp.id: emp for emp in employees}

        # Draw two pages (Jan-Jun, Jul-Dec)
        for page_num in range(2):
            if page_num > 0:
                c.showPage()

            start_month = 1 + (page_num * 6)
            end_month = start_month + 6

            # Title
            title = f"Urlaubskalender {year} - {'Januar bis Juni' if page_num == 0 else 'Juli bis Dezember'}"
            c.setFont("Helvetica-Bold", 14)
            c.drawCentredString(
                self.PAGE_WIDTH_LANDSCAPE / 2, self.PAGE_HEIGHT_LANDSCAPE - 30, title
            )

            # Store info
            if settings:
                c.setFont("Helvetica", 9)
                c.drawString(
                    self.MARGIN,
                    self.PAGE_HEIGHT_LANDSCAPE - 50,
                    f"Filiale: {settings.store_name}",
                )

            # Calculate column width
            col_width = (self.PAGE_WIDTH_LANDSCAPE - 2 * self.MARGIN) / 6

            # Draw month columns
            for month_idx in range(6):
                month = start_month + month_idx
                if month > 12:
                    break

                x_pos = self.MARGIN + (month_idx * col_width)
                y_pos = self.PAGE_HEIGHT_LANDSCAPE - 80

                # Month header
                month_name = datetime(year, month, 1).strftime("%B")
                c.setFont("Helvetica-Bold", 10)
                c.drawCentredString(x_pos + col_width / 2, y_pos, month_name)

                # Draw calendar grid
                y_pos -= 20

                # Days header
                c.setFont("Helvetica", 7)
                days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
                day_width = col_width / 7

                for day_idx, day_name in enumerate(days):
                    c.drawCentredString(
                        x_pos + (day_idx + 0.5) * day_width, y_pos, day_name
                    )

                # Draw day cells with vacation indicators
                y_pos -= 15
                cell_height = 12

                # Get first day of month and number of days
                first_day = datetime(year, month, 1)
                first_weekday = first_day.weekday()  # 0 = Monday

                # Days in month
                if month == 12:
                    days_in_month = 31
                else:
                    next_month = datetime(year, month + 1, 1)
                    days_in_month = (next_month - first_day).days

                # Draw calendar days
                current_y = y_pos
                day_num = 1

                for week in range(6):  # Max 6 weeks per month
                    if day_num > days_in_month:
                        break

                    for weekday in range(7):
                        if week == 0 and weekday < first_weekday:
                            continue
                        if day_num > days_in_month:
                            break

                        cell_x = x_pos + weekday * day_width
                        cell_y = current_y

                        # Draw cell border
                        c.rect(cell_x, cell_y - cell_height, day_width, cell_height)

                        # Day number
                        c.setFont("Helvetica", 6)
                        c.drawString(cell_x + 2, cell_y - 8, str(day_num))

                        # Check for vacations on this day
                        current_date = datetime(year, month, day_num).date()
                        employees_on_vacation = []

                        for absence in vacation_absences:
                            if absence.start_date <= current_date <= absence.end_date:
                                if absence.employee_id in emp_map:
                                    emp = emp_map[absence.employee_id]
                                    employees_on_vacation.append(emp.employee_id)

                        # Draw vacation indicators
                        if employees_on_vacation:
                            # If multiple employees, use rotated text
                            if len(employees_on_vacation) > 1:
                                c.saveState()
                                c.translate(
                                    cell_x + day_width / 2, cell_y - cell_height + 2
                                )
                                c.rotate(90)
                                c.setFont("Helvetica", 5)
                                text = ",".join(employees_on_vacation[:3])  # Max 3 IDs
                                if len(employees_on_vacation) > 3:
                                    text += "..."
                                c.drawString(0, 0, text)
                                c.restoreState()
                            else:
                                # Single employee, normal text
                                c.setFont("Helvetica", 5)
                                c.setFillColorRGB(0.3, 0.3, 0.8)
                                c.drawCentredString(
                                    cell_x + day_width / 2,
                                    cell_y - cell_height + 3,
                                    employees_on_vacation[0],
                                )
                                c.setFillColorRGB(0, 0, 0)

                        day_num += 1

                    current_y -= cell_height

        # Save PDF
        c.save()
        buffer.seek(0)
        return buffer

    def _get_status_text(self, status: str) -> str:
        """Convert status code to German text."""
        status_map = {
            "requested": "Beantragt",
            "approved": "Genehmigt",
            "declined": "Abgelehnt",
        }
        return status_map.get(status, status)

    def generate_absence_request_form(
        self,
        employee: Employee,
        absence: Absence | None = None,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate employee absence/time-off request form.

        Similar to vacation request but for other absence types.

        Args:
            employee: Employee requesting time off
            absence: Optional existing absence to pre-fill
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(Paragraph("Abwesenheitsantrag", self.title_style))
        story.append(Spacer(1, 10))

        # Store info
        if settings:
            story.append(
                Paragraph(f"<b>Filiale:</b> {settings.store_name}", self.normal_style)
            )
            story.append(Spacer(1, 15))

        # Employee information section
        story.append(Paragraph("<b>Mitarbeiterdaten</b>", self.header_style))

        emp_data = [
            ["Name:", f"{employee.first_name} {employee.last_name}"],
            ["Personal-Nr.:", employee.employee_id],
            ["E-Mail:", employee.email or ""],
        ]

        emp_table = Table(emp_data, colWidths=[50 * mm, 100 * mm])
        emp_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(emp_table)
        story.append(Spacer(1, 20))

        # Absence request section
        story.append(Paragraph("<b>Abwesenheitsantrag</b>", self.header_style))

        if absence:
            start_date = absence.start_date.strftime("%d.%m.%Y")
            end_date = absence.end_date.strftime("%d.%m.%Y")
            days = (absence.end_date - absence.start_date).days + 1
            absence_type = absence.absence_type_id or "Sonstige"
            note = absence.note or ""
        else:
            start_date = "_______________"
            end_date = "_______________"
            days = "____"
            absence_type = ""
            note = ""

        request_data = [
            ["Abwesenheitstyp:", absence_type, "", ""],
            ["Von:", start_date, "Bis:", end_date],
            ["Anzahl Tage:", str(days), "", ""],
            ["Grund:", note, "", ""],
        ]

        request_table = Table(
            request_data, colWidths=[35 * mm, 55 * mm, 25 * mm, 55 * mm]
        )
        request_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(request_table)
        story.append(Spacer(1, 30))

        # Signature section for employee
        story.append(Paragraph("<b>Unterschrift Mitarbeiter</b>", self.header_style))
        story.append(Spacer(1, 10))

        sig_data = [
            ["", ""],
            ["_" * 50, "_" * 50],
            ["Ort, Datum", "Unterschrift Mitarbeiter"],
        ]

        sig_table = Table(sig_data, colWidths=[85 * mm, 85 * mm])
        sig_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 2), (-1, 2), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 30),
                ]
            )
        )
        story.append(sig_table)

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_employee_registration_form(
        self,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate employee registration form.

        Args:
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(Paragraph("Mitarbeiter Registrierungsformular", self.title_style))
        story.append(Spacer(1, 10))

        # Store info
        if settings:
            story.append(
                Paragraph(f"<b>Filiale:</b> {settings.store_name}", self.normal_style)
            )
            story.append(Spacer(1, 15))

        # Personal information
        story.append(Paragraph("<b>Persönliche Daten</b>", self.header_style))
        story.append(
            Paragraph(
                "Vorname: _________________________ "
                "Nachname: _________________________",
                self.normal_style,
            )
        )
        story.append(Spacer(1, 10))

        # Contact information
        story.append(Paragraph("<b>Kontaktdaten</b>", self.header_style))
        story.append(
            Paragraph(
                "E-Mail: _________________________________________________",
                self.normal_style,
            )
        )
        story.append(Spacer(1, 8))
        story.append(
            Paragraph(
                "Telefon: ________________________________________________",
                self.normal_style,
            )
        )
        story.append(Spacer(1, 15))

        # Employment information
        story.append(Paragraph("<b>Anstellungsdaten</b>", self.header_style))
        emp_reg_data = [
            ["Anfangsdatum:", "_______________"],
            ["Position:", "_______________"],
            ["Abteilung:", "_______________"],
            ["Jahresurlaubstage:", "_______________"],
        ]

        emp_reg_table = Table(emp_reg_data, colWidths=[50 * mm, 100 * mm])
        emp_reg_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(emp_reg_table)
        story.append(Spacer(1, 20))

        # Signature section
        story.append(Paragraph("<b>Bestätigung</b>", self.header_style))
        story.append(Spacer(1, 10))

        sig_data = [
            ["", ""],
            ["_" * 50, "_" * 50],
            ["Ort, Datum", "Unterschrift Leiter"],
        ]

        sig_table = Table(sig_data, colWidths=[85 * mm, 85 * mm])
        sig_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 2), (-1, 2), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 30),
                ]
            )
        )
        story.append(sig_table)

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_shift_report_form(
        self,
        employee: Employee,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate shift report form.

        Args:
            employee: Employee for the shift report
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(Paragraph("Schichtbericht", self.title_style))
        story.append(Spacer(1, 10))

        # Store info
        if settings:
            story.append(
                Paragraph(f"<b>Filiale:</b> {settings.store_name}", self.normal_style)
            )
            story.append(Spacer(1, 15))

        # Employee info
        story.append(Paragraph("<b>Mitarbeiterdaten</b>", self.header_style))

        emp_data = [
            ["Name:", f"{employee.first_name} {employee.last_name}"],
            ["Personal-Nr.:", employee.employee_id],
        ]

        emp_table = Table(emp_data, colWidths=[50 * mm, 100 * mm])
        emp_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                ]
            )
        )
        story.append(emp_table)
        story.append(Spacer(1, 20))

        # Shift details
        story.append(Paragraph("<b>Schichtdaten</b>", self.header_style))

        shift_data = [
            ["Datum:", "_______________"],
            ["Schichtbeginn:", "_______________", "Schichtende:", "_______________"],
            ["Pausenzeit:", "_______________", "Pausengrund:", "_______________"],
        ]

        shift_table = Table(shift_data, colWidths=[40 * mm, 50 * mm, 40 * mm, 50 * mm])
        shift_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(shift_table)
        story.append(Spacer(1, 20))

        # Remarks
        story.append(
            Paragraph("<b>Beobachtungen / Besonderheiten</b>", self.header_style)
        )
        story.append(
            Paragraph(
                "_" * 100 + "<br/>" + "_" * 100 + "<br/>" + "_" * 100, self.normal_style
            )
        )
        story.append(Spacer(1, 20))

        # Signature section
        sig_data = [
            ["", ""],
            ["_" * 50, "_" * 50],
            ["Ort, Datum", "Unterschrift Mitarbeiter"],
        ]

        sig_table = Table(sig_data, colWidths=[85 * mm, 85 * mm])
        sig_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 2), (-1, 2), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 30),
                ]
            )
        )
        story.append(sig_table)

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_shift_transfer_form(
        self,
        employee: Employee,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate shift transfer request form.

        Args:
            employee: Employee requesting shift transfer
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(Paragraph("Schicht Übertragungsantrag", self.title_style))
        story.append(Spacer(1, 10))

        # Store info
        if settings:
            story.append(
                Paragraph(f"<b>Filiale:</b> {settings.store_name}", self.normal_style)
            )
            story.append(Spacer(1, 15))

        # Employee info
        story.append(Paragraph("<b>Mitarbeiterdaten</b>", self.header_style))

        emp_data = [
            ["Name:", f"{employee.first_name} {employee.last_name}"],
            ["Personal-Nr.:", employee.employee_id],
        ]

        emp_table = Table(emp_data, colWidths=[50 * mm, 100 * mm])
        emp_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                ]
            )
        )
        story.append(emp_table)
        story.append(Spacer(1, 20))

        # Shift transfer request
        story.append(
            Paragraph("<b>Schicht, die übertragen werden soll</b>", self.header_style)
        )

        transfer_data = [
            ["Datum der Schicht:", "_______________"],
            ["Uhrzeit:", "Von ________ bis ________"],
        ]

        transfer_table = Table(transfer_data, colWidths=[50 * mm, 100 * mm])
        transfer_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(transfer_table)
        story.append(Spacer(1, 20))

        # Transfer to employee
        story.append(Paragraph("<b>Übertragung auf Mitarbeiter</b>", self.header_style))
        story.append(
            Paragraph(
                "Name: ________________________________________________",
                self.normal_style,
            )
        )
        story.append(Spacer(1, 10))
        story.append(
            Paragraph(
                "Personal-Nr.: _________________________________________",
                self.normal_style,
            )
        )
        story.append(Spacer(1, 15))

        # Reason
        story.append(Paragraph("<b>Grund der Übertragung</b>", self.header_style))
        story.append(Paragraph("_" * 100 + "<br/>" + "_" * 100, self.normal_style))
        story.append(Spacer(1, 20))

        # Signature section
        sig_data = [
            ["", ""],
            ["_" * 50, "_" * 50],
            ["Ort, Datum", "Unterschrift"],
        ]

        sig_table = Table(sig_data, colWidths=[85 * mm, 85 * mm])
        sig_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 2), (-1, 2), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 30),
                ]
            )
        )
        story.append(sig_table)

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_expense_report_form(
        self,
        employee: Employee,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate expense report form.

        Args:
            employee: Employee submitting expenses
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(Paragraph("Spesenabrechnung", self.title_style))
        story.append(Spacer(1, 10))

        # Store info
        if settings:
            story.append(
                Paragraph(f"<b>Filiale:</b> {settings.store_name}", self.normal_style)
            )
            story.append(Spacer(1, 15))

        # Employee info
        story.append(Paragraph("<b>Mitarbeiterdaten</b>", self.header_style))

        emp_data = [
            ["Name:", f"{employee.first_name} {employee.last_name}"],
            ["Personal-Nr.:", employee.employee_id],
            ["E-Mail:", employee.email or ""],
        ]

        emp_table = Table(emp_data, colWidths=[50 * mm, 100 * mm])
        emp_table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(emp_table)
        story.append(Spacer(1, 20))

        # Expense table
        story.append(Paragraph("<b>Spesenaufstellung</b>", self.header_style))

        expense_data = [
            [
                Paragraph("<b>Datum</b>", self.normal_style),
                Paragraph("<b>Art der Spesen</b>", self.normal_style),
                Paragraph("<b>Betrag (€)</b>", self.normal_style),
                Paragraph("<b>Belegnr.</b>", self.normal_style),
            ],
            [
                "_______________",
                "_______________",
                "_______________",
                "_______________",
            ],
            [
                "_______________",
                "_______________",
                "_______________",
                "_______________",
            ],
            [
                "_______________",
                "_______________",
                "_______________",
                "_______________",
            ],
            [
                "_______________",
                "_______________",
                "_______________",
                "_______________",
            ],
            [
                Paragraph("<b>Gesamtsumme:</b>", self.normal_style),
                "",
                Paragraph("<b>_______________€</b>", self.normal_style),
                "",
            ],
        ]

        expense_table = Table(
            expense_data, colWidths=[30 * mm, 50 * mm, 30 * mm, 40 * mm]
        )
        expense_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, black),
                    ("BACKGROUND", (0, 0), (-1, 0), lightgrey),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                ]
            )
        )
        story.append(expense_table)
        story.append(Spacer(1, 20))

        # Remarks
        story.append(Paragraph("<b>Bemerkungen</b>", self.header_style))
        story.append(Paragraph("_" * 100 + "<br/>" + "_" * 100, self.normal_style))
        story.append(Spacer(1, 20))

        # Signature section
        sig_data = [
            ["", ""],
            ["_" * 50, "_" * 50],
            ["Ort, Datum", "Unterschrift Mitarbeiter"],
        ]

        sig_table = Table(sig_data, colWidths=[85 * mm, 85 * mm])
        sig_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 2), (-1, 2), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 30),
                ]
            )
        )
        story.append(sig_table)
        story.append(Spacer(1, 15))

        story.append(Paragraph("<b>Genehmigung durch Leiter</b>", self.header_style))

        approval_sig_data = [
            ["", ""],
            ["_" * 50, "_" * 50],
            ["Ort, Datum", "Unterschrift Leiter"],
        ]

        approval_sig_table = Table(approval_sig_data, colWidths=[85 * mm, 85 * mm])
        approval_sig_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 2), (-1, 2), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 30),
                ]
            )
        )
        story.append(approval_sig_table)

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_bulk_vacation_requests(
        self,
        employees: list[Employee],
        year: int,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate bulk vacation request forms for all employees.

        Creates one form per page for each employee.

        Args:
            employees: List of all employees
            year: Year for which to generate forms
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title page
        story.append(
            Paragraph(f"Urlaubsanträge {year} - Alle Mitarbeiter", self.title_style)
        )
        story.append(Spacer(1, 10))

        if settings:
            story.append(
                Paragraph(f"<b>Filiale:</b> {settings.store_name}", self.normal_style)
            )

        story.append(Spacer(1, 30))

        # Generate a form for each employee
        for i, employee in enumerate(sorted(employees, key=lambda e: e.last_name)):
            if i > 0:
                story.append(Spacer(1, 20))

            # Employee info section
            emp_data = [
                [
                    Paragraph("<b>Name:</b>", self.normal_style),
                    Paragraph(
                        f"{employee.first_name} {employee.last_name}", self.normal_style
                    ),
                ],
                [
                    Paragraph("<b>Personal-Nr.:</b>", self.normal_style),
                    Paragraph(employee.employee_id, self.normal_style),
                ],
                [
                    Paragraph("<b>E-Mail:</b>", self.normal_style),
                    Paragraph(employee.email or "", self.normal_style),
                ],
                [
                    Paragraph("<b>Jahresurlaubsanspruch:</b>", self.normal_style),
                    Paragraph(f"{employee.vacation_per_year} Tage", self.normal_style),
                ],
            ]

            emp_table = Table(emp_data, colWidths=[40 * mm, 130 * mm])
            emp_table.setStyle(
                TableStyle(
                    [
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ("BACKGROUND", (0, 0), (0, -1), colors.lightgrey),
                        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ]
                )
            )
            story.append(emp_table)
            story.append(Spacer(1, 12))

            # Vacation request section
            story.append(Paragraph("<b>Urlaubsantrag</b>", self.header_style))
            request_data = [
                [
                    Paragraph("<b>Von:</b>", self.normal_style),
                    Paragraph("_______________", self.normal_style),
                    Paragraph("<b>Bis:</b>", self.normal_style),
                    Paragraph("_______________", self.normal_style),
                ],
                [
                    Paragraph("<b>Anzahl Tage:</b>", self.normal_style),
                    Paragraph("____", self.normal_style),
                    Paragraph("<b>Bemerkungen:</b>", self.normal_style),
                    Paragraph("_______________", self.normal_style),
                ],
            ]

            request_table = Table(
                request_data, colWidths=[30 * mm, 40 * mm, 30 * mm, 70 * mm]
            )
            request_table.setStyle(
                TableStyle(
                    [
                        ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            story.append(request_table)
            story.append(Spacer(1, 8))

            # Signature section
            story.append(Paragraph("<b>Unterschriften</b>", self.header_style))
            sig_data = [
                ["", ""],
                [
                    Paragraph("_" * 40, self.small_style),
                    Paragraph("_" * 40, self.small_style),
                ],
                [
                    Paragraph("Ort, Datum", self.small_style),
                    Paragraph("Unterschrift Mitarbeiter", self.small_style),
                ],
            ]

            sig_table = Table(sig_data, colWidths=[85 * mm, 85 * mm])
            sig_table.setStyle(
                TableStyle(
                    [
                        ("FONTSIZE", (0, 0), (-1, -1), self.SMALL_FONT_SIZE),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("BOTTOMPADDING", (0, 0), (-1, 0), 20),
                    ]
                )
            )
            story.append(sig_table)
            story.append(Spacer(1, 8))

            # Approval section
            approval_data = [
                [
                    Paragraph("☐ Genehmigt", self.normal_style),
                    Paragraph("☐ Abgelehnt", self.normal_style),
                ],
            ]

            approval_table = Table(approval_data, colWidths=[85 * mm, 85 * mm])
            approval_table.setStyle(
                TableStyle(
                    [
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ]
                )
            )
            story.append(approval_table)
            story.append(Spacer(1, 8))

            # Approval signature
            approval_sig_data = [
                ["", ""],
                [
                    Paragraph("_" * 40, self.small_style),
                    Paragraph("_" * 40, self.small_style),
                ],
                [
                    Paragraph("Ort, Datum", self.small_style),
                    Paragraph("Unterschrift Leiter", self.small_style),
                ],
            ]

            approval_sig_table = Table(approval_sig_data, colWidths=[85 * mm, 85 * mm])
            approval_sig_table.setStyle(
                TableStyle(
                    [
                        ("FONTSIZE", (0, 0), (-1, -1), self.SMALL_FONT_SIZE),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("BOTTOMPADDING", (0, 0), (-1, 0), 20),
                    ]
                )
            )
            story.append(approval_sig_table)

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_vacation_approval_form(
        self,
        employee: Employee,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate vacation approval/acknowledgment form for a single employee.

        Args:
            employee: Employee for the form
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(Paragraph("Urlaubsgenehmigung / -Bestätigung", self.title_style))
        story.append(Spacer(1, 10))

        # Store info
        if settings:
            story.append(
                Paragraph(f"<b>Filiale:</b> {settings.store_name}", self.normal_style)
            )

        story.append(Spacer(1, 20))

        # Employee data
        emp_data = [
            [
                Paragraph("<b>Name:</b>", self.normal_style),
                Paragraph(
                    f"{employee.first_name} {employee.last_name}", self.normal_style
                ),
            ],
            [
                Paragraph("<b>Personal-Nr.:</b>", self.normal_style),
                Paragraph(employee.employee_id, self.normal_style),
            ],
            [
                Paragraph("<b>E-Mail:</b>", self.normal_style),
                Paragraph(employee.email or "", self.normal_style),
            ],
            [
                Paragraph("<b>Jahresurlaubsanspruch:</b>", self.normal_style),
                Paragraph(f"{employee.vacation_per_year} Tage", self.normal_style),
            ],
        ]

        emp_table = Table(emp_data, colWidths=[50 * mm, 120 * mm])
        emp_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("BACKGROUND", (0, 0), (0, -1), colors.lightgrey),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(emp_table)
        story.append(Spacer(1, 20))

        # Approval section
        story.append(Paragraph("<b>Genehmigungsstatus</b>", self.header_style))

        status_data = [
            [
                Paragraph("☐ Genehmigt", self.normal_style),
                Paragraph("☐ Ausstehend", self.normal_style),
                Paragraph("☐ Abgelehnt", self.normal_style),
            ],
        ]

        status_table = Table(status_data, colWidths=[60 * mm, 60 * mm, 60 * mm])
        status_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                ]
            )
        )
        story.append(status_table)
        story.append(Spacer(1, 20))

        # Vacation details
        story.append(Paragraph("<b>Urlaubszeiträume</b>", self.header_style))

        vacation_data = [
            [
                Paragraph("<b>Vom</b>", self.normal_style),
                Paragraph("<b>Bis</b>", self.normal_style),
                Paragraph("<b>Tage</b>", self.normal_style),
            ],
            ["_______________", "_______________", "____"],
            ["_______________", "_______________", "____"],
            ["_______________", "_______________", "____"],
        ]

        vacation_table = Table(vacation_data, colWidths=[60 * mm, 60 * mm, 40 * mm])
        vacation_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ]
            )
        )
        story.append(vacation_table)
        story.append(Spacer(1, 20))

        # Remarks
        story.append(Paragraph("<b>Bemerkungen</b>", self.header_style))
        story.append(Paragraph("_" * 100 + "<br/>" + "_" * 100, self.normal_style))
        story.append(Spacer(1, 20))

        # Approval signatures
        story.append(Paragraph("<b>Genehmigung durch Leiter</b>", self.header_style))

        approval_sig_data = [
            ["", ""],
            [
                Paragraph("_" * 40, self.small_style),
                Paragraph("_" * 40, self.small_style),
            ],
            [
                Paragraph("Ort, Datum", self.small_style),
                Paragraph("Unterschrift Leiter", self.small_style),
            ],
        ]

        approval_sig_table = Table(approval_sig_data, colWidths=[85 * mm, 85 * mm])
        approval_sig_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), self.SMALL_FONT_SIZE),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 30),
                ]
            )
        )
        story.append(approval_sig_table)

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def generate_bulk_vacation_approvals(
        self,
        employees: list[Employee],
        absences: list[Absence],
        year: int,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate bulk vacation approval forms for all employees.

        Creates a comprehensive overview with approval status for each employee.

        Args:
            employees: List of all employees
            absences: List of vacation absences
            year: Year for which to generate forms
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(
            Paragraph(
                f"Urlausbsgenehmigungen {year} - Alle Mitarbeiter", self.title_style
            )
        )
        story.append(Spacer(1, 10))

        if settings:
            story.append(
                Paragraph(f"<b>Filiale:</b> {settings.store_name}", self.normal_style)
            )

        story.append(Spacer(1, 20))

        # Build table with all employees and their vacation status
        table_data = [
            [
                Paragraph("<b>Nr.</b>", self.normal_style),
                Paragraph("<b>Mitarbeiter</b>", self.normal_style),
                Paragraph("<b>Personal-Nr.</b>", self.normal_style),
                Paragraph("<b>Anspruch</b>", self.normal_style),
                Paragraph("<b>Von</b>", self.normal_style),
                Paragraph("<b>Bis</b>", self.normal_style),
                Paragraph("<b>Tage</b>", self.normal_style),
                Paragraph("<b>Status</b>", self.normal_style),
                Paragraph("<b>Genehmigt?</b>", self.normal_style),
            ],
        ]

        sorted_employees = sorted(employees, key=lambda e: e.last_name)
        row_num = 1

        for emp in sorted_employees:
            emp_absences = [a for a in absences if a.employee_id == emp.id]

            if not emp_absences:
                # Add row even for employees without absences
                table_data.append(
                    [
                        Paragraph(str(row_num), self.small_style),
                        Paragraph(
                            f"{emp.first_name} {emp.last_name}", self.small_style
                        ),
                        Paragraph(emp.employee_id, self.small_style),
                        Paragraph(str(emp.vacation_per_year), self.small_style),
                        Paragraph("-", self.small_style),
                        Paragraph("-", self.small_style),
                        Paragraph("-", self.small_style),
                        Paragraph("-", self.small_style),
                        Paragraph("☐", self.small_style),
                    ]
                )
                row_num += 1
            else:
                for i, absence in enumerate(emp_absences):
                    num_days = (absence.end_date - absence.start_date).days + 1
                    status = self._format_status(absence.status)

                    table_data.append(
                        [
                            Paragraph(str(row_num) if i == 0 else "", self.small_style),
                            Paragraph(
                                f"{emp.first_name} {emp.last_name}" if i == 0 else "",
                                self.small_style,
                            ),
                            Paragraph(
                                emp.employee_id if i == 0 else "", self.small_style
                            ),
                            Paragraph(
                                str(emp.vacation_per_year) if i == 0 else "",
                                self.small_style,
                            ),
                            Paragraph(
                                absence.start_date.strftime("%d.%m.%Y"),
                                self.small_style,
                            ),
                            Paragraph(
                                absence.end_date.strftime("%d.%m.%Y"), self.small_style
                            ),
                            Paragraph(str(num_days), self.small_style),
                            Paragraph(status, self.small_style),
                            Paragraph("☐", self.small_style),
                        ]
                    )
                    row_num += 1

        # Create table with column widths
        table = Table(
            table_data,
            colWidths=[
                10 * mm,
                30 * mm,
                20 * mm,
                15 * mm,
                20 * mm,
                20 * mm,
                12 * mm,
                20 * mm,
                15 * mm,
            ],
        )

        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), self.NORMAL_FONT_SIZE),
                    ("FONTSIZE", (0, 1), (-1, -1), self.SMALL_FONT_SIZE),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.lightgrey],
                    ),
                ]
            )
        )

        story.append(table)
        story.append(Spacer(1, 20))

        # Footer with date
        story.append(
            Paragraph(
                f"<i>Erstellt am: {datetime.now().strftime('%d.%m.%Y %H:%M')}</i>",
                self.small_style,
            )
        )

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _format_status(self, status: str) -> str:
        """Format absence status for display."""
        status_map = {
            "pending": "Ausstehend",
            "approved": "Genehmigt",
            "rejected": "Abgelehnt",
            "beantragt": "Beantragt",
            "genehmigt": "Genehmigt",
            "abgelehnt": "Abgelehnt",
        }
        return status_map.get(status.lower(), status)

    def generate_employee_vacation_entitlement_list(
        self,
        employees: list[Employee],
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate a simple list of all employees with their yearly vacation entitlement.

        Args:
            employees: List of employees
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=self.MARGIN,
            bottomMargin=self.MARGIN,
        )

        story = []

        # Title
        story.append(
            Paragraph(
                "Mitarbeiter Urlaubsanspruch - Jahresübersicht", self.title_style
            )
        )
        story.append(Spacer(1, 10))

        # Store info if available
        if settings:
            info_text = f"<b>Filiale:</b> {settings.store_name}"
            if settings.store_address:
                info_text += f" | <b>Adresse:</b> {settings.store_address}"
            story.append(Paragraph(info_text, self.normal_style))
            story.append(Spacer(1, 15))

        # Description
        story.append(
            Paragraph(
                "Diese Übersicht zeigt alle aktiven Mitarbeiter mit ihrem jährlichen Urlaubsanspruch.",
                self.normal_style,
            )
        )
        story.append(Spacer(1, 15))

        # Table headers
        table_data = [
            [
                Paragraph("<b>Nr.</b>", self.normal_style),
                Paragraph("<b>Personal-Nr.</b>", self.normal_style),
                Paragraph("<b>Name</b>", self.normal_style),
                Paragraph("<b>Vorname</b>", self.normal_style),
                Paragraph("<b>Gruppe</b>", self.normal_style),
                Paragraph("<b>Urlaubstage/Jahr</b>", self.normal_style),
            ]
        ]

        # Add employee rows
        for idx, employee in enumerate(employees, start=1):
            table_data.append(
                [
                    str(idx),
                    employee.employee_id,
                    employee.last_name,
                    employee.first_name,
                    employee.employee_group.value if employee.employee_group else "-",
                    str(employee.vacation_per_year),
                ]
            )

        # Add total row
        total_vacation_days = sum(emp.vacation_per_year for emp in employees)
        avg_vacation_days = (
            total_vacation_days / len(employees) if employees else 0
        )
        table_data.append(
            [
                Paragraph("<b>Gesamt</b>", self.normal_style),
                "",
                f"{len(employees)} Mitarbeiter",
                "",
                "",
                Paragraph(
                    f"<b>Ø {avg_vacation_days:.1f} Tage</b>", self.normal_style
                ),
            ]
        )

        # Create table
        col_widths = [
            15 * mm,  # Nr.
            25 * mm,  # Personal-Nr.
            40 * mm,  # Name
            40 * mm,  # Vorname
            25 * mm,  # Gruppe
            30 * mm,  # Urlaubstage/Jahr
        ]
        table = Table(table_data, colWidths=col_widths, repeatRows=1)

        # Table style
        table_style = TableStyle(
            [
                # Header
                ("BACKGROUND", (0, 0), (-1, 0), lightgrey),
                ("TEXTCOLOR", (0, 0), (-1, 0), black),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), self.NORMAL_FONT_SIZE),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                # Body
                ("ALIGN", (0, 1), (0, -2), "CENTER"),  # Nr. column
                ("ALIGN", (1, 1), (1, -2), "CENTER"),  # Personal-Nr. column
                ("ALIGN", (4, 1), (5, -2), "CENTER"),  # Gruppe and Urlaubstage columns
                ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -2), self.NORMAL_FONT_SIZE),
                ("GRID", (0, 0), (-1, -1), 0.5, black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -2),
                    [white, colors.Color(0.95, 0.95, 0.95)],
                ),
                # Total row
                ("BACKGROUND", (0, -1), (-1, -1), colors.Color(0.85, 0.85, 0.85)),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("SPAN", (0, -1), (1, -1)),  # Merge first two cells
                ("SPAN", (2, -1), (4, -1)),  # Merge middle cells
            ]
        )

        table.setStyle(table_style)
        story.append(table)
        story.append(Spacer(1, 20))

        # Footer with date
        story.append(
            Paragraph(
                f"<i>Erstellt am: {datetime.now().strftime('%d.%m.%Y %H:%M')}</i>",
                self.small_style,
            )
        )

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
