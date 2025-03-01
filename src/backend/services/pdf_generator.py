from datetime import datetime, timedelta
from typing import List
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import black, white
from models import Schedule, Settings
import io


class PDFGenerator:
    def __init__(self):
        self.settings = Settings.query.first()
        if not self.settings:
            self.settings = Settings.get_default_settings()

        self.styles = getSampleStyleSheet()
        self.title_style = ParagraphStyle(
            "CustomTitle",
            parent=self.styles["Heading1"],
            fontSize=14,
            spaceAfter=10,
            alignment=1,  # Center alignment
        )

        # Define custom styles for MEP form
        self.header_style = ParagraphStyle(
            "Header",
            parent=self.styles["Normal"],
            fontSize=12,
            leading=14,
        )

        self.cell_style = ParagraphStyle(
            "Cell",
            parent=self.styles["Normal"],
            fontSize=10,
            leading=12,
            alignment=1,  # Center alignment
        )

    def generate_schedule_pdf(
        self, schedules: List[Schedule], start_date: datetime, end_date: datetime
    ) -> io.BytesIO:
        """Generate a PDF schedule in MEP format"""
        buffer = io.BytesIO()

        # Create the PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        # Build the document content
        story = []

        # Add MEP header
        title = Paragraph("Mitarbeiter-Einsatz-Planung (MEP)", self.title_style)
        story.append(title)

        # Add subheader with dates
        subheader = Paragraph(
            f"Filiale: {self.settings.branch_number}<br/>"
            f"Woche vom: {start_date.strftime('%d.%m.%y')} bis: {end_date.strftime('%d.%m.%y')}",
            self.header_style,
        )
        story.append(subheader)
        story.append(Spacer(1, 10))

        # Create schedule table
        table_data = []

        # Add header row
        headers = ["Name, Vorname", "Position", "Plan / Woche"]
        current_date = start_date
        while current_date <= end_date:
            headers.append(current_date.strftime("%A\n%d.%m"))
            current_date += timedelta(days=1)
        headers.extend(["Summe /\nWoche", "Summe /\nMonat"])
        table_data.append(headers)

        # Add data rows
        for schedule in schedules:
            employee = schedule.employee
            row = [
                f"{employee.last_name}, {employee.first_name}",
                employee.position,
                f"{employee.contracted_hours}:00",
            ]

            # Add shifts for each day
            current_date = start_date
            while current_date <= end_date:
                shift = next(
                    (s for s in schedule.shifts if s.date == current_date.date()), None
                )

                if shift:
                    cell_content = [
                        f"Beginn: {shift.start_time.strftime('%H:%M')}",
                    ]
                    if shift.break_start and shift.break_end:
                        cell_content.extend(
                            [
                                f"Pause: {shift.break_start.strftime('%H:%M')}",
                                f"Ende: {shift.break_end.strftime('%H:%M')}",
                            ]
                        )
                    cell_content.append(f"Ende: {shift.end_time.strftime('%H:%M')}")
                    cell_content.append(f"Summe/Tag: {self._calculate_hours(shift)}")

                    row.append("\n".join(cell_content))
                else:
                    row.append("")

                current_date += timedelta(days=1)

            # Add weekly and monthly sums
            row.extend(
                [
                    self._calculate_weekly_hours(schedule.shifts),
                    self._calculate_monthly_hours(schedule.shifts),
                ]
            )

            table_data.append(row)

        # Create table with specific column widths
        col_widths = [40 * mm, 20 * mm, 25 * mm] + [30 * mm] * 7 + [25 * mm, 25 * mm]
        table = Table(table_data, colWidths=col_widths, repeatRows=1)

        # Apply table style
        style = TableStyle(
            [
                # Headers
                ("BACKGROUND", (0, 0), (-1, 0), white),
                ("TEXTCOLOR", (0, 0), (-1, 0), black),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                # Cell content
                ("BACKGROUND", (0, 1), (-1, -1), white),
                ("TEXTCOLOR", (0, 1), (-1, -1), black),
                ("ALIGN", (0, 1), (-1, -1), "CENTER"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), 10),
                # Grid
                ("GRID", (0, 0), (-1, -1), 1, black),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
        table.setStyle(style)

        story.append(table)

        # Add footer
        footer_text = [
            "h : 60 Minuten",
            "Anwesenheiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.",
            "Am Ende der Woche: wöchentliche und monatliche Summe eintragen.",
            "Abwesenheiten: Feiertag, Krankheit (AU-Bescheinigung), Freizeit, Schule (Führungsnachweis), Urlaub",
        ]

        story.append(Spacer(1, 10))
        for text in footer_text:
            story.append(Paragraph(text, self.styles["Normal"]))
            story.append(Spacer(1, 4))

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

    def _calculate_hours(self, shift) -> str:
        """Calculate total hours for a shift in HH:MM format"""
        if not shift.start_time or not shift.end_time:
            return "00:00"

        total_minutes = (shift.end_time - shift.start_time).total_seconds() / 60
        if shift.break_start and shift.break_end:
            break_minutes = (shift.break_end - shift.break_start).total_seconds() / 60
            total_minutes -= break_minutes

        hours = int(total_minutes // 60)
        minutes = int(total_minutes % 60)
        return f"{hours:02d}:{minutes:02d}"

    def _calculate_weekly_hours(self, shifts) -> str:
        """Calculate total weekly hours in HH:MM format"""
        total_minutes = sum(
            (shift.end_time - shift.start_time).total_seconds() / 60
            - (
                (shift.break_end - shift.break_start).total_seconds() / 60
                if shift.break_start and shift.break_end
                else 0
            )
            for shift in shifts
            if shift.start_time and shift.end_time
        )

        hours = int(total_minutes // 60)
        minutes = int(total_minutes % 60)
        return f"{hours:02d}:{minutes:02d}"

    def _calculate_monthly_hours(self, shifts) -> str:
        """Calculate projected monthly hours (weekly * 4.33) in HH:MM format"""
        weekly_minutes = sum(
            (shift.end_time - shift.start_time).total_seconds() / 60
            - (
                (shift.break_end - shift.break_start).total_seconds() / 60
                if shift.break_start and shift.break_end
                else 0
            )
            for shift in shifts
            if shift.start_time and shift.end_time
        )

        # Multiply by 4.33 (average weeks per month)
        total_minutes = weekly_minutes * 4.33
        hours = int(total_minutes // 60)
        minutes = int(total_minutes % 60)
        return f"{hours:02d}:{minutes:02d}"
