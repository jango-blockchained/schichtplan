"""
Vacation Planning PDF Generator for German vacation management forms.

This module generates various PDF forms for vacation planning:
1. Admin yearly vacation planning form
2. Employee vacation request form
3. Comprehensive overview form (all employees)
4. Yearly calendar view (6 months per page with rotated text)
"""

import io
from datetime import date, datetime

from reportlab.lib import colors
from reportlab.lib.colors import black, lightgrey, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    PageBreak,
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
            elif remaining_days == 0:
                status = "Voll"
            else:
                status = "OK"

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

        # Format birthday if available
        birthday_str = ""
        if employee.birthday:
            birthday_str = employee.birthday.strftime("%d.%m.%Y")

        # Format employee group
        group_names = {
            "VZ": "Vollzeit",
            "TZ": "Teilzeit",
            "GFB": "Geringfügig Beschäftigt",
            "TL": "Team Leader",
        }
        group_display = group_names.get(
            employee.employee_group.value
            if hasattr(employee.employee_group, "value")
            else str(employee.employee_group),
            str(employee.employee_group),
        )

        emp_data = [
            ["Name:", f"{employee.first_name} {employee.last_name}"],
            ["Personal-Nr.:", employee.employee_id],
            ["E-Mail:", employee.email or ""],
            ["Telefon:", employee.phone or ""],
            ["Geburtsdatum:", birthday_str or ""],
            ["Beschäftigungsart:", group_display],
            ["Vertragsst./Woche:", f"{employee.contracted_hours} Std."],
            ["Schlüsselträger:", "Ja" if employee.is_keyholder else "Nein"],
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

        # Vacation request section with multiple entries
        story.append(Paragraph("<b>Urlaubsanträge</b>", self.header_style))
        story.append(Spacer(1, 5))
        story.append(
            Paragraph(
                "<i>Bitte tragen Sie alle geplanten Urlaubszeiten ein:</i>",
                self.small_style,
            )
        )
        story.append(Spacer(1, 10))

        # Create table with multiple rows for entries
        # Header row
        request_data = [
            [
                Paragraph("<b>Nr.</b>", self.normal_style),
                Paragraph("<b>Von</b>", self.normal_style),
                Paragraph("<b>Bis</b>", self.normal_style),
                Paragraph("<b>Tage</b>", self.normal_style),
                Paragraph("<b>Bemerkungen</b>", self.normal_style),
            ]
        ]

        # If there's a pre-filled absence, add it as first row
        if absence:
            start_date = absence.start_date.strftime("%d.%m.%Y")
            end_date = absence.end_date.strftime("%d.%m.%Y")
            days = (absence.end_date - absence.start_date).days + 1
            note = absence.note or ""
            request_data.append(["1.", start_date, end_date, str(days), note])
            start_row = 2
        else:
            start_row = 1

        # Add 5 blank rows for additional entries
        for i in range(start_row, start_row + 5):
            request_data.append([f"{i}.", "", "", "", ""])

        request_table = Table(
            request_data,
            colWidths=[15 * mm, 35 * mm, 35 * mm, 20 * mm, 65 * mm],
        )
        request_table.setStyle(
            TableStyle(
                [
                    # Header row styling
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    # Grid lines
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    # Row height
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, white]),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.append(request_table)
        story.append(Spacer(1, 20))

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
        Generate comprehensive overview form with all employees and absences.

        Shows all approved absences (vacation, time-off, training, etc.),
        dates, status, and remaining vacation days for all employees in a
        comprehensive table format.

        Args:
            employees: List of all employees
            absences: List of approved absences (all types)
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
            Paragraph(
                f"Abwesenheitsübersicht {year} - Alle Mitarbeiter",
                self.title_style,
            )
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

        # Group ALL approved absences by employee (not just vacation)
        employee_vacations = {}
        for absence in absences:
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
                Paragraph("<b>Typ</b>", self.small_style),
                Paragraph("<b>Von</b>", self.small_style),
                Paragraph("<b>Bis</b>", self.small_style),
                Paragraph("<b>Tage</b>", self.small_style),
                Paragraph("<b>Status</b>", self.small_style),
                Paragraph("<b>Bemerkung</b>", self.small_style),
            ]
        ]

        # Add employee rows
        row_num = 1
        for employee in sorted(employees, key=lambda e: (e.last_name, e.first_name)):
            emp_absences = employee_vacations.get(employee.id, [])

            if not emp_absences:
                # Employee with no absence entries
                table_data.append(
                    [
                        str(row_num),
                        f"{employee.last_name}, {employee.first_name}",
                        employee.employee_id,
                        "-",
                        "-",
                        "-",
                        "-",
                        "-",
                        "",
                    ]
                )
                row_num += 1
            else:
                # First absence row for employee
                first_absence = emp_absences[0]
                days = (first_absence.end_date - first_absence.start_date).days + 1
                absence_type = first_absence.absence_type_id

                table_data.append(
                    [
                        str(row_num),
                        f"{employee.last_name}, {employee.first_name}",
                        employee.employee_id,
                        absence_type,
                        first_absence.start_date.strftime("%d.%m.%y"),
                        first_absence.end_date.strftime("%d.%m.%y"),
                        str(days),
                        self._get_status_text(first_absence.status),
                        first_absence.note or "",
                    ]
                )
                row_num += 1

                # Additional absence rows for same employee
                for absence in emp_absences[1:]:
                    days = (absence.end_date - absence.start_date).days + 1
                    absence_type = absence.absence_type_id

                    table_data.append(
                        [
                            "",
                            "",
                            "",
                            absence_type,
                            absence.start_date.strftime("%d.%m.%y"),
                            absence.end_date.strftime("%d.%m.%y"),
                            str(days),
                            self._get_status_text(absence.status),
                            absence.note or "",
                        ]
                    )

        # Create table
        col_widths = [
            12 * mm,  # Nr.
            38 * mm,  # Mitarbeiter
            18 * mm,  # Pers.-Nr.
            16 * mm,  # Typ
            18 * mm,  # Von
            18 * mm,  # Bis
            12 * mm,  # Tage
            25 * mm,  # Status (expanded)
            85 * mm,  # Bemerkung (expanded)
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
                ("ALIGN", (3, 1), (6, -1), "CENTER"),
                ("ALIGN", (7, 1), (-1, -1), "LEFT"),  # Status and remarks left-aligned
                ("VALIGN", (0, 1), (-1, -1), "TOP"),  # Top aligned for wrapping text
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), self.SMALL_FONT_SIZE),
                ("GRID", (0, 0), (-1, -1), 0.5, black),
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
        total_absence_days = sum(
            (abs.end_date - abs.start_date).days + 1
            for abs in absences
            if abs.status == "approved"
        )

        story.append(
            Paragraph(
                f"<b>Zusammenfassung:</b> {total_employees} Mitarbeiter | "
                f"{total_absence_days} genehmigte Abwesenstage",
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
        employees: list[Employee] = None,
        absences: list[Absence] = None,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate yearly vacation planning grid in DIN A4 landscape format.
        Creates a calendar view with months and weekdays, showing approved absences.

        Format: 2 pages with 6 months per page in a 2x3 grid layout.

        Args:
            year: Year to display
            employees: Optional list of employees (for reference)
            absences: Optional list of absences to display on calendar
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

        # Filter for approved absences only
        approved_absences = []
        if absences:
            approved_absences = [
                abs for abs in absences
                if abs.status == "approved"
                and abs.start_date.year <= year
                and abs.end_date.year >= year
            ]

        # Create a mapping of dates to absence count for visualization
        absence_dates = {}
        for absence in approved_absences:
            # Get the date range within the year
            start = max(absence.start_date, date(year, 1, 1))
            end = min(absence.end_date, date(year, 12, 31))

            current = start
            while current <= end:
                date_key = (current.month, current.day)
                absence_dates[date_key] = absence_dates.get(date_key, 0) + 1
                current = date(current.year, current.month, current.day) + \
                    __import__('datetime').timedelta(days=1)

        story = []
        weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

        for page_num in range(2):
            # Title for the page
            title_text = f"Jahresurlaubskalender {year}"
            if settings and settings.store_name:
                title_text += f" - {settings.store_name}"
            story.append(Paragraph(title_text, self.title_style))
            story.append(Spacer(1, 10))

            # Create 2 rows of 3 months each (2x3 grid)
            start_month = 1 + (page_num * 6)

            # Build the grid - 2 rows with 3 months per row
            for row_num in range(2):
                row_data = []

                for col_num in range(3):
                    month_index = start_month + (row_num * 3) + col_num
                    if month_index > 12:
                        row_data.append("")
                        continue

                    # --- Create calendar for one month ---
                    month_name = datetime(year, month_index, 1).strftime("%B")
                    month_calendar_data = [
                        [Paragraph(f"<b>{month_name}</b>", self.normal_style)]
                    ]

                    # Weekday headers
                    weekday_header = [
                        Paragraph(f"<b>{day}</b>", self.small_style) for day in weekdays
                    ]
                    month_calendar_data.append(weekday_header)

                    # Get calendar data for the month
                    first_day_of_month, num_days = self._get_month_details(
                        year, month_index
                    )

                    # Create day cells with absence indicators
                    day_cells_data = [[""] * 7 for _ in range(6)]  # Max 6 weeks

                    for day_num in range(1, num_days + 1):
                        # Calculate week and weekday
                        day_of_week = (first_day_of_month + day_num - 1) % 7
                        week_num = (first_day_of_month + day_num - 1) // 7

                        # Check if this date has absences
                        date_key = (month_index, day_num)
                        absence_count = absence_dates.get(date_key, 0)

                        # Create cell content with indicator
                        if absence_count > 0:
                            # Use bullet point to indicate approved absence
                            cell_text = f"<b>{day_num}</b><br/><font size='5'>•</font>"
                            day_cells_data[week_num][day_of_week] = Paragraph(
                                cell_text, self.small_style
                            )
                        else:
                            day_cells_data[week_num][day_of_week] = str(day_num)

                    # Remove empty rows at the end
                    while day_cells_data and all(cell == "" for cell in day_cells_data[-1]):
                        day_cells_data.pop()

                    # Add day cells to month calendar data
                    for week in day_cells_data:
                        month_calendar_data.append(week)

                    # --- Create month table ---
                    # Calculate column width to fit 3 months per row
                    available_width = self.PAGE_WIDTH_LANDSCAPE - 2 * self.MARGIN - 20 * mm
                    month_width = available_width / 3
                    col_width = month_width / 7

                    month_table = Table(
                        month_calendar_data,
                        colWidths=[col_width] * 7,
                        rowHeights=None,  # Auto-adjust height
                    )

                    month_table.setStyle(
                        TableStyle(
                            [
                                # Month header
                                ("SPAN", (0, 0), (-1, 0)),
                                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                                ("FONTSIZE", (0, 0), (-1, 0), self.NORMAL_FONT_SIZE),
                                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                                # Weekday headers
                                ("ALIGN", (0, 1), (-1, 1), "CENTER"),
                                ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                                ("BACKGROUND", (0, 1), (-1, 1), lightgrey),
                                ("FONTSIZE", (0, 1), (-1, 1), self.SMALL_FONT_SIZE),
                                # Day cells
                                ("ALIGN", (0, 2), (-1, -1), "CENTER"),
                                ("VALIGN", (0, 2), (-1, -1), "MIDDLE"),
                                ("FONTSIZE", (0, 2), (-1, -1), self.SMALL_FONT_SIZE),
                                ("GRID", (0, 1), (-1, -1), 0.5, black),
                                ("TOPPADDING", (0, 2), (-1, -1), 4),
                                ("BOTTOMPADDING", (0, 2), (-1, -1), 4),
                            ]
                        )
                    )
                    row_data.append(month_table)

                # Create row table with the 3 month tables
                row_table = Table(
                    [row_data],
                    colWidths=[month_width] * 3,
                )
                row_table.setStyle(
                    TableStyle([
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 5),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ])
                )

                story.append(row_table)
                story.append(Spacer(1, 15))

            # Add legend
            story.append(Spacer(1, 10))
            legend_text = (
                "<b>Legende:</b> • = Genehmigter Urlaubsantrag | "
                f"Gesamt: {len(approved_absences)} genehmigte Anträge"
            )
            story.append(Paragraph(legend_text, self.small_style))

            if page_num == 0:
                story.append(PageBreak())

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _days_in_month(self, year, month):
        if month == 2:
            return (
                29 if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0) else 28
            )
        elif month in [4, 6, 9, 11]:
            return 30
        else:
            return 31

    def _get_status_text(self, status: str) -> str:
        """Convert status code to German text."""
        status_map = {
            "requested": "Beantragt",
            "approved": "Genehmigt",
            "declined": "Abgelehnt",
        }
        return status_map.get(status, status)

    def _get_month_details(self, year, month):
        first_day = date(year, month, 1)
        first_day_weekday = first_day.weekday()  # Monday is 0, Sunday is 6
        num_days = self._days_in_month(year, month)
        return first_day_weekday, num_days

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

        # Format birthday if available
        birthday_str = ""
        if employee.birthday:
            birthday_str = employee.birthday.strftime("%d.%m.%Y")

        # Format employee group
        group_names = {
            "VZ": "Vollzeit",
            "TZ": "Teilzeit",
            "GFB": "Geringfügig Beschäftigt",
            "TL": "Team Leader",
        }
        group_display = group_names.get(
            employee.employee_group.value
            if hasattr(employee.employee_group, "value")
            else str(employee.employee_group),
            str(employee.employee_group),
        )

        emp_data = [
            ["Name:", f"{employee.first_name} {employee.last_name}"],
            ["Personal-Nr.:", employee.employee_id],
            ["E-Mail:", employee.email or ""],
            ["Telefon:", employee.phone or ""],
            ["Geburtsdatum:", birthday_str or ""],
            ["Beschäftigungsart:", group_display],
            ["Vertragsst./Woche:", f"{employee.contracted_hours} Std."],
            ["Schlüsselträger:", "Ja" if employee.is_keyholder else "Nein"],
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
        story.append(
            Paragraph(
                "Geburtsdatum: _________________________ "
                "Personal-Nr.: _________________________",
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
            ["Beschäftigungsart:", "☐ VZ  ☐ TZ  ☐ GFB  ☐ TL"],
            ["Vertragsst./Woche:", "_______________ Std."],
            ["Schlüsselträger:", "☐ Ja  ☐ Nein"],
            ["Jahresurlaubstage:", "_______________ Tage"],
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
        absence: Absence,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate vacation approval/acknowledgment form for a specific absence.

        This form must be linked to a specific vacation request (absence).

        Args:
            employee: Employee for the form
            absence: The specific absence/vacation request to approve
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
        story.append(Spacer(1, 5))
        story.append(
            Paragraph(
                f"<i>Bezug auf Urlaubsantrag vom "
                f"{absence.created_at.strftime('%d.%m.%Y') if absence.created_at else 'N/A'}</i>",
                self.small_style,
            )
        )
        story.append(Spacer(1, 10))

        # Store info
        if settings:
            story.append(
                Paragraph(f"<b>Filiale:</b> {settings.store_name}", self.normal_style)
            )

        story.append(Spacer(1, 20))

        # Employee data
        # Format birthday if available
        birthday_str = ""
        if employee.birthday:
            birthday_str = employee.birthday.strftime("%d.%m.%Y")

        # Format employee group
        group_names = {
            "VZ": "Vollzeit",
            "TZ": "Teilzeit",
            "GFB": "Geringfügig Beschäftigt",
            "TL": "Team Leader",
        }
        group_display = group_names.get(
            employee.employee_group.value
            if hasattr(employee.employee_group, "value")
            else str(employee.employee_group),
            str(employee.employee_group),
        )

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
                Paragraph("<b>Telefon:</b>", self.normal_style),
                Paragraph(employee.phone or "", self.normal_style),
            ],
            [
                Paragraph("<b>Geburtsdatum:</b>", self.normal_style),
                Paragraph(birthday_str or "", self.normal_style),
            ],
            [
                Paragraph("<b>Beschäftigungsart:</b>", self.normal_style),
                Paragraph(group_display, self.normal_style),
            ],
            [
                Paragraph("<b>Vertragsst./Woche:</b>", self.normal_style),
                Paragraph(f"{employee.contracted_hours} Std.", self.normal_style),
            ],
            [
                Paragraph("<b>Schlüsselträger:</b>", self.normal_style),
                Paragraph("Ja" if employee.is_keyholder else "Nein", self.normal_style),
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

        # Requested vacation details from the absence
        story.append(Paragraph("<b>Beantragter Urlaubszeitraum</b>", self.header_style))
        story.append(Spacer(1, 10))

        start_date = absence.start_date.strftime("%d.%m.%Y")
        end_date = absence.end_date.strftime("%d.%m.%Y")
        days = (absence.end_date - absence.start_date).days + 1
        status_display = {
            "requested": "Beantragt",
            "approved": "Genehmigt",
            "rejected": "Abgelehnt",
        }.get(absence.status, absence.status)

        vacation_data = [
            [
                Paragraph("<b>Von</b>", self.normal_style),
                Paragraph("<b>Bis</b>", self.normal_style),
                Paragraph("<b>Anzahl Tage</b>", self.normal_style),
                Paragraph("<b>Status</b>", self.normal_style),
            ],
            [
                Paragraph(start_date, self.normal_style),
                Paragraph(end_date, self.normal_style),
                Paragraph(str(days), self.normal_style),
                Paragraph(status_display, self.normal_style),
            ],
        ]

        vacation_table = Table(
            vacation_data, colWidths=[40 * mm, 40 * mm, 35 * mm, 45 * mm]
        )
        vacation_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), self.NORMAL_FONT_SIZE),
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        story.append(vacation_table)
        story.append(Spacer(1, 20))

        # Remarks from absence
        if absence.note:
            story.append(Paragraph("<b>Bemerkungen zum Antrag</b>", self.header_style))
            story.append(Paragraph(absence.note or "", self.normal_style))
            story.append(Spacer(1, 20))

        # Approval section
        story.append(Paragraph("<b>Genehmigungsentscheidung</b>", self.header_style))
        story.append(Spacer(1, 10))

        status_data = [
            [
                Paragraph("☐ Genehmigt", self.normal_style),
                Paragraph("☐ Abgelehnt", self.normal_style),
            ],
        ]

        status_table = Table(status_data, colWidths=[85 * mm, 85 * mm])
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

        # Additional remarks
        story.append(Paragraph("<b>Bemerkungen zur Genehmigung</b>", self.header_style))
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
                    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), self.NORMAL_FONT_SIZE),
                    ("FONTSIZE", (0, 1), (-1, -1), self.SMALL_FONT_SIZE),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -2),
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
        absences: list[Absence],
        year: int,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate comprehensive list with vacation entitlement and absence usage.

        Shows all approved absences (vacation, time-off, training, etc.) per
        employee with entitlement calculations.

        Args:
            employees: List of employees
            absences: List of approved absences (all types)
            year: Year for the report
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
                f"Mitarbeiter Abwesenheitsübersicht - Jahresanspruch {year}",
                self.title_style,
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
                f"Diese Übersicht zeigt alle aktiven Mitarbeiter mit "
                f"genehmigten Abwesenheiten für {year}.",
                self.normal_style,
            )
        )
        story.append(Spacer(1, 15))

        # Calculate vacation data for each employee
        employee_vacation_data = {}
        for employee in employees:
            # Filter ALL approved absences for this employee and year
            emp_absences = [
                abs
                for abs in absences
                if abs.employee_id == employee.id
                and abs.start_date.year <= year
                and abs.end_date.year >= year
            ]

            # Calculate taken days (all types, all approved)
            taken_days = 0
            for absence in emp_absences:
                # Calculate days that fall within the year
                start = max(absence.start_date, date(year, 1, 1))
                end = min(absence.end_date, date(year, 12, 31))
                if start <= end:
                    taken_days += (end - start).days + 1

            remaining_days = employee.vacation_per_year - taken_days
            employee_vacation_data[employee.id] = {
                "taken": taken_days,
                "remaining": remaining_days,
                "total_requests": len(emp_absences),
            }

        # Table headers
        table_data = [
            [
                Paragraph("<b>Nr.</b>", self.small_style),
                Paragraph("<b>Pers.-Nr.</b>", self.small_style),
                Paragraph("<b>Name</b>", self.small_style),
                Paragraph("<b>Anspruch</b>", self.small_style),
                Paragraph("<b>Genommen</b>", self.small_style),
                Paragraph("<b>Verbleibend</b>", self.small_style),
                Paragraph("<b>Anträge</b>", self.small_style),
            ]
        ]

        # Add employee rows
        total_entitlement = 0
        total_taken = 0
        total_remaining = 0

        for idx, employee in enumerate(
            sorted(employees, key=lambda e: (e.last_name, e.first_name)), start=1
        ):
            data = employee_vacation_data[employee.id]
            total_entitlement += employee.vacation_per_year
            total_taken += data["taken"]
            total_remaining += data["remaining"]

            # Color remaining days based on value
            remaining_color = "black"
            if data["remaining"] < 0:
                remaining_color = "red"
            elif data["remaining"] < 5:
                remaining_color = "orange"

            table_data.append(
                [
                    Paragraph(str(idx), self.small_style),
                    Paragraph(employee.employee_id, self.small_style),
                    Paragraph(
                        f"{employee.last_name}, {employee.first_name}",
                        self.small_style,
                    ),
                    Paragraph(str(employee.vacation_per_year), self.small_style),
                    Paragraph(str(data["taken"]), self.small_style),
                    Paragraph(
                        f'<font color="{remaining_color}">{data["remaining"]}</font>',
                        self.small_style,
                    ),
                    Paragraph(str(data["total_requests"]), self.small_style),
                ]
            )

        # Add total row
        avg_entitlement = total_entitlement / len(employees) if employees else 0
        avg_taken = total_taken / len(employees) if employees else 0
        avg_remaining = total_remaining / len(employees) if employees else 0

        table_data.append(
            [
                Paragraph(f"<b>Gesamt ({len(employees)})</b>", self.small_style),
                "",
                "",
                Paragraph(f"<b>Ø {avg_entitlement:.1f}</b>", self.small_style),
                Paragraph(f"<b>Ø {avg_taken:.1f}</b>", self.small_style),
                Paragraph(f"<b>Ø {avg_remaining:.1f}</b>", self.small_style),
                "",
            ]
        )

        # Create table
        col_widths = [
            12 * mm,  # Nr.
            20 * mm,  # Pers.-Nr.
            50 * mm,  # Name
            25 * mm,  # Anspruch
            25 * mm,  # Genommen
            28 * mm,  # Verbleibend
            15 * mm,  # Anträge
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
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                # Body
                ("ALIGN", (0, 1), (0, -2), "CENTER"),  # Nr.
                ("ALIGN", (1, 1), (1, -2), "CENTER"),  # Pers.-Nr.
                ("ALIGN", (3, 1), (-1, -2), "CENTER"),  # Numeric columns
                ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -2), self.SMALL_FONT_SIZE),
                ("GRID", (0, 0), (-1, -1), 0.5, black),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -2),
                    [white, colors.Color(0.95, 0.95, 0.95)],
                ),
                # Total row
                (
                    "BACKGROUND",
                    (0, -1),
                    (-1, -1),
                    colors.Color(0.85, 0.85, 0.85),
                ),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("SPAN", (0, -1), (2, -1)),  # Merge first three cells
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
