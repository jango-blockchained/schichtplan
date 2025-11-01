"""
MEP PDF Generator for German Mitarbeiter-Einsatz-Planung format.

This module generates PDF documents that match the standard German MEP
(Mitarbeiter-Einsatz-Planung) template format as used in retail and
service industries for employee shift planning.
"""

import io
import locale
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.colors import black, white
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
    ROWS_PER_EMPLOYEE = 5  # Tätigkeit, Beginn, Pause, Ende, Summe/Tag
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
        schedules: list[Schedule],
        start_date: datetime,
        end_date: datetime,
        filiale: str = "",
        layout_config: dict[str, Any] | None = None,
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
        self, processed_data: dict[str, Any], filiale: str, page_num: int
    ) -> list:
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

    def _build_header(self, date_info: dict[str, str], filiale: str) -> list:
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
        self, employee_schedules: dict[int, dict], date_range_days: list[dict]
    ) -> Table:
        """Build the main schedule table with vertical structure per employee."""

        # Build table data
        table_data = []

        # Header row: Column headers
        header_row = [
            Paragraph("Name,<br/>Vorname", self.table_cell_style),
            Paragraph("Funktion", self.table_cell_style),
            Paragraph("Plan /<br/>Woche", self.table_cell_style),
            Paragraph("", self.table_cell_style),  # Row label column header (empty)
        ]

        # Add one column per day
        for day_info in date_range_days:
            day_name = day_info["name"]
            day_date = day_info["date_formatted"]
            header_row.append(
                Paragraph(f"{day_name}<br/>{day_date}", self.table_cell_style)
            )

        # Add summary columns
        header_row.extend(
            [
                Paragraph("Summe /<br/>Woche", self.table_cell_style),
                Paragraph("Summe /<br/>Monat", self.table_cell_style),
            ]
        )

        table_data.append(header_row)

        # For each employee, create 6 rows (Datum, Wer/tätig, Beginn, Pause, Ende, Summe/Tag)
        row_labels = ["Datum", "Wer/tätig", "Beginn", "Pause", "Ende", "Summe/Tag"]

        for emp_id, emp_data in employee_schedules.items():
            employee_info = emp_data["employee_info"]
            daily_schedules = emp_data["daily_schedules"]

            # Employee base info (will be merged vertically across 6 rows)
            emp_name = Paragraph(
                f"{employee_info['first_name']}<br/>{employee_info['last_name']}",
                self.table_cell_style,
            )
            emp_position = Paragraph(employee_info["position"], self.table_cell_style)
            emp_plan = ""  # Plan/Woche - could show contracted hours if needed
            emp_weekly = emp_data["weekly_hours_formatted"]
            emp_monthly = emp_data["monthly_hours_formatted"]

            # Create 6 rows for this employee
            for row_idx, row_label in enumerate(row_labels):
                if row_idx == 0:
                    # First row: include employee info
                    row = [emp_name, emp_position, emp_plan, row_label]
                else:
                    # Subsequent rows: empty cells for merged employee info
                    row = ["", "", "", row_label]

                # Add data for each day based on row type
                for day_info in date_range_days:
                    date_str = day_info["date"].strftime("%Y-%m-%d")
                    daily_data = daily_schedules.get(date_str, {})

                    if row_label == "Datum":
                        cell_value = day_info["date_formatted"]
                    elif row_label == "Wer/tätig":
                        # Show 'X' if employee is scheduled, empty if not
                        cell_value = "X" if daily_data.get("start_time", "") else ""
                    elif row_label == "Beginn":
                        cell_value = daily_data.get("start_time", "")
                    elif row_label == "Pause":
                        cell_value = daily_data.get("break_start", "")
                    elif row_label == "Ende":
                        cell_value = daily_data.get("end_time", "")
                    elif row_label == "Summe/Tag":
                        cell_value = daily_data.get("hours_formatted", "")
                    else:
                        cell_value = ""

                    row.append(cell_value)

                # Add summary columns (only on first row)
                if row_idx == 0:
                    row.extend([emp_weekly, emp_monthly])
                else:
                    row.extend(["", ""])

                table_data.append(row)

        # Fill empty rows if needed to maintain page structure
        max_employees_on_page = min(
            self.EMPLOYEES_PER_PAGE, 4
        )  # Limit to 4 employees for better readability
        current_employees = len(employee_schedules)

        # Add empty employee blocks if needed
        for emp_idx in range(current_employees, max_employees_on_page):
            for row_idx in range(6):  # 6 rows per employee
                empty_row = [""] * len(table_data[0]) if table_data else []
                table_data.append(empty_row)

        # Create table with calculated column widths
        col_widths = self._calculate_column_widths(len(date_range_days))
        table = Table(
            table_data, colWidths=col_widths, repeatRows=1
        )  # Only repeat header row

        # Apply table styling
        table.setStyle(
            self._get_table_style(len(date_range_days), len(employee_schedules))
        )

        return table

    def _calculate_column_widths(self, num_days: int) -> list[float]:
        """Calculate column widths for the table with vertical structure."""
        # Fixed columns (adjusted for vertical structure)
        name_width = 35 * mm
        function_width = 20 * mm
        plan_width = 15 * mm
        row_label_width = 20 * mm  # New column for row labels
        weekly_width = 20 * mm
        monthly_width = 20 * mm

        # Remaining width for day columns
        fixed_width = (
            name_width
            + function_width
            + plan_width
            + row_label_width
            + weekly_width
            + monthly_width
        )
        remaining_width = self.CONTENT_WIDTH - fixed_width

        # Ensure we don't exceed page width
        if remaining_width <= 0:
            # Fallback: distribute evenly with minimal sizes
            total_cols = 6 + num_days  # 6 fixed + 1 per day
            col_width = self.CONTENT_WIDTH / total_cols
            return [col_width] * total_cols

        # Each day has one column (vertical structure)
        day_width = remaining_width / num_days if num_days > 0 else 0

        # Ensure minimum width for readability
        min_day_width = 18 * mm
        day_width = max(day_width, min_day_width)

        col_widths = [name_width, function_width, plan_width, row_label_width]

        # Add one column per day
        for _ in range(num_days):
            col_widths.append(day_width)

        col_widths.extend([weekly_width, monthly_width])

        # Final check - ensure total doesn't exceed content width
        total_width = sum(col_widths)
        if total_width > self.CONTENT_WIDTH:
            # Scale down proportionally
            scale_factor = self.CONTENT_WIDTH / total_width
            col_widths = [w * scale_factor for w in col_widths]

        return col_widths

    def _get_table_style(self, num_days: int, num_employees: int) -> TableStyle:
        """Get the table style for the main schedule table with vertical structure."""
        style_commands = [
            # Grid
            ("GRID", (0, 0), (-1, -1), 0.5, black),
            # Header styling
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), self.TABLE_FONT_SIZE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            # Name and function columns left alignment
            ("ALIGN", (0, 1), (0, -1), "LEFT"),
            ("ALIGN", (1, 1), (1, -1), "LEFT"),
            # Row label column left alignment
            ("ALIGN", (3, 1), (3, -1), "LEFT"),
        ]

        # Add row spans for employee info (spans 6 rows per employee)
        # Starting from row 1 (after header), every 6 rows represent one employee
        employee_start_row = 1

        for emp_idx in range(num_employees):
            row_start = employee_start_row + (emp_idx * 6)
            row_end = row_start + 5  # Span 6 rows

            # Span employee name, function, plan, weekly sum, monthly sum across 6 rows
            style_commands.extend(
                [
                    ("SPAN", (0, row_start), (0, row_end)),  # Name column
                    ("SPAN", (1, row_start), (1, row_end)),  # Function column
                    ("SPAN", (2, row_start), (2, row_end)),  # Plan column
                    # Row label column (3) is NOT spanned - each row shows its label
                    ("SPAN", (-2, row_start), (-2, row_end)),  # Weekly sum column
                    ("SPAN", (-1, row_start), (-1, row_end)),  # Monthly sum column
                ]
            )

        return TableStyle(style_commands)

    def _build_footer(self) -> list:
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
        self, employee_schedules: dict[int, dict], page_num: int
    ) -> dict[int, dict]:
        """Get employees for a specific page."""
        employee_items = list(employee_schedules.items())
        start_idx = page_num * self.EMPLOYEES_PER_PAGE
        end_idx = min(start_idx + self.EMPLOYEES_PER_PAGE, len(employee_items))

        return dict(employee_items[start_idx:end_idx])

    def _is_last_page(self, employee_schedules: dict[int, dict], page_num: int) -> bool:
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
