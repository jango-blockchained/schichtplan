"""Vacation calendar PDF generator with grid layout."""

import io
from datetime import date

from reportlab.lib import colors
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

from src.backend.models import Absence, Employee, Settings

# Constants
FEBRUARY = 2


class VacationGridPDFGenerator:
    """Generate vacation calendar with grid layout (days as columns)."""

    PAGE_WIDTH_LANDSCAPE = landscape(A4)[0]
    PAGE_HEIGHT_LANDSCAPE = landscape(A4)[1]

    MARGIN = 8 * mm
    TITLE_FONT_SIZE = 14
    HEADER_FONT_SIZE = 10
    NORMAL_FONT_SIZE = 9
    SMALL_FONT_SIZE = 7

    def __init__(self):
        """Initialize the grid PDF generator."""
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        self.title_style = ParagraphStyle(
            "GridTitle",
            parent=self.styles["Normal"],
            fontSize=self.TITLE_FONT_SIZE,
            fontName="Helvetica-Bold",
            alignment=1,  # Center
            spaceAfter=12,
        )

        self.header_style = ParagraphStyle(
            "GridHeader",
            parent=self.styles["Normal"],
            fontSize=self.HEADER_FONT_SIZE,
            fontName="Helvetica-Bold",
            alignment=0,  # Left
            spaceAfter=6,
        )

        self.normal_style = ParagraphStyle(
            "GridNormal",
            parent=self.styles["Normal"],
            fontSize=self.NORMAL_FONT_SIZE,
            fontName="Helvetica",
            alignment=0,  # Left
        )

        self.small_style = ParagraphStyle(
            "GridSmall",
            parent=self.styles["Normal"],
            fontSize=self.SMALL_FONT_SIZE,
            fontName="Helvetica",
            alignment=0,  # Left
        )

    @staticmethod
    def _days_in_month(year: int, month: int) -> int:
        """Get number of days in a month."""
        if month in [1, 3, 5, 7, 8, 10, 12]:
            return 31
        if month in [4, 6, 9, 11]:
            return 30
        if month == FEBRUARY:
            is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
            return 29 if is_leap else 28
        return 0

    def generate_yearly_calendar_grid(
        self,
        year: int,
        employees: list[Employee] | None = None,  # noqa: ARG001
        absences: list[Absence] | None = None,
        settings: Settings | None = None,
    ) -> io.BytesIO:
        """
        Generate grid-based yearly vacation calendar.

        Format: 2 landscape pages with 6 months per page.
        Days 1-31 displayed as columns, months as rows.
        Vacation entries listed per day without red containers.

        Args:
            year: Year to display
            employees: Optional list of employees (unused, for compatibility)
            absences: Optional list of absences to display
            settings: Optional settings object

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=4 * mm,
            rightMargin=4 * mm,
            topMargin=6 * mm,
            bottomMargin=6 * mm,
        )

        story = []

        # Filter for approved absences only
        approved_absences = []
        if absences:
            approved_absences = [
                absence
                for absence in absences
                if absence.status == "approved"
                and absence.start_date.year <= year
                and absence.end_date.year >= year
            ]

        month_names = {
            1: "JANUAR",
            2: "FEBRUAR",
            3: "MÄRZ",
            4: "APRIL",
            5: "MAI",
            6: "JUNI",
            7: "JULI",
            8: "AUGUST",
            9: "SEPTEMBER",
            10: "OKTOBER",
            11: "NOVEMBER",
            12: "DEZEMBER",
        }

        # Generate 2 pages: Jan-Jun (Page 1), Jul-Dec (Page 2)
        for page_num in range(2):
            if page_num == 0:
                months = list(range(1, 7))
                period_text = "Januar - Juni"
            else:
                months = list(range(7, 13))
                period_text = "Juli - Dezember"

            # Page title
            title_text = f"Jahresurlaubskalender {year} - {period_text}"
            if settings and settings.store_name:
                title_text += f" ({settings.store_name})"
            story.append(Paragraph(title_text, self.title_style))
            story.append(Spacer(1, 4))

            # Build calendar grid data
            calendar_data = self._build_grid_calendar(
                year, months, approved_absences, month_names
            )

            # Calculate column widths
            num_days = 31
            available_width = self.PAGE_WIDTH_LANDSCAPE - (2 * 4 * mm)
            month_label_width = 16 * mm
            day_col_width = (available_width - month_label_width) / num_days

            col_widths = [month_label_width] + [day_col_width] * num_days

            # Create table
            calendar_table = Table(
                calendar_data,
                colWidths=col_widths,
                repeatRows=0,
            )

            # Apply styling
            calendar_table.setStyle(self._get_table_style(calendar_data))

            story.append(calendar_table)
            story.append(Spacer(1, 6))

            # Add footer
            footer_text = (
                "Legende: Absenzeinträge werden pro Tag aufgelistet. "
                "Mehrtägige Einträge erscheinen an jedem Tag."
            )
            story.append(Paragraph(footer_text, self.small_style))

            if page_num == 0:
                story.append(PageBreak())

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _build_grid_calendar(
        self,
        year: int,
        months: list[int],
        absences: list[Absence],
        month_names: dict,
    ) -> list[list]:
        """
        Build grid calendar with months as rows, days (1-31) as columns.

        Events are listed without red containers, and multiday events
        appear on each day they span.

        Returns:
            2D list for Table widget
        """
        calendar_data = []

        # Header row: Day numbers 1-31
        header_row = [Paragraph("<b>Monat</b>", self.normal_style)]
        for day in range(1, 32):
            header_row.append(Paragraph(f"<b>{day}</b>", self.small_style))
        calendar_data.append(header_row)

        # Build rows for each month
        for month in months:
            month_name = month_names[month]
            num_days = self._days_in_month(year, month)

            # Get all absences for this month
            month_absences_by_day = self._get_month_absences_by_day(
                year, month, num_days, absences
            )

            # Create month header row
            month_row = [Paragraph(f"<b>{month_name}</b>", self.normal_style)]
            for day in range(1, 32):
                if day <= num_days:
                    # Get absences for this day
                    day_absences = month_absences_by_day.get(day, [])
                    if day_absences:
                        # Build event list for this day
                        events_text = "<br/>".join(
                            [
                                f"<font size=5>{abs_info['name']}</font>"
                                for abs_info in day_absences
                            ]
                        )
                        month_row.append(Paragraph(events_text, self.small_style))
                    else:
                        # Empty cell for days without events
                        month_row.append(Paragraph("", self.small_style))
                else:
                    month_row.append(Paragraph("", self.small_style))

            calendar_data.append(month_row)

        return calendar_data

    def _get_month_absences_by_day(
        self, year: int, month: int, num_days: int, absences: list[Absence]
    ) -> dict:
        """
        Get absences organized by day for the given month.

        Multiday events appear on each day they span.

        Returns:
            Dictionary: {day: [{'name': str, 'absence': Absence}, ...]}
        """
        absences_by_day = {}

        for absence in absences:
            # Calculate the overlap between absence and this month
            month_start = date(year, month, 1)
            month_end = date(year, month, num_days)

            overlap_start = max(absence.start_date, month_start)
            overlap_end = min(absence.end_date, month_end)

            if overlap_start <= overlap_end:
                # Build employee name
                emp = absence.employee
                emp_name = f"{emp.last_name}"

                # Add to each day in the range
                current_day = overlap_start
                while current_day <= overlap_end:
                    day = current_day.day
                    if day not in absences_by_day:
                        absences_by_day[day] = []

                    absences_by_day[day].append({"name": emp_name, "absence": absence})
                    current_day = current_day.replace(day=current_day.day + 1)

        return absences_by_day

    def _get_month_absences(
        self, year: int, month: int, num_days: int, absences: list[Absence]
    ) -> list[dict]:
        """Get absences overlapping with the given month."""
        month_absences = []
        for absence in absences:
            absence_start = max(absence.start_date, date(year, month, 1))
            month_end = date(year, month, num_days)
            absence_end = min(absence.end_date, month_end)
            if absence_start <= absence_end:
                month_absences.append(
                    {
                        "absence": absence,
                        "start_day": absence_start.day,
                        "end_day": absence_end.day,
                    }
                )
        return month_absences

    def _build_empty_month_row(self, month_name: str, num_days: int):
        """Build row for month with no absences."""
        row = [Paragraph(f"<b>{month_name}</b>", self.normal_style)]
        for day in range(1, 32):
            if day <= num_days:
                row.append(
                    Paragraph(
                        f"<font size=6 color='#999999'>{day}</font>",
                        self.small_style,
                    )
                )
            else:
                row.append(Paragraph("", self.small_style))
        return row

    def _build_month_header(self, month_name: str):
        """Build month header row."""
        month_label_row = [Paragraph(f"<b>{month_name}</b>", self.normal_style)]
        for _ in range(1, 32):
            month_label_row.append(Paragraph("", self.small_style))
        return month_label_row

    def _build_absence_rows(self, absence_info: dict, num_days: int):
        """Build rows for an absence entry."""
        absence = absence_info["absence"]
        start_day = absence_info["start_day"]
        end_day = absence_info["end_day"]

        emp = absence.employee
        emp_name = f"{emp.last_name} {emp.first_name}"
        start_str = absence.start_date.strftime("%d.%m.%y")
        end_str = absence.end_date.strftime("%d.%m.%y")

        # Marker row
        row = [Paragraph("", self.small_style)]
        for day in range(1, 32):
            if start_day <= day <= end_day:
                row.append(
                    Paragraph(
                        "<font color='#FF6B6B' size=8>●</font>",
                        self.small_style,
                    )
                )
            elif day <= num_days:
                cell_text = f"<font size=6 color='#EEEEEE'>{day}</font>"
                row.append(Paragraph(cell_text, self.small_style))
            else:
                row.append(Paragraph("", self.small_style))

        # Details row
        detail_row = [
            Paragraph(
                f"<i><font size=7>{emp_name}</font></i>",
                self.small_style,
            )
        ]

        for day in range(1, 32):
            if start_day <= day <= end_day:
                date_text = (
                    f"<font size=5 color='#666'>{start_str}</font>"
                    f"<br/><font size=5 color='#999'>→</font>"
                    f"<br/><font size=5 color='#666'>{end_str}</font>"
                )
                detail_row.append(Paragraph(date_text, self.small_style))
            else:
                detail_row.append(Paragraph("", self.small_style))

        return [row, detail_row]

    def _get_table_style(
        self,
        calendar_data: list[list] | None = None,  # noqa: ARG002
    ) -> TableStyle:
        """Generate styling for grid layout table."""
        style_commands = [
            # Header row styling
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 8),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#E8E8E8"),
            ),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#333333")),
            ("TOPPADDING", (0, 0), (-1, 0), 2),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
            ("HEIGHT", (0, 0), (-1, 0), 10 * mm),
            # Month label column
            ("FONT", (0, 1), (0, -1), "Helvetica-Bold", 7),
            ("ALIGN", (0, 1), (0, -1), "LEFT"),
            ("VALIGN", (0, 1), (0, -1), "TOP"),
            ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#F5F5F5")),
            ("TOPPADDING", (0, 1), (0, -1), 2),
            ("BOTTOMPADDING", (0, 1), (0, -1), 2),
            ("LEFTPADDING", (0, 1), (0, -1), 2),
            # Day cells - compact
            ("FONT", (1, 1), (-1, -1), "Helvetica", 6),
            ("ALIGN", (1, 1), (-1, -1), "LEFT"),
            ("VALIGN", (1, 1), (-1, -1), "TOP"),
            ("TOPPADDING", (1, 1), (-1, -1), 1),
            ("BOTTOMPADDING", (1, 1), (-1, -1), 1),
            ("LEFTPADDING", (1, 1), (-1, -1), 1),
            ("RIGHTPADDING", (1, 1), (-1, -1), 1),
            ("HEIGHT", (1, 1), (-1, -1), 6 * mm),
            # Grid lines
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#DDDDDD")),
            (
                "LINEBELOW",
                (0, 0),
                (-1, 0),
                1,
                colors.HexColor("#999999"),
            ),
        ]

        return TableStyle(style_commands)
