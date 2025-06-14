# src/backend/services/ai_scheduler_service.py

from src.backend.models import (
    db,
    Employee,
    ShiftTemplate,
    Coverage,
    Absence,
    EmployeeAvailability,
    Schedule,
)  # Added Schedule model
from src.backend.utils.logger import (
    logger,
)  # Corrected: import the global logger instance
from src.backend.services.scheduler.logging_utils import ProcessTracker
import json
import requests
import os
import logging
import csv
import uuid
from io import StringIO
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.exc import SQLAlchemyError
from src.backend.schemas.ai_schedule import (
    AIScheduleFeedbackRequest,
)  # Import the feedback schema

# Get src/logs path - fix for log location
SRC_DIR = Path(__file__).resolve().parent.parent.parent
LOGS_DIR = SRC_DIR / "logs"
DIAGNOSTICS_DIR = LOGS_DIR / "diagnostics"


class AISchedulerService:
    def __init__(self):
        self.gemini_api_key = self._load_api_key_from_settings()
        self.gemini_model_name = (
            "gemini-1.5-flash"  # Using the more available gemini-1.5-flash model
        )
        self.default_model_params = {
            "generationConfig": {
                "temperature": 0.6,
                "topP": 0.95,
                "topK": 40,
                "maxOutputTokens": 8192,
            },
            "safetySettings": [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE",
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE",
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE",
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_MEDIUM_AND_ABOVE",
                },
            ],
        }
        logger.app_logger.info(
            f"AISchedulerService initialized for model: {self.gemini_model_name}"
        )  # Use logger.app_logger

    def _load_api_key_from_settings(self):
        """Load Gemini API key from settings or environment variables"""
        # The key is expected to be in an environment variable named GEMINI_API_KEY
        api_key = os.environ.get("GEMINI_API_KEY", None)

        if not api_key:
            logger.app_logger.warning(
                "No Gemini API key found in environment. AI scheduling will not function."
            )  # Use logger.app_logger
            return None

        return api_key

    def _initialize_process_tracker(self, process_name="AI Schedule Generation"):
        """Initialize a ProcessTracker for detailed diagnostics"""
        # Create a unique session ID for this generation run
        session_id = str(uuid.uuid4())[:8]

        # Make sure the diagnostics directory exists
        os.makedirs(DIAGNOSTICS_DIR, exist_ok=True)

        # Create the diagnostic log file path
        diagnostic_log_path = DIAGNOSTICS_DIR / f"schedule_diagnostic_{session_id}.log"

        # Set up a diagnostic logger with the correct path
        diagnostic_logger = logging.getLogger(f"ai_scheduler_diagnostic_{session_id}")
        diagnostic_logger.setLevel(logging.DEBUG)
        diagnostic_logger.propagate = False

        if not diagnostic_logger.handlers:
            # Create a file handler
            file_handler = logging.FileHandler(diagnostic_log_path)
            formatter = logging.Formatter(
                "%(asctime)s.%(msecs)03d - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s",
                "%Y-%m-%d %H:%M:%S",
            )
            file_handler.setFormatter(formatter)
            diagnostic_logger.addHandler(file_handler)

            # Log initialization
            diagnostic_logger.info(
                f"===== AI Schedule Generation Diagnostic Log (Session: {session_id}) ====="
            )
            diagnostic_logger.info(f"Log file path: {diagnostic_log_path}")

        # Create a process tracker
        process_tracker = ProcessTracker(
            process_name=process_name,
            schedule_logger=logger.app_logger,
            diagnostic_logger=diagnostic_logger,
        )

        # Store the session ID and log path for later reference
        self.session_id = session_id
        self.diagnostic_log_path = str(diagnostic_log_path)

        # Start the tracking process
        process_tracker.start_process()

        return process_tracker

    def _validate_shift_coverage_alignment(self, shift_data, coverage_data, tracker=None):
        """Validate that we have sufficient shift templates to potentially cover coverage requirements"""
        if not shift_data:
            warning_msg = "No shift templates available for scheduling"
            if tracker:
                tracker.log_warning(warning_msg)
            else:
                logger.app_logger.warning(warning_msg)
            return False
        
        if not coverage_data:
            warning_msg = "No coverage requirements defined"
            if tracker:
                tracker.log_warning(warning_msg)
            else:
                logger.app_logger.warning(warning_msg)
            return False
        
        # Log available resources for debugging
        if tracker:
            tracker.log_info(f"Available shift templates: {len(shift_data)}")
            for shift in shift_data:
                tracker.log_info(f"  - {shift['name']}: {shift['start_time']}-{shift['end_time']} ({shift['shift_type']})")
            
            tracker.log_info(f"Coverage requirements: {len(coverage_data)}")
            coverage_periods = set()
            for coverage in coverage_data:
                coverage_periods.add(coverage["time_period"])
            for period in sorted(coverage_periods):
                tracker.log_info(f"  - {period}")
        
        return True

    def _get_shift_template_summary(self, shift_data):
        """Generate a summary of shift templates for debugging and validation"""
        if not shift_data:
            return "No shift templates available"
        
        summary = f"Available Shift Templates ({len(shift_data)}):\n"
        for shift in shift_data:
            summary += f"  ID {shift['id']}: {shift['name']} ({shift['start_time']}-{shift['end_time']}, {shift['duration_hours']}h, {shift['shift_type']})\n"
        
        return summary

    def _collect_data_for_ai_prompt(self, start_date, end_date, tracker=None):
        """Collect optimized data for AI prompt generation with reduced redundancy"""
        if tracker:
            tracker.start_step("Collect Data for AI Prompt")
            tracker.log_info(
                f"Collecting optimized data for AI prompt from {start_date} to {end_date}."
            )
        else:
            logger.app_logger.info(
                f"Collecting optimized data for AI prompt from {start_date} to {end_date}."
            )

        try:
            # Initialize an empty dictionary to hold collected data
            collected_data = {}

            # Get target weekdays for filtering
            target_weekdays = set()
            current_date = start_date
            while current_date <= end_date:
                target_weekdays.add(current_date.weekday())
                current_date += timedelta(days=1)

            # 1. Get active employees with availability pre-filtering
            employees = Employee.query.filter_by(is_active=True).all()
            
            # Pre-filter employees who have some availability or no blocking absences
            filtered_employees = []
            for emp in employees:
                # Check if employee has any availability during the period
                has_availability = EmployeeAvailability.query.filter(
                    EmployeeAvailability.employee_id == emp.id,
                    db.or_(
                        EmployeeAvailability.is_recurring.is_(True),
                        db.and_(
                            db.or_(EmployeeAvailability.start_date.is_(None), EmployeeAvailability.start_date <= end_date),
                            db.or_(EmployeeAvailability.end_date.is_(None), EmployeeAvailability.end_date >= start_date)
                        )
                    )
                ).first() is not None
                
                # Check if employee has blocking absences for entire period
                blocking_absence = Absence.query.filter(
                    Absence.employee_id == emp.id,
                    Absence.start_date <= start_date,
                    Absence.end_date >= end_date
                ).first() is not None
                
                # Include employee if they have availability and no blocking absence
                if has_availability and not blocking_absence:
                    filtered_employees.append(emp)

            employee_data = []
            for emp in filtered_employees:
                emp_dict = {
                    "id": emp.id,
                    "name": f"{emp.first_name} {emp.last_name}",
                    "role": emp.employee_group.value if emp.employee_group else "UNKNOWN",
                    "is_keyholder": emp.is_keyholder,
                    "max_weekly_hours": emp.get_max_weekly_hours() or 40,
                }
                employee_data.append(emp_dict)

            collected_data["employees"] = employee_data

            if tracker:
                tracker.log_info(f"Collected {len(employee_data)} filtered employees (from {len(employees)} total)")

            # 2. Get shift templates - optimized with only essential fields
            shifts = ShiftTemplate.query.all()
            shift_data = []
            for shift in shifts:
                # Filter shifts that are active on target weekdays
                if shift.active_days and any(str(day) in shift.active_days and shift.active_days[str(day)] for day in target_weekdays):
                    shift_dict = {
                        "id": shift.id,
                        "start_time": shift.start_time,
                        "end_time": shift.end_time,
                        "active_days": [day for day in range(7) if str(day) in shift.active_days and shift.active_days[str(day)]],
                        "requires_keyholder": getattr(shift, 'requires_keyholder', False),
                    }
                    shift_data.append(shift_dict)

            collected_data["shifts"] = shift_data

            if tracker:
                tracker.log_info(f"Collected {len(shift_data)} relevant shift templates")

            # 3. Get coverage needs - optimized with pattern-based structure
            coverage_needs = Coverage.query.all()
            coverage_rules = []
            
            for coverage in coverage_needs:
                # Only include coverage rules for relevant weekdays
                if coverage.day_index in target_weekdays:
                    coverage_rule = {
                        "day_index": coverage.day_index,  # 0=Monday, 6=Sunday
                        "time_period": f"{coverage.start_time}-{coverage.end_time}",
                        "min_employees": coverage.min_employees,
                        "max_employees": coverage.max_employees,
                        "requires_keyholder": coverage.requires_keyholder,
                    }
                    coverage_rules.append(coverage_rule)

            collected_data["coverage_rules"] = coverage_rules
            
            # Also provide the date range for context
            collected_data["schedule_period"] = {
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "target_weekdays": sorted(list(target_weekdays))
            }

            if tracker:
                tracker.log_info(f"Collected {len(coverage_rules)} coverage rules for weekdays {sorted(target_weekdays)}")

            # 4. Get employee availability - optimized with time windows instead of hour-by-hour
            employee_ids = [emp["id"] for emp in employee_data]
            if employee_ids:
                availabilities = EmployeeAvailability.query.filter(
                    EmployeeAvailability.employee_id.in_(employee_ids),
                    db.or_(
                        EmployeeAvailability.is_recurring.is_(True),
                        db.and_(
                            db.or_(EmployeeAvailability.start_date.is_(None), EmployeeAvailability.start_date <= end_date),
                            db.or_(EmployeeAvailability.end_date.is_(None), EmployeeAvailability.end_date >= start_date)
                        )
                    )
                ).all()

                # Convert to time windows per employee per day
                availability_windows = {}
                for avail in availabilities:
                    current_date = start_date
                    while current_date <= end_date:
                        if avail.is_available_for_date(current_date):
                            key = f"{avail.employee_id}_{current_date.weekday()}"
                            if key not in availability_windows:
                                availability_windows[key] = {
                                    "employee_id": avail.employee_id,
                                    "day_index": current_date.weekday(),
                                    "available_hours": [],
                                    "preferred_hours": [],
                                    "fixed_hours": []
                                }
                            
                            # Categorize by availability type
                            hour_info = avail.hour
                            if avail.availability_type.value == "FIXED":
                                availability_windows[key]["fixed_hours"].append(hour_info)
                            elif avail.availability_type.value == "PREFERRED":
                                availability_windows[key]["preferred_hours"].append(hour_info)
                            else:  # AVAILABLE
                                availability_windows[key]["available_hours"].append(hour_info)
                        current_date += timedelta(days=1)

                # Convert to time ranges and create simplified availability data
                availability_data = []
                for window_data in availability_windows.values():
                    # Convert hour lists to time ranges
                    simplified_window = {
                        "employee_id": window_data["employee_id"],
                        "day_index": window_data["day_index"],
                    }
                    
                    # Create time ranges for each availability type
                    for avail_type in ["fixed_hours", "preferred_hours", "available_hours"]:
                        hours = sorted(window_data[avail_type])
                        if hours:
                            # Convert hours to time ranges (simplified)
                            time_range = f"{min(hours):02d}:00-{max(hours)+1:02d}:00"
                            simplified_window[avail_type.replace("_hours", "_time_range")] = time_range
                    
                    availability_data.append(simplified_window)

                collected_data["availability"] = availability_data

                if tracker:
                    tracker.log_info(f"Collected {len(availability_data)} availability windows")

            # 5. Get absences - already optimized, only overlapping dates
            absences = Absence.query.filter(
                Absence.employee_id.in_(employee_ids) if employee_ids else False,
                Absence.start_date <= end_date, 
                Absence.end_date >= start_date
            ).all()

            absence_data = []
            for absence in absences:
                absence_dict = {
                    "employee_id": absence.employee_id,
                    "start_date": absence.start_date.strftime("%Y-%m-%d"),
                    "end_date": absence.end_date.strftime("%Y-%m-%d"),
                    "reason": absence.note or "Absence",
                }
                absence_data.append(absence_dict)

            collected_data["absences"] = absence_data

            if tracker:
                tracker.log_info(f"Collected {len(absence_data)} absence records")

            # Convert the collected data to a structured text format for the prompt
            collected_data_text = json.dumps(collected_data, indent=2)

            if tracker:
                tracker.end_step({
                    "employees": len(employee_data),
                    "shifts": len(shift_data), 
                    "coverage_rules": len(coverage_rules),
                    "availability_windows": len(availability_data) if 'availability_data' in locals() else 0,
                    "absences": len(absence_data)
                })

            return collected_data_text

        except Exception as e:
            error_message = f"Error collecting data for AI prompt: {str(e)}"
            if tracker:
                tracker.log_error(error_message)
            else:
                logger.app_logger.error(error_message, exc_info=True)
            raise RuntimeError(error_message) from e

    def _generate_system_prompt(
        self, start_date, end_date, collected_data_text, tracker=None
    ):
        """Generate the system prompt for the AI model with diagnostic tracking"""
        if tracker:
            tracker.start_step("Generate System Prompt")

        prompt = f"""
        You are an advanced AI scheduling assistant. Your task is to generate an optimal employee shift schedule based on the provided data and rules.

        Schedule Period: {start_date.isoformat()} to {end_date.isoformat()}

        CRITICAL UNDERSTANDING - COVERAGE vs SHIFT TEMPLATES:
        1. COVERAGE RULES define staffing requirements by day and time (e.g., "Monday 14:00-18:00 needs 1-3 employees")
        2. SHIFT TEMPLATES are the available work shifts employees can be assigned to
        3. Use shift templates to FULFILL coverage requirements for the dates in the schedule period
        4. Apply coverage rules to the corresponding weekdays in the schedule period
        5. Multiple shift templates may be needed to cover one coverage requirement

        DATA STRUCTURE:
        - employees: Available staff with basic info and constraints
        - shifts: Available shift templates (filtered for relevant days only)
        - coverage_rules: Staffing requirements by weekday pattern (apply to matching dates in period)
        - schedule_period: Date range and target weekdays to schedule
        - availability: Employee availability windows by day (simplified time ranges)
        - absences: Employee unavailability periods (exact dates)

        SCHEDULING LOGIC:
        1. For each date in the schedule period, apply coverage rules that match the weekday
        2. Select appropriate shift templates that overlap with coverage time periods
        3. Assign employees based on their availability windows and absence constraints
        4. Ensure minimum staffing levels are met for each coverage requirement
        5. Distribute workload fairly across employees and shift types

        OUTPUT FORMAT:
        Provide the schedule STRICTLY in CSV format with these columns in exact order:
        EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime

        Example CSV Row:
        101,2024-07-15,3,Morning Shift,08:00,16:00

        SCHEDULING INSTRUCTIONS:
        1. COVERAGE FULFILLMENT: 
           - Apply coverage rules to matching weekdays in the schedule period
           - Ensure sufficient employees work during each required time period
           - Use overlapping shift templates to fulfill coverage needs
        2. EMPLOYEE CONSTRAINTS: 
           - Respect availability time ranges (fixed > preferred > available)
           - Avoid scheduling during absence periods
           - Stay within max_weekly_hours limits
        3. FAIR DISTRIBUTION: 
           - Rotate different shift types across employees
           - Balance workload and weekend/evening assignments
        4. KEYHOLDER REQUIREMENTS: Assign keyholders when coverage requires_keyholder=true
        5. DATA VALIDATION: 
           - ShiftTemplateID must exist in provided shift templates
           - Date format: YYYY-MM-DD within schedule period
           - Time format: HH:MM matching the selected shift template
        6. OUTPUT ONLY: Return ONLY the CSV data, no explanations or additional text

        Provided Data:
        {collected_data_text}

        Generate the schedule assignments in CSV format now:"""

        if tracker:
            tracker.log_debug("System prompt generated")
            tracker.log_step_data("Prompt Length", len(prompt))
            tracker.end_step({"prompt_length": len(prompt)})
        elif logger.app_logger.isEnabledFor(logging.DEBUG):
            logger.app_logger.debug(f"Generated system prompt: {prompt}")
        else:
            logger.app_logger.info(
                f"Generated system prompt (first 500 chars): {prompt[:500]}..."
            )

        return prompt

    def _call_gemini_api(self, prompt, model_params=None, tracker=None):
        """Call the Gemini API with diagnostics"""
        if tracker:
            tracker.start_step("Call Gemini API")
            tracker.log_info("Calling Gemini API for schedule generation")

        if not self.gemini_api_key:
            error_message = "Gemini API key not configured"
            if tracker:
                tracker.log_error(error_message)
            else:
                logger.app_logger.error(error_message)
            raise RuntimeError(error_message)

        params = self.default_model_params.copy()
        if model_params:
            # Update with any custom params provided
            params.update(model_params)

        if tracker:
            # Log the model parameters (removing safety settings for brevity)
            safe_params = params.copy()
            if "safetySettings" in safe_params:
                safe_params["safetySettings"] = (
                    f"[{len(safe_params['safetySettings'])} settings]"
                )
            tracker.log_step_data("Model Parameters", safe_params)

        # Construct the API request payload
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model_name}:generateContent?key={self.gemini_api_key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            **params,
        }

        try:
            if tracker:
                tracker.log_debug("Sending request to Gemini API")
                start_time = datetime.now()

            response = requests.post(api_url, json=payload)

            if tracker:
                duration = (datetime.now() - start_time).total_seconds()
                tracker.log_info(
                    f"Gemini API response received in {duration:.2f} seconds"
                )
                tracker.log_step_data(
                    "Response Status", f"{response.status_code} ({response.reason})"
                )

            # Check if the request was successful
            if response.status_code != 200:
                error_message = f"Gemini API request failed with status code {response.status_code}: {response.text}"
                if tracker:
                    tracker.log_error(error_message)
                else:
                    logger.app_logger.error(error_message)
                raise RuntimeError(error_message)

            # Parse the response JSON
            response_data = response.json()

            # Extract the generated text from the response
            if "candidates" not in response_data or not response_data["candidates"]:
                error_message = "No candidates returned in Gemini API response"
                if tracker:
                    tracker.log_error(error_message)
                    tracker.log_step_data("Response Data", response_data)
                else:
                    logger.app_logger.error(error_message)
                raise RuntimeError(error_message)

            candidate = response_data["candidates"][0]

            if "content" not in candidate or "parts" not in candidate["content"]:
                error_message = "Unexpected response format from Gemini API"
                if tracker:
                    tracker.log_error(error_message)
                    tracker.log_step_data("Response Data", response_data)
                else:
                    logger.app_logger.error(error_message)
                raise RuntimeError(error_message)

            # Extract the text from the candidate's content
            generated_text = ""
            for part in candidate["content"]["parts"]:
                if "text" in part:
                    generated_text += part["text"]

            if not generated_text.strip():
                error_message = "Empty text response from Gemini API"
                if tracker:
                    tracker.log_error(error_message)
                else:
                    logger.app_logger.error(error_message)
                raise RuntimeError(error_message)

            if tracker:
                tracker.log_info(
                    f"Successfully retrieved response ({len(generated_text)} characters)"
                )
                tracker.log_step_data("Response Length", len(generated_text))
                tracker.log_debug(f"Response preview: {generated_text[:200]}...")
                tracker.end_step({"response_length": len(generated_text)})

            return generated_text

        except requests.RequestException as e:
            error_message = f"Network error during Gemini API call: {str(e)}"
            if tracker:
                tracker.log_error(error_message)
            else:
                logger.app_logger.error(error_message, exc_info=True)
            raise RuntimeError(error_message) from e
        except Exception as e:
            error_message = f"Unexpected error during Gemini API call: {str(e)}"
            if tracker:
                tracker.log_error(error_message)
            else:
                logger.app_logger.error(error_message, exc_info=True)
            raise RuntimeError(error_message) from e

    def _parse_csv_response(
        self, csv_text, expected_start_date, expected_end_date, tracker=None
    ):
        """Parse CSV response from Gemini API with diagnostic tracking"""
        if tracker:
            tracker.start_step("Parse CSV Response")
            tracker.log_info(f"Parsing CSV response (length: {len(csv_text)})")

        # Find the CSV content - strip out any non-CSV text
        # Look for CSV header line
        csv_header = "EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime"
        if csv_header in csv_text:
            csv_start = csv_text.find(csv_header)
            if csv_start >= 0:
                csv_text = csv_text[csv_start:]
                if tracker:
                    tracker.log_debug(f"Found CSV header at position {csv_start}")

        # Trim any text after the CSV data (look for a line that doesn't contain commas)
        lines = csv_text.split("\n")
        end_line_index = len(lines)
        for i, line in enumerate(lines):
            if (
                i > 0 and "," not in line and len(line.strip()) > 10
            ):  # This might be text after the CSV
                end_line_index = i
                if tracker:
                    tracker.log_debug(f"Found end of CSV data at line {i}")
                break

        if end_line_index < len(lines):
            csv_text = "\n".join(lines[:end_line_index])

        # Parse the CSV data
        try:
            csv_reader = csv.reader(StringIO(csv_text))
            header = next(csv_reader, None)
            
            # Handle empty CSV
            if header is None:
                if tracker:
                    tracker.log_warning("CSV response is empty or contains no header.")
                else:
                    logger.app_logger.warning("CSV response is empty or contains no header.")
                return []

            # Verify the header matches expected format
            expected_header = [
                "EmployeeID",
                "Date",
                "ShiftTemplateID",
                "ShiftName",
                "StartTime",
                "EndTime",
            ]
            if header != expected_header:
                if tracker:
                    tracker.log_warning(
                        f"CSV header doesn't match expected format: {header}"
                    )
                    # Try to find the missing columns or rearrange
                    header_map = {
                        h.lower().replace(" ", ""): i for i, h in enumerate(header)
                    }
                    tracker.log_step_data("Header Map", header_map)
                else:
                    logger.app_logger.warning(
                        f"CSV header doesn't match expected format: {header}"
                    )

                # We'll continue and try to map columns by name or position

            parsed_data = []
            date_format = "%Y-%m-%d"
            row_count = 1  # Start at 1 since row 1 is the header
            error_count = 0

            for row in csv_reader:
                row_count += 1
                try:
                    # Skip empty rows
                    if not row or not any(row):
                        continue

                    # If header doesn't match expected, try to map columns intelligently
                    if header != expected_header:
                        mapped_row = [""] * len(expected_header)
                        for exp_idx, exp_col in enumerate(expected_header):
                            exp_col_lower = exp_col.lower().replace(" ", "")
                            # Try to find this column in the header
                            if exp_col_lower in header_map:
                                actual_idx = header_map[exp_col_lower]
                                if actual_idx < len(row):
                                    mapped_row[exp_idx] = row[actual_idx]
                        row = mapped_row

                    # Ensure row has enough columns
                    if len(row) < 6:
                        if tracker:
                            tracker.log_warning(
                                f"Row {row_count} has insufficient columns: {row}"
                            )
                        else:
                            logger.app_logger.warning(
                                f"Row {row_count} has insufficient columns: {row}"
                            )
                        error_count += 1
                        continue

                    # Extract and validate data
                    employee_id = int(row[0].strip())
                    date_str = row[1].strip()
                    shift_template_id = int(row[2].strip())
                    shift_name = row[3].strip()
                    start_time = row[4].strip()
                    end_time = row[5].strip()

                    # Validate IDs
                    if employee_id <= 0:
                        if tracker:
                            tracker.log_warning(
                                f"Row {row_count}: Invalid EmployeeID {employee_id}. Must be > 0. Row: {row}"
                            )
                        else:
                            logger.app_logger.warning(
                                f"Row {row_count}: Invalid EmployeeID {employee_id}. Must be > 0. Row: {row}"
                            )
                        error_count += 1
                        continue

                    if shift_template_id <= 0:
                        if tracker:
                            tracker.log_warning(
                                f"Row {row_count}: Invalid ShiftTemplateID {shift_template_id}. Must be > 0. Row: {row}"
                            )
                        else:
                            logger.app_logger.warning(
                                f"Row {row_count}: Invalid ShiftTemplateID {shift_template_id}. Must be > 0. Row: {row}"
                            )
                        error_count += 1
                        continue

                    # Validate date format
                    try:
                        schedule_date = datetime.strptime(date_str, date_format).date()
                        # Check if date is within expected range
                        if (
                            schedule_date < expected_start_date
                            or schedule_date > expected_end_date
                        ):
                            if tracker:
                                tracker.log_warning(
                                    f"Row {row_count}: Assignment date {date_str} out of range. Row: {row}"
                                )
                            else:
                                logger.app_logger.warning(
                                    f"Row {row_count}: Assignment date {date_str} out of range. Row: {row}"
                                )
                            error_count += 1
                            continue
                    except ValueError:
                        if tracker:
                            tracker.log_warning(
                                f"Row {row_count}: Invalid date format: {date_str}"
                            )
                        else:
                            logger.app_logger.warning(
                                f"Row {row_count}: Invalid date format: {date_str}"
                            )
                        error_count += 1
                        continue

                    # Validate shift name (generate if empty since we simplified the data)
                    if not shift_name or shift_name.strip() == "":
                        # Generate a name from the shift template data
                        shift_name = self._generate_shift_name(shift_template_id, start_time, end_time)
                        if tracker:
                            tracker.log_info(
                                f"Row {row_count}: Generated shift name '{shift_name}' for empty ShiftName"
                            )
                        else:
                            logger.app_logger.info(
                                "Row %d: Generated shift name '%s' for empty ShiftName", row_count, shift_name
                            )

                    # Create a structured record for each assignment
                    assignment = {
                        "employee_id": employee_id,
                        "date": schedule_date,
                        "shift_template_id": shift_template_id,
                        "shift_name_from_ai": shift_name,
                        "start_time": start_time,
                        "end_time": end_time,
                    }

                    parsed_data.append(assignment)

                except Exception as e:
                    error_count += 1
                    if tracker:
                        tracker.log_warning(f"Error parsing row {row_count}: {str(e)}")
                        tracker.log_step_data(f"Problem Row {row_count}", row)
                    else:
                        logger.app_logger.warning(
                            f"Error parsing row {row_count}: {str(e)}"
                        )

            if tracker:
                tracker.log_info(
                    f"Parsed {len(parsed_data)} valid assignments from {row_count} rows with {error_count} errors"
                )
                tracker.log_step_data(
                    "Parsing Stats",
                    {
                        "total_rows": row_count,
                        "valid_assignments": len(parsed_data),
                        "error_count": error_count,
                    },
                )
                tracker.end_step(
                    {"assignment_count": len(parsed_data), "error_count": error_count}
                )
            else:
                logger.app_logger.info(
                    f"Parsed {len(parsed_data)} valid assignments from {row_count} rows with {error_count} errors"
                )
                if error_count > 0:
                    logger.app_logger.warning(
                        f"Finished parsing CSV. Total malformed/skipped rows: {error_count}"
                    )

            return parsed_data

        except Exception as e:
            error_message = f"Error parsing CSV response: {str(e)}"
            if tracker:
                tracker.log_error(error_message)
                tracker.log_step_data("CSV Content", csv_text[:1000])
            else:
                logger.app_logger.error(error_message, exc_info=True)
            raise RuntimeError(error_message) from e

    def _store_assignments(
        self,
        parsed_assignments,
        version_id,
        schedule_start_date,
        schedule_end_date,
        tracker=None,
    ):
        """Store the generated assignments in the database with diagnostic tracking"""
        if tracker:
            tracker.start_step("Store Assignments")
            tracker.log_info(
                f"Storing {len(parsed_assignments)} assignments for version {version_id}"
            )

        try:
            # Clear existing assignments for this version within the date range if version_id is provided
            if version_id is not None:
                # Using a filter approach that avoids the ambiguous class access issues
                # We'll use string column names for filtering to avoid the linter errors
                query = db.session.query(Schedule)

                # Build criteria with column names as strings
                if version_id is not None:
                    query = query.filter(getattr(Schedule, "version") == version_id)
                if schedule_start_date is not None:
                    query = query.filter(
                        getattr(Schedule, "date") >= schedule_start_date
                    )
                if schedule_end_date is not None:
                    query = query.filter(getattr(Schedule, "date") <= schedule_end_date)

                # Execute the delete
                delete_count = query.delete(synchronize_session="fetch")

                if tracker:
                    tracker.log_info(
                        f"Cleared {delete_count} existing assignments for version {version_id}"
                    )
                else:
                    logger.app_logger.info(
                        f"Cleared {delete_count} existing assignments for version {version_id} within the date range."
                    )
            else:
                if tracker:
                    tracker.log_info(
                        "No version_id provided. Not clearing existing assignments."
                    )
                else:
                    logger.app_logger.info(
                        "version_id is None. Not clearing existing assignments."
                    )

            new_assignments = []
            for assignment_data in parsed_assignments:
                # Map parsed data to Schedule model attributes
                # Ensure column names match your Schedule model exactly
                new_assignment = Schedule(
                    employee_id=assignment_data["employee_id"],
                    date=assignment_data["date"],
                    shift_id=assignment_data[
                        "shift_template_id"
                    ],  # Use shift_id based on likely schema
                    # Assuming Schedule model has these columns or they are derivable/not needed directly from AI output
                    # shift_name=assignment_data["shift_name_from_ai"], # If Schedule has shift_name
                    # start_time=assignment_data["start_time"], # If Schedule has start_time
                    # end_time=assignment_data["end_time"], # If Schedule has end_time
                    version=version_id,  # Use version based on likely schema
                    # Add other Schedule model attributes as needed, e.g., created_at, updated_at
                )
                new_assignments.append(new_assignment)

            # Add all new assignments and commit
            db.session.bulk_save_objects(new_assignments)
            db.session.commit()

            if tracker:
                tracker.log_info(
                    f"Successfully stored {len(new_assignments)} new assignments"
                )
                tracker.end_step({"assignments_stored": len(new_assignments)})
            else:
                logger.app_logger.info(
                    f"Successfully stored {len(new_assignments)} new assignments"
                )

            return {"status": "success", "count": len(new_assignments)}

        except SQLAlchemyError as e:
            db.session.rollback()
            error_message = f"Database error storing assignments: {str(e)}"
            if tracker:
                tracker.log_error(error_message)
            else:
                logger.app_logger.error(error_message, exc_info=True)
            raise RuntimeError(error_message) from e
        except Exception as e:
            db.session.rollback()
            error_message = f"Unexpected error storing assignments: {str(e)}"
            if tracker:
                tracker.log_error(error_message)
            else:
                logger.app_logger.error(error_message, exc_info=True)
            raise RuntimeError(error_message) from e

    def generate_schedule_via_ai(
        self, start_date_str, end_date_str, version_id=None, ai_model_params=None
    ):
        """
        Generate a schedule using AI (Gemini) with detailed diagnostics

        Args:
            start_date_str: Start date in 'YYYY-MM-DD' format
            end_date_str: End date in 'YYYY-MM-DD' format
            version_id: Optional version ID for the schedule
            ai_model_params: Optional parameters for the AI model

        Returns:
            dict: Result of the generation process
        """
        # Initialize process tracker for diagnostics
        tracker = self._initialize_process_tracker("AI Schedule Generation")
        tracker.log_info(
            f"Initiating AI schedule generation for dates {start_date_str} to {end_date_str}, version_id: {version_id}"
        )

        generation_metrics = {
            "start_date": start_date_str,
            "end_date": end_date_str,
            "version_id": version_id,
        }

        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()

            generation_metrics["parsed_start_date"] = start_date
            generation_metrics["parsed_end_date"] = end_date

        except ValueError as e:
            tracker.log_error(f"Invalid date format provided: {e}")
            tracker.end_process({"status": "failed", "reason": "invalid_date_format"})
            raise ValueError("Invalid date format. Use YYYY-MM-DD.") from e

        if start_date > end_date:
            tracker.log_warning(
                f"Start date ({start_date_str}) is after end date ({end_date_str}). Swapping dates."
            )
            start_date, end_date = end_date, start_date
            generation_metrics["dates_swapped"] = True

        # 1. Collect relevant data
        try:
            collected_data_text = self._collect_data_for_ai_prompt(
                start_date, end_date, tracker
            )
            if not collected_data_text:
                tracker.log_warning("Collected data for AI prompt is empty.")
                # Depending on requirements, might return an error or an empty schedule
                tracker.end_process(
                    {"status": "warning", "reason": "no_data_collected"}
                )
                return {
                    "status": "warning",
                    "message": "No relevant data collected for the specified date range. Cannot generate schedule.",
                    "generated_assignments_count": 0,
                }
        except Exception as e:
            tracker.log_error(f"Failed to collect data for AI prompt: {e}")
            tracker.end_process(
                {"status": "failed", "reason": "data_collection_failed"}
            )
            raise RuntimeError(f"Failed to collect data for AI prompt: {e}") from e

        # 2. Generate the system prompt
        try:
            system_prompt = self._generate_system_prompt(
                start_date, end_date, collected_data_text, tracker
            )
            generation_metrics["prompt_length"] = len(system_prompt)
        except Exception as e:
            tracker.log_error(f"Failed to generate system prompt: {e}")
            tracker.end_process(
                {"status": "failed", "reason": "prompt_generation_failed"}
            )
            raise RuntimeError(f"Failed to generate system prompt: {e}") from e

        # 3. Call the Gemini API
        try:
            ai_response = self._call_gemini_api(system_prompt, ai_model_params, tracker)
            generation_metrics["response_length"] = len(ai_response)
        except Exception as e:
            tracker.log_error(f"Failed to get response from Gemini API: {e}")
            tracker.end_process({"status": "failed", "reason": "ai_call_failed"})
            raise RuntimeError(f"Failed to get response from Gemini API: {e}") from e

        # 4. Parse the response
        try:
            parsed_assignments = self._parse_csv_response(
                ai_response, start_date, end_date, tracker
            )
            generation_metrics["assignments_generated"] = len(parsed_assignments)
        except Exception as e:
            tracker.log_error(f"Failed to parse AI response: {e}")
            tracker.end_process(
                {"status": "failed", "reason": "response_parsing_failed"}
            )
            raise RuntimeError(f"Failed to parse AI response: {e}") from e

        # 5. Store the assignments
        try:
            store_result = self._store_assignments(
                parsed_assignments, version_id, start_date, end_date, tracker
            )
            generation_metrics["assignments_stored"] = store_result.get("count", 0)

            # Complete the process tracking
            tracker.end_process(generation_metrics)

            # Use the directly stored diagnostic log path
            diagnostic_log_path = self.diagnostic_log_path

            # Log the diagnostic log path for reference
            logger.app_logger.info(
                f"AI Schedule Generation completed. Diagnostic log: {diagnostic_log_path}"
            )

            # Return success response - let the frontend fetch the schedules separately
            # This avoids circular import issues and keeps the AI service focused
            return {
                "status": "success",
                "message": f"Schedule generated and stored successfully. {store_result.get('count', 0)} assignments created.",
                "generated_assignments_count": store_result.get("count", 0),
                "session_id": self.session_id,
                "diagnostic_log": diagnostic_log_path,
                "version": version_id,
                "start_date": start_date_str,
                "end_date": end_date_str,
            }
        except RuntimeError as e:
            tracker.log_error(f"Failed to store assignments: {e}")
            tracker.end_process({"status": "error", "reason": "storage_failed"})
            return {
                "status": "error",
                "message": f"Failed to store generated schedule: {e}",
                "generated_assignments_count": 0,
            }
        except Exception as e:
            tracker.log_error(f"Unexpected error storing assignments: {e}")
            tracker.end_process({"status": "error", "reason": "unknown_error"})
            return {
                "status": "error",
                "message": f"An unexpected error occurred during storage: {e}",
                "generated_assignments_count": 0,
            }

    def process_feedback(self, feedback_data: AIScheduleFeedbackRequest):
        """
        Processes user feedback on AI-generated schedules.

        Args:
            feedback_data: An instance of AIScheduleFeedbackRequest containing feedback data.

        Returns:
            A dictionary indicating the result of the feedback processing.
        """
        logger.app_logger.info(
            f"Processing feedback for version ID: {feedback_data.version_id}"
        )
        logger.app_logger.debug(
            f"Feedback data received: {feedback_data.manual_assignments}"
        )

        # TODO: Implement logic to process feedback data.
        # This might involve:
        # - Comparing manual assignments to the original AI assignments for the given version.
        # - Identifying which assignments were added, removed, or modified.
        # - Storing this feedback data for future AI model training or fine-tuning.
        # - Potentially triggering a re-evaluation or partial regeneration based on feedback.

        # Placeholder for feedback processing logic
        processed_count = len(feedback_data.manual_assignments)
        message = f"Received {processed_count} manual assignment updates for version {feedback_data.version_id}. Processing logic TBD."
        logger.app_logger.info(message)

        return {
            "status": "received",
            "message": message,
            "processed_count": processed_count,
        }

    # New method to import schedule from CSV
    def import_schedule_from_csv(self, csv_content, version_id, start_date, end_date):
        """
        Imports schedule assignments from CSV content and stores them in the database.

        Args:
            csv_content (str): The CSV data as a string.
            version_id (int): The version ID to associate assignments with.
            start_date (date): The start date of the schedule period.
            end_date (date): The end date of the schedule period.

        Returns:
            dict: Result of the import process.
        """
        tracker = self._initialize_process_tracker(
            "AI Schedule Import"
        )  # Use a new tracker for import
        tracker.log_info(
            f"Initiating AI schedule import for version {version_id} from {start_date} to {end_date}"
        )

        import_metrics = {
            "version_id": version_id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "csv_length": len(csv_content),
        }

        try:
            # 1. Parse the CSV content
            # Reuse the existing parsing logic, ensuring it validates dates against the provided range
            parsed_assignments = self._parse_csv_response(
                csv_content, start_date, end_date, tracker
            )  # Pass start_date, end_date for validation
            import_metrics["assignments_parsed"] = len(parsed_assignments)

            if not parsed_assignments:
                tracker.log_warning(
                    "Parsed assignments list is empty or parsing failed."
                )
                tracker.end_process(
                    {"status": "warning", "reason": "no_valid_assignments_parsed"}
                )
                return {
                    "status": "warning",
                    "message": "No valid schedule assignments were parsed from the CSV.",
                    "imported_count": 0,
                }

            # 2. Store the assignments
            # Reuse the existing storage logic
            store_result = self._store_assignments(
                parsed_assignments, version_id, start_date, end_date, tracker
            )  # Pass date range to clear old data correctly
            import_metrics["assignments_stored"] = store_result.get("count", 0)

            # Complete the process tracking
            tracker.end_process(import_metrics)

            # Use the directly stored diagnostic log path (from the tracker instance)
            diagnostic_log_path = self.diagnostic_log_path  # Access from self

            # Log the diagnostic log path for reference
            logger.app_logger.info(
                f"AI Schedule Import completed. Diagnostic log: {diagnostic_log_path}"
            )

            return {
                "status": "success",
                "message": f"Schedule imported and stored successfully. {store_result.get('count', 0)} assignments created/updated.",
                "imported_count": store_result.get("count", 0),
                "session_id": self.session_id,  # Access from self
                "diagnostic_log": diagnostic_log_path,
            }

        except ValueError as e:
            db.session.rollback()
            error_message = f"Data validation error during import: {str(e)}"
            tracker.log_error(error_message)
            tracker.end_process(
                {"status": "failed", "reason": "data_validation_failed"}
            )
            raise ValueError(error_message) from e
        except RuntimeError as e:
            db.session.rollback()
            error_message = f"Runtime error during import: {str(e)}"
            tracker.log_error(error_message)
            tracker.end_process({"status": "failed", "reason": "runtime_error"})
            raise RuntimeError(error_message) from e
        except Exception as e:
            db.session.rollback()
            error_message = f"Unexpected error during AI schedule import: {str(e)}"
            tracker.log_error(error_message)
            tracker.end_process({"status": "failed", "reason": "unknown_error"})
            raise RuntimeError(error_message) from e

    def _analyze_coverage_fulfillment_potential(self, shift_data, coverage_data, tracker=None):
        """Analyze how well shift templates can fulfill coverage requirements"""
        if not shift_data or not coverage_data:
            return
        
        def time_to_minutes(time_str):
            """Convert HH:MM to minutes since midnight"""
            hours, minutes = map(int, time_str.split(':'))
            return hours * 60 + minutes
        
        def times_overlap(start1, end1, start2, end2):
            """Check if two time periods overlap"""
            start1_min = time_to_minutes(start1)
            end1_min = time_to_minutes(end1)
            start2_min = time_to_minutes(start2)
            end2_min = time_to_minutes(end2)
            
            # Handle overnight shifts
            if end1_min < start1_min:
                end1_min += 24 * 60
            if end2_min < start2_min:
                end2_min += 24 * 60
            
            return not (end1_min <= start2_min or end2_min <= start1_min)
        
        if tracker:
            tracker.log_info("Analyzing coverage fulfillment potential:")
            
            # Group coverage by date for analysis
            coverage_by_date = {}
            for coverage in coverage_data:
                date = coverage["date"]
                if date not in coverage_by_date:
                    coverage_by_date[date] = []
                coverage_by_date[date].append(coverage)
            
            for date, date_coverage in coverage_by_date.items():
                tracker.log_info(f"\nDate {date}:")
                
                for coverage in date_coverage:
                    period_parts = coverage["time_period"].split('-')
                    if len(period_parts) != 2:
                        continue
                    
                    cov_start, cov_end = period_parts
                    min_emp = coverage["min_employees"]
                    max_emp = coverage["max_employees"]
                    
                    tracker.log_info(f"  Coverage {cov_start}-{cov_end} needs {min_emp}-{max_emp} employees")
                    
                    # Find overlapping shifts
                    overlapping_shifts = []
                    for shift in shift_data:
                        if times_overlap(cov_start, cov_end, shift["start_time"], shift["end_time"]):
                            overlapping_shifts.append(shift)
                    
                    if overlapping_shifts:
                        tracker.log_info(f"    Can be covered by {len(overlapping_shifts)} shift templates:")
                        for shift in overlapping_shifts:
                            tracker.log_info(f"      - {shift['name']} ({shift['start_time']}-{shift['end_time']})")
                    else:
                        tracker.log_warning(f"    No overlapping shift templates found!")

    def _generate_shift_name(self, shift_template_id, start_time, end_time):
        """Generate a descriptive shift name from shift template data"""
        try:
            # Try to get the actual shift template for a proper name
            shift = ShiftTemplate.query.get(shift_template_id)
            if shift and shift.name:
                return shift.name
            
            # Generate name based on time pattern
            start_hour = int(start_time.split(':')[0])
            if start_hour < 11:
                return f"Early Shift ({start_time}-{end_time})"
            elif start_hour >= 15:
                return f"Late Shift ({start_time}-{end_time})"
            else:
                return f"Middle Shift ({start_time}-{end_time})"
        except (ValueError, AttributeError):
            return f"Shift ({start_time}-{end_time})"


