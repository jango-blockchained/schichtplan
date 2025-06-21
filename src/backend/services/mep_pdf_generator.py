"""
MEP PDF Generator for German Mitarbeiter-Einsatz-Planung format.

This module generates PDF documents that match the standard German MEP
(Mitarbeiter-Einsatz-Planung) template format as used in retail and
service industries for employee shift planning.
"""

import io
import locale
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.colors import black, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..models import Schedule
from .mep_data_processor import MEPDataProcessor


class MEPPDFGenerator:
    """
    Generator for MEP (Mitarbeiter-Einsatz-Planung) PDF documents.

    Creates PDF documents matching the standard German employee scheduling
    form used in retail and service industries.
    """

    # DIN A4 landscape dimensions in points (72 DPI)
    PAGE_WIDTH = landscape(A4)[0]  # 842 points (A4 height becomes width in landscape)
    PAGE_HEIGHT = landscape(A4)[1]  # 595 points (A4 width becomes height in landscape)

    # Margins in mm converted to points
    MARGIN_LEFT = 15 * mm
    MARGIN_RIGHT = 15 * mm
    MARGIN_TOP = 20 * mm
    MARGIN_BOTTOM = 25 * mm

    # Content area
    CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
    CONTENT_HEIGHT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM
    # Font settings (reduced for better fit)
    HEADER_FONT_SIZE = 11
    SUBHEADER_FONT_SIZE = 9
    TABLE_FONT_SIZE = 7
    FOOTER_FONT_SIZE = 6

    # Table dimensions (calculated from reference image)
    TABLE_ROW_HEIGHT = 12 * mm
    EMPLOYEE_ROWS_PER_BLOCK = 4  # Beginn, Pause, Ende, Summe/Tag
    EMPLOYEES_PER_PAGE = 8

    def __init__(self):
        """Initialize the MEP PDF generator."""
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
        self.data_processor = MEPDataProcessor()

        # Set German locale for date formatting
        try:
            locale.setlocale(locale.LC_TIME, "de_DE.UTF-8")
        except locale.Error:
            try:
                locale.setlocale(locale.LC_TIME, "German")
            except locale.Error:
                pass  # Fall back to default locale

    def _setup_custom_styles(self):
        """Set up custom paragraph styles for the MEP document."""
        self.header_style = ParagraphStyle(
            "MEPHeader",
            parent=self.styles["Normal"],
            fontSize=self.HEADER_FONT_SIZE,
            fontName="Helvetica-Bold",
            alignment=1,  # Center
            spaceAfter=6,
        )

        self.subheader_style = ParagraphStyle(
            "MEPSubHeader",
            parent=self.styles["Normal"],
            fontSize=self.SUBHEADER_FONT_SIZE,
            fontName="Helvetica",
            alignment=0,  # Left
        )

        self.table_cell_style = ParagraphStyle(
            "MEPTableCell",
            parent=self.styles["Normal"],
            fontSize=self.TABLE_FONT_SIZE,
            fontName="Helvetica",
            alignment=1,  # Center
            leading=8,  # Reduced leading for better fit
        )

        self.footer_style = ParagraphStyle(
            "MEPFooter",
            parent=self.styles["Normal"],
            fontSize=self.FOOTER_FONT_SIZE,
            fontName="Helvetica",
            alignment=0,  # Left
            leading=9,
        )

    def generate_mep_pdf(
        self,
        schedules: List[Schedule],
        start_date: datetime,
        end_date: datetime,
        filiale: str = "",
        layout_config: Optional[Dict[str, Any]] = None,
    ) -> io.BytesIO:
        """
        Generate MEP format PDF for the given schedules.

        Args:
            schedules: List of Schedule objects to include
            start_date: Start date for the schedule period
            end_date: End date for the schedule period
            filiale: Branch/store name for the header
            layout_config: Optional layout configuration

        Returns:
            BytesIO buffer containing the generated PDF
        """
        buffer = io.BytesIO()

        # Create document with landscape orientation
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=self.MARGIN_LEFT,
            rightMargin=self.MARGIN_RIGHT,
            topMargin=self.MARGIN_TOP,
            bottomMargin=self.MARGIN_BOTTOM,
        )

        # Build content
        story = []

        # Process schedule data using the data processor
        processed_data = self.data_processor.process_schedules_for_mep(
            schedules, start_date, end_date
        )

        # Calculate total pages needed
        total_employees = len(processed_data["employees"])
        total_pages = max(
            1,
            (total_employees + self.EMPLOYEES_PER_PAGE - 1) // self.EMPLOYEES_PER_PAGE,
        )

        # Generate pages
        for page_num in range(total_pages):
            if page_num > 0:
                story.append(PageBreak())

            # Add page content
            page_content = self._build_page_content(processed_data, filiale, page_num)
            story.extend(page_content)

        # Build the PDF
        doc.build(
            story, onFirstPage=self._draw_page_frame, onLaterPages=self._draw_page_frame
        )

        buffer.seek(0)
        return buffer

    def _build_page_content(
        self, processed_data: Dict[str, Any], filiale: str, page_num: int
    ) -> List:
        """Build content for a single page."""
        content = []

        # Add header
        content.extend(self._build_header(processed_data["date_info"], filiale))

        # Add main table
        page_employees = self._get_page_employees(processed_data["employees"], page_num)
        if page_employees:
            table = self._build_main_table(
                page_employees, processed_data["date_range_days"]
            )
            content.append(table)

        # Add footer (only on last page)
        if self._is_last_page(processed_data["employees"], page_num):
            content.extend(self._build_footer())

        return content

    def _build_header(self, date_info: Dict[str, str], filiale: str) -> List:
        """Build the MEP document header."""
        content = []

        # Main title with border
        title_table = Table(
            [
                [Paragraph("Mitarbeiter-Einsatz-Planung (MEP)", self.header_style)],
            ],
            colWidths=[self.CONTENT_WIDTH],
        )

        title_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 1, black),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("BACKGROUND", (0, 0), (-1, -1), white),
                ]
            )
        )

        content.append(title_table)
        content.append(Spacer(1, 6))

        # Date and Filiale information
        info_data = [
            [
                f"Monat/Jahr: {date_info['month_year']}",
                f"Woche vom: {date_info['week_from']}",
                f"bis: {date_info['week_to']}",
                f"Filiale: {filiale}",
                "Aufbewahrung in der Filiale: 2 Jahre",
            ]
        ]

        info_table = Table(
            info_data,
            colWidths=[
                self.CONTENT_WIDTH * 0.2,
                self.CONTENT_WIDTH * 0.2,
                self.CONTENT_WIDTH * 0.15,
                self.CONTENT_WIDTH * 0.2,
                self.CONTENT_WIDTH * 0.25,
            ],
        )

        info_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), self.SUBHEADER_FONT_SIZE),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )

        content.append(info_table)
        content.append(Spacer(1, 12))

        return content

    def _build_main_table(
        self, employee_schedules: Dict[int, Dict], date_range_days: List[Dict]
    ) -> Table:
        """Build the main schedule table."""

        # Build table data
        table_data = []

        # Header row 1: Main column headers
        header_row1 = [
            Paragraph("Name,<br/>Vorname", self.table_cell_style),
            Paragraph("Funktion", self.table_cell_style),
            Paragraph("Plan /<br/>Woche", self.table_cell_style),
        ]

        # Add day headers
        for day_info in date_range_days:
            day_name = day_info["name"]
            day_date = day_info["date_formatted"]
            header_row1.append(
                Paragraph(f"{day_name}<br/>{day_date}", self.table_cell_style)
            )
            # Each day has 4 sub-columns, add empty cells for colspan effect
            header_row1.extend(["", "", ""])

        header_row1.extend(
            [
                Paragraph("Summe /<br/>Woche", self.table_cell_style),
                Paragraph("Summe /<br/>Monat", self.table_cell_style),
            ]
        )

        table_data.append(header_row1)

        # Header row 2: Sub-column headers
        header_row2 = ["", "", ""]  # Empty for name, function, plan columns

        for _ in date_range_days:
            header_row2.extend(
                [
                    Paragraph("Beginn", self.table_cell_style),
                    Paragraph("Pause", self.table_cell_style),
                    Paragraph("Ende", self.table_cell_style),
                    Paragraph("Summe/Tag", self.table_cell_style),
                ]
            )

        header_row2.extend(["", ""])  # Empty for weekly/monthly sum columns

        table_data.append(header_row2)

        # Employee data rows
        for emp_id, emp_data in employee_schedules.items():
            employee_info = emp_data["employee_info"]
            daily_schedules = emp_data["daily_schedules"]

            # Employee row
            emp_row = [
                Paragraph(
                    f"{employee_info['first_name']}<br/>{employee_info['last_name']}",
                    self.table_cell_style,
                ),
                Paragraph(employee_info["position"], self.table_cell_style),
                "",  # Plan/Woche - could show contracted hours if needed
            ]

            # Add schedule data for each day
            for day_info in date_range_days:
                date_str = day_info["date"].strftime("%Y-%m-%d")
                daily_data = daily_schedules.get(date_str, {})

                start_time = daily_data.get("start_time", "")
                end_time = daily_data.get("end_time", "")
                break_start = daily_data.get("break_start", "")
                daily_sum = daily_data.get("hours_formatted", "")

                # Format break time for display
                break_display = break_start if break_start else ""

                emp_row.extend([start_time, break_display, end_time, daily_sum])

            # Add weekly and monthly totals
            emp_row.extend(
                [
                    emp_data["weekly_hours_formatted"],
                    emp_data["monthly_hours_formatted"],
                ]
            )
            table_data.append(emp_row)

        # Fill empty rows if needed (reduced to fewer employees per page for testing)
        max_employees_on_page = min(
            self.EMPLOYEES_PER_PAGE, 4
        )  # Limit to 4 employees for testing
        while len(table_data) < max_employees_on_page + 2:  # +2 for header rows
            empty_row = [""] * len(table_data[0]) if table_data else []
            table_data.append(empty_row)

        # Create table with calculated column widths
        col_widths = self._calculate_column_widths(len(date_range_days))
        table = Table(table_data, colWidths=col_widths, repeatRows=2)

        # Apply table styling
        table.setStyle(self._get_table_style(len(date_range_days)))

        return table

    def _calculate_column_widths(self, num_days: int) -> List[float]:
        """Calculate column widths for the table."""
        # Fixed columns (reduced sizes to fit more content)
        name_width = 30 * mm
        function_width = 18 * mm
        plan_width = 15 * mm
        weekly_width = 18 * mm
        monthly_width = 18 * mm

        # Remaining width for day columns
        fixed_width = (
            name_width + function_width + plan_width + weekly_width + monthly_width
        )
        remaining_width = self.CONTENT_WIDTH - fixed_width

        # Ensure we don't exceed page width
        if remaining_width <= 0:
            # Fallback: distribute evenly with minimal sizes
            total_cols = 5 + (num_days * 4)  # 5 fixed + 4 per day
            col_width = self.CONTENT_WIDTH / total_cols
            return [col_width] * total_cols

        # Each day has 4 sub-columns
        day_total_width = remaining_width / num_days if num_days > 0 else 0
        day_sub_width = day_total_width / 4

        # Ensure minimum width for readability
        min_day_sub_width = 8 * mm
        if day_sub_width < min_day_sub_width:
            day_sub_width = min_day_sub_width

        col_widths = [name_width, function_width, plan_width]

        for _ in range(num_days):
            col_widths.extend([day_sub_width] * 4)

        col_widths.extend([weekly_width, monthly_width])

        # Final check - ensure total doesn't exceed content width
        total_width = sum(col_widths)
        if total_width > self.CONTENT_WIDTH:
            # Scale down proportionally
            scale_factor = self.CONTENT_WIDTH / total_width
            col_widths = [w * scale_factor for w in col_widths]

        return col_widths

    def _get_table_style(self, num_days: int) -> TableStyle:
        """Get the table style for the main schedule table."""
        style_commands = [
            # Grid
            ("GRID", (0, 0), (-1, -1), 0.5, black),
            # Header styling
            ("BACKGROUND", (0, 0), (-1, 1), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), self.TABLE_FONT_SIZE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            # Name column left alignment
            ("ALIGN", (0, 2), (0, -1), "LEFT"),
            ("ALIGN", (1, 2), (1, -1), "LEFT"),
        ]

        # Add column spans for day headers in first row
        day_start_col = 3
        for i in range(num_days):
            col_start = day_start_col + (i * 4)
            col_end = col_start + 3
            style_commands.append(("SPAN", (col_start, 0), (col_end, 0)))

        return TableStyle(style_commands)

    def _build_footer(self) -> List:
        """Build the MEP document footer."""
        content = []

        content.append(Spacer(1, 12))

        # Pausenzeiten section
        pause_text = (
            "Pausenzeiten: bis 6 Stunden : keine Pause, mehr als 6 Stunden : 60 Minuten"
        )
        content.append(Paragraph(pause_text, self.footer_style))
        content.append(Spacer(1, 6))

        # Abwesenheiten section
        absence_text = (
            "Abwesenheiten: Feiertag, Krankheit (AU-Bescheinigung), "
            "Freizeit, Schule (Führungsnachwuchskraft), Urlaub"
        )
        content.append(Paragraph(absence_text, self.footer_style))
        content.append(Spacer(1, 6))

        # Instructions
        instructions_text = (
            "Anwesenheiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten "
            "und die Tagesstunden eintragen. Am Ende der Woche: wöchentliche und "
            "monatliche Summe eintragen."
        )
        content.append(Paragraph(instructions_text, self.footer_style))
        content.append(Spacer(1, 6))

        # Date stamp
        current_date = datetime.now().strftime("%B %Y")
        date_text = f"Stand: {current_date}"
        content.append(Paragraph(date_text, self.footer_style))

        return content

    def _get_page_employees(
        self, employee_schedules: Dict[int, Dict], page_num: int
    ) -> Dict[int, Dict]:
        """Get employees for a specific page."""
        employee_items = list(employee_schedules.items())
        start_idx = page_num * self.EMPLOYEES_PER_PAGE
        end_idx = min(start_idx + self.EMPLOYEES_PER_PAGE, len(employee_items))

        return dict(employee_items[start_idx:end_idx])

    def _is_last_page(self, employee_schedules: Dict[int, Dict], page_num: int) -> bool:
        """Check if this is the last page."""
        total_employees = len(employee_schedules)
        total_pages = max(
            1,
            (total_employees + self.EMPLOYEES_PER_PAGE - 1) // self.EMPLOYEES_PER_PAGE,
        )
        return page_num == total_pages - 1

    def _draw_page_frame(self, canvas, doc):
        """Draw page frame and any additional page elements."""
        # Could add page numbers or other page-level elements here
        pass


# Import necessary classes for page break
from reportlab.platypus import PageBreak
