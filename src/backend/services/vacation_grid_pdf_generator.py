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
        Vacation entries shown horizontally without overlapping.

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
            leftMargin=self.MARGIN,
            rightMargin=self.MARGIN,
            topMargin=10 * mm,
            bottomMargin=10 * mm,
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
            story.append(Spacer(1, 8))

            # Build calendar grid data
            calendar_data = self._build_grid_calendar(
                year, months, approved_absences, month_names
            )

            # Calculate column widths
            num_days = 31
            available_width = self.PAGE_WIDTH_LANDSCAPE - (2 * self.MARGIN)
            month_label_width = 20 * mm
            day_col_width = (available_width - month_label_width) / (num_days)

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
            story.append(Spacer(1, 15))

            # Add footer
            footer_text = (
                "Legende: Gekennzeichnete Zeilen zeigen "
                "Urlaubseinträge. Keine Überschneidungen."
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

            month_absences = self._get_month_absences(year, month, num_days, absences)

            if not month_absences:
                row = self._build_empty_month_row(month_name, num_days)
                calendar_data.append(row)
            else:
                month_label_row = self._build_month_header(month_name)
                calendar_data.append(month_label_row)

                for absence_info in month_absences:
                    rows = self._build_absence_rows(absence_info, num_days)
                    calendar_data.extend(rows)

        return calendar_data

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

    def _build_absence_rows(self, absence_info: dict, num_days: int) -> list:
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
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#333333"),
            ),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#FFFFFF")),
            ("TOPPADDING", (0, 0), (-1, 0), 3),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
            ("HEIGHT", (0, 0), (-1, 0), 12 * mm),
            # Month label column
            ("FONT", (0, 1), (0, -1), "Helvetica-Bold", 8),
            ("ALIGN", (0, 1), (0, -1), "LEFT"),
            ("VALIGN", (0, 1), (0, -1), "TOP"),
            ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#F0F0F0")),
            ("TOPPADDING", (0, 1), (0, -1), 2),
            ("BOTTOMPADDING", (0, 1), (0, -1), 2),
            ("LEFTPADDING", (0, 1), (0, -1), 2),
            # Day cells
            ("FONT", (1, 1), (-1, -1), "Helvetica", 7),
            ("ALIGN", (1, 1), (-1, -1), "CENTER"),
            ("VALIGN", (1, 1), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (1, 1), (-1, -1), 1),
            ("BOTTOMPADDING", (1, 1), (-1, -1), 1),
            ("LEFTPADDING", (1, 1), (-1, -1), 1),
            ("RIGHTPADDING", (1, 1), (-1, -1), 1),
            ("HEIGHT", (1, 1), (-1, -1), 8 * mm),
            # Grid lines
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
            (
                "LINEBELOW",
                (0, 0),
                (-1, 0),
                1.5,
                colors.HexColor("#333333"),
            ),
        ]

        return TableStyle(style_commands)