# Helper function for testing (optional, can be removed or moved)
def test_ai_scheduler_service():
    # This is a placeholder and requires a running Flask app with DB access
    # and a configured GEMINI_API_KEY to run successfully.
    print("\n--- Testing AISchedulerService ---")
    service = AISchedulerService()

    # Example dates (replace with actual dates in your DB)
    start_date_str = "2024-07-01"
    end_date_str = "2024-07-07"
    test_version_id = 99  # Use a test-specific version ID

    try:
        print(
            f"Attempting to generate schedule for {start_date_str} to {end_date_str}..."
        )
        result = service.generate_schedule_via_ai(
            start_date_str=start_date_str,
            end_date_str=end_date_str,
            version_id=test_version_id,
            ai_model_params={"generationConfig": {"temperature": 0.5}},
        )
        print(f"Generation Result: {result}")

        # Add a placeholder for testing feedback processing
        print("\n--- Testing Feedback Processing (Placeholder) ---")
        mock_feedback_data = AIScheduleFeedbackRequest(
            version_id=test_version_id,
            manual_assignments=[
                {"employee_id": 1, "date": "2024-07-01", "shift_id": 2},
                {
                    "employee_id": 3,
                    "date": "2024-07-03",
                    "shift_id": 1,
                    "action": "remove",
                },
            ],
        )
        feedback_result = service.process_feedback(mock_feedback_data)
        print(f"Feedback Processing Result: {feedback_result}")

    except ValueError as e:
        print(f"Test failed due to Value Error: {e}")
    except ConnectionError as e:
        print(f"Test failed due to Connection Error: {e}")
    except RuntimeError as e:
        print(f"Test failed due to Runtime Error: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during test: {e}")


# To run this test:
# 1. Ensure your Flask app and database are running.
# 2. Set the GEMINI_API_KEY environment variable.
# 3. You might need to add necessary imports for the test function itself.
# 4. Run this file directly: python -m src.backend.services.ai_scheduler_service
# (Note: Running directly might have issues with Flask app context/DB.
# It's better to call this from a proper Flask shell or test suite.)

if __name__ == "__main__":
    # This block is mainly for testing the service in isolation if possible,
    # but note the caveats above about Flask context.
    # test_ai_scheduler_service()
    pass  # Avoid running test automatically for now
