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
        self,
        schedules: List[Schedule],
        start_date: datetime,
        end_date: datetime,
        layout_config=None,
    ) -> io.BytesIO:
        """Generate a PDF schedule in MEP format

        Args:
            schedules: List of schedules to include in the PDF
            start_date: Start date of the schedule period
            end_date: End date of the schedule period
            layout_config: Optional configuration for PDF layout
        """
        buffer = io.BytesIO()

        try:
            # Apply custom layout configuration if provided
            page_size = A4
            orientation_func = landscape
            margins = 15 * mm

            if layout_config:
                # Handle page size
                if layout_config.get("page", {}).get("size"):
                    page_size_str = layout_config["page"]["size"]
                    if page_size_str == "Letter":
                        from reportlab.lib.pagesizes import LETTER

                        page_size = LETTER
                    elif page_size_str == "Legal":
                        from reportlab.lib.pagesizes import LEGAL

                        page_size = LEGAL
                    # Default is A4

                # Handle orientation
                if layout_config.get("page", {}).get("orientation") == "portrait":
                    orientation_func = lambda x: x  # Identity function for portrait

                # Handle margins
                if layout_config.get("margins"):
                    margins = {
                        "leftMargin": layout_config["margins"].get("left", 15) * mm,
                        "rightMargin": layout_config["margins"].get("right", 15) * mm,
                        "topMargin": layout_config["margins"].get("top", 15) * mm,
                        "bottomMargin": layout_config["margins"].get("bottom", 15) * mm,
                    }
                else:
                    margins = {
                        "leftMargin": 15 * mm,
                        "rightMargin": 15 * mm,
                        "topMargin": 15 * mm,
                        "bottomMargin": 15 * mm,
                    }

            # Create the PDF document with potentially customized settings
            if isinstance(margins, dict):
                doc = SimpleDocTemplate(
                    buffer, pagesize=orientation_func(page_size), **margins
                )
            else:
                doc = SimpleDocTemplate(
                    buffer,
                    pagesize=orientation_func(page_size),
                    leftMargin=margins,
                    rightMargin=margins,
                    topMargin=margins,
                    bottomMargin=margins,
                )

            # Build the document content
            story = []

            # Apply custom title styling if provided
            title_style = self.title_style
            if layout_config and layout_config.get("title"):
                title_config = layout_config["title"]
                title_style = ParagraphStyle(
                    "CustomTitle",
                    parent=self.styles["Heading1"],
                    fontSize=title_config.get("fontSize", 14),
                    spaceAfter=10,
                    alignment=1
                    if title_config.get("alignment") == "center"
                    else (0 if title_config.get("alignment") == "left" else 2),
                )

            # Add MEP header with potentially customized title
            title_text = "Mitarbeiter-Einsatz-Planung (MEP)"
            if layout_config and layout_config.get("content", {}).get("title"):
                title_text = layout_config["content"]["title"]

            title = Paragraph(title_text, title_style)
            story.append(title)

            # Add subheader with dates
            subtitle_text = f"Filiale: {self.settings.branch_number}<br/>Woche vom: {start_date.strftime('%d.%m.%y')} bis: {end_date.strftime('%d.%m.%y')}"
            if layout_config and layout_config.get("content", {}).get("subtitle"):
                subtitle_text = layout_config["content"]["subtitle"]
                if "{start_date}" in subtitle_text:
                    subtitle_text = subtitle_text.replace(
                        "{start_date}", start_date.strftime("%d.%m.%y")
                    )
                if "{end_date}" in subtitle_text:
                    subtitle_text = subtitle_text.replace(
                        "{end_date}", end_date.strftime("%d.%m.%y")
                    )

            subheader = Paragraph(subtitle_text, self.header_style)
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

            # Group schedules by employee
            employees_schedules = {}
            for schedule in schedules:
                if not hasattr(schedule, "employee_id") or not schedule.employee_id:
                    print(f"Warning: Schedule {schedule.id} has no employee_id")
                    continue

                if not hasattr(schedule, "employee") or not schedule.employee:
                    print(f"Warning: Schedule {schedule.id} has no employee relation")
                    continue

                if schedule.employee_id not in employees_schedules:
                    employees_schedules[schedule.employee_id] = {
                        "employee": schedule.employee,
                        "schedules": [],
                    }
                employees_schedules[schedule.employee_id]["schedules"].append(schedule)

            # Add data rows for each employee
            for employee_data in employees_schedules.values():
                employee = employee_data["employee"]
                employee_schedules = employee_data["schedules"]

                row = [
                    f"{employee.last_name}, {employee.first_name}",
                    getattr(
                        employee, "position", employee.employee_group
                    ),  # Use employee_group if position doesn't exist
                    f"{employee.contracted_hours}:00",
                ]

                # Add shifts for each day
                current_date = start_date
                weekly_hours = 0

                while current_date <= end_date:
                    # Find schedule for this day
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
                        cell_content = [
                            f"Beginn: {shift.start_time}",
                        ]
                        if (
                            hasattr(schedule, "break_start")
                            and hasattr(schedule, "break_end")
                            and schedule.break_start
                            and schedule.break_end
                        ):
                            cell_content.extend(
                                [
                                    f"Pause: {schedule.break_start}",
                                    f"Ende: {schedule.break_end}",
                                ]
                            )
                        cell_content.append(f"Ende: {shift.end_time}")

                        # Calculate hours for this shift
                        shift_hours = shift.duration_hours
                        if (
                            hasattr(schedule, "break_start")
                            and hasattr(schedule, "break_end")
                            and schedule.break_start
                            and schedule.break_end
                        ):
                            # Subtract break time
                            try:
                                break_start_hour, break_start_min = map(
                                    int, schedule.break_start.split(":")
                                )
                                break_end_hour, break_end_min = map(
                                    int, schedule.break_end.split(":")
                                )
                                break_start_mins = (
                                    break_start_hour * 60 + break_start_min
                                )
                                break_end_mins = break_end_hour * 60 + break_end_min
                                break_duration = (
                                    break_end_mins - break_start_mins
                                ) / 60
                                shift_hours -= break_duration
                            except (ValueError, AttributeError) as e:
                                print(f"Error calculating break duration: {e}")

                        cell_content.append(f"Summe/Tag: {shift_hours:.2f}h")
                        weekly_hours += shift_hours

                        row.append("\n".join(cell_content))
                    else:
                        row.append("")

                    current_date += timedelta(days=1)

                # Add weekly and monthly sums
                monthly_hours = weekly_hours * 4.33  # Average weeks per month
                row.extend(
                    [
                        f"{weekly_hours:.2f}h",
                        f"{monthly_hours:.2f}h",
                    ]
                )

                table_data.append(row)

            # Create table with specific column widths
            col_widths = (
                [40 * mm, 20 * mm, 25 * mm] + [30 * mm] * 7 + [25 * mm, 25 * mm]
            )
            table = Table(table_data, colWidths=col_widths, repeatRows=1)

            # Create table style
            table_style = TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), black),
                    ("TEXTCOLOR", (0, 0), (-1, 0), white),
                    ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                    ("BACKGROUND", (0, 1), (-1, -1), white),
                    ("GRID", (0, 0), (-1, -1), 1, black),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (0, 0), (0, -1), "LEFT"),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ]
            )

            # Apply custom table styling if provided
            if layout_config and layout_config.get("table", {}).get("style"):
                table_style_config = layout_config["table"]["style"]

                # Update header background color
                if table_style_config.get("headerBackground"):
                    from reportlab.lib.colors import HexColor

                    try:
                        header_bg = HexColor(table_style_config["headerBackground"])
                        table_style.add("BACKGROUND", (0, 0), (-1, 0), header_bg)
                    except:
                        # Fallback to default if color parsing fails
                        pass

                # Update font size
                if table_style_config.get("fontSize"):
                    font_size = table_style_config["fontSize"]
                    table_style.add("FONTSIZE", (0, 0), (-1, -1), font_size)
                    table_style.add(
                        "FONTSIZE", (0, 0), (-1, 0), font_size + 1
                    )  # Header slightly larger

                # Update alternate row colors
                if table_style_config.get(
                    "alternateRowColors"
                ) and table_style_config.get("alternateRowBackground"):
                    try:
                        alt_bg = HexColor(table_style_config["alternateRowBackground"])
                        for i in range(
                            2, len(table_data), 2
                        ):  # Start from row 2 (index 1) and take every other row
                            table_style.add("BACKGROUND", (0, i), (-1, i), alt_bg)
                    except:
                        # Fallback if color parsing fails
                        pass

            table.setStyle(table_style)

            story.append(table)

            # Add footer
            footer_text = [
                "h : 60 Minuten",
                "Anwesenheiten: Arbeitszeitbeginn bis Arbeitszeitende inkl. Pausenzeiten und die Tagesstunden eintragen.",
                "Am Ende der Woche: wöchentliche und monatliche Summe eintragen.",
                "Abwesenheiten: Feiertag, Krankheit (AU-Bescheinigung), Freizeit, Schule (Führungsnachweis), Urlaub",
            ]

            # Use custom footer if provided
            if layout_config and layout_config.get("content", {}).get("footer"):
                custom_footer = layout_config["content"]["footer"]
                if custom_footer:
                    footer_text = [custom_footer]

            story.append(Spacer(1, 10))
            for text in footer_text:
                story.append(Paragraph(text, self.styles["Normal"]))
                story.append(Spacer(1, 4))

            # Build PDF
            doc.build(story)
            buffer.seek(0)
            return buffer
        except Exception as e:
            import traceback

            print(f"Error generating PDF: {str(e)}")
            print(traceback.format_exc())
            raise
