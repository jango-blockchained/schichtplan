# src/backend/services/ai_scheduler_service.py

from src.backend.models import db, Employee, ShiftTemplate, Coverage, Absence, EmployeeAvailability, Schedule # Added Schedule model
from src.backend.utils.logger import logger # Corrected: import the global logger instance
import json
import requests
import os
import logging
import csv
from io import StringIO
from datetime import datetime, date, time
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import Date as SQLDate # Added import
from src.backend.schemas.ai_schedule import AIScheduleFeedbackRequest # Import the feedback schema
from typing import List, Dict, Any # Ensure List, Dict, Any are imported

class AISchedulerService:
    def __init__(self):
        self.gemini_api_key = self._load_api_key_from_settings()
        self.gemini_model_name = "gemini-1.5-pro-latest"
        self.default_model_params = {
            "generationConfig": {
                "temperature": 0.6,
                "topP": 0.95,
                "topK": 40,
                "maxOutputTokens": 8192,
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            ]
        }
        logger.app_logger.info(f"AISchedulerService initialized for model: {self.gemini_model_name}") # Use logger.app_logger

    def _load_api_key_from_settings(self):
        logger.app_logger.info("Loading Gemini API Key.") # Use logger.app_logger
        loaded_key = os.getenv("GEMINI_API_KEY")
        if not loaded_key:
            logger.app_logger.error("GEMINI_API_KEY environment variable not set. AI scheduling will fail if attempted.") # Use logger.app_logger
            return None
        logger.app_logger.info("GEMINI_API_KEY loaded successfully.") # Use logger.app_logger
        return loaded_key

    def _collect_data_for_ai_prompt(self, start_date, end_date):
        logger.app_logger.info(f"Collecting data for AI prompt from {start_date} to {end_date}.") # Use logger.app_logger
        data_parts = []
        try:
            employees = Employee.query.filter_by(is_active=True).all()
            employee_data = [{ "id": emp.id, "name": emp.name, "role": emp.role, "is_keyholder": emp.is_keyholder } for emp in employees]
            data_parts.append(f"Employees:\n{json.dumps(employee_data, indent=2)}")
        except Exception as e:
            logger.app_logger.error(f"Error collecting employee data: {str(e)}", exc_info=True) # Use logger.app_logger
            data_parts.append("Employees: Error collecting data.")
        try:
            shift_templates = ShiftTemplate.query.all()
            template_data = [{ "id": st.id, "name": st.name, "start_time": st.start_time.isoformat() if st.start_time else None, "end_time": st.end_time.isoformat() if st.end_time else None, "active_days": st.active_days } for st in shift_templates]
            data_parts.append(f"Shift Templates:\n{json.dumps(template_data, indent=2)}")
        except Exception as e:
            logger.app_logger.error(f"Error collecting shift template data: {str(e)}", exc_info=True) # Use logger.app_logger
            data_parts.append("Shift Templates: Error collecting data.")
        try:
            coverages = Coverage.query.all()
            coverage_data = [{ "id": cov.id, "shift_template_id": cov.shift_template_id, "min_employees": cov.min_employees, "max_employees": cov.max_employees, "days_of_week": cov.days_of_week } for cov in coverages]
            data_parts.append(f"Coverage Needs:\n{json.dumps(coverage_data, indent=2)}")
        except Exception as e:
            logger.app_logger.error(f"Error collecting coverage data: {str(e)}", exc_info=True) # Use logger.app_logger
            data_parts.append("Coverage Needs: Error collecting data.")
        try:
            availabilities = EmployeeAvailability.query.filter(
                EmployeeAvailability.end_date >= start_date,  # Temporarily adjusted
                EmployeeAvailability.start_date <= end_date  # Temporarily adjusted
            ).all()
            availability_data = [{ 
                "employee_id": avail.employee_id, 
                # "date": avail.date.isoformat(),  // This will still be an issue, EmployeeAvailability has no 'date' field
                # "start_time": avail.start_time.isoformat() if avail.start_time else None, // EmployeeAvailability has no 'start_time' field
                # "end_time": avail.end_time.isoformat() if avail.end_time else None, // EmployeeAvailability has no 'end_time' field
                "availability_type": avail.availability_type.value, # This should be okay
                # For now, let's simplify what we send to AI for availability due to model mismatch
                "raw_availability_record": f"From {avail.start_date.isoformat() if avail.start_date else 'Open Start'} to {avail.end_date.isoformat() if avail.end_date else 'Open End'}, Type: {avail.availability_type.value}, Day: {avail.day_of_week}, Hour: {avail.hour}, IsAvailable: {avail.is_available}"
            } for avail in availabilities]
            data_parts.append(f"Employee Availability ({start_date} to {end_date}):\n{json.dumps(availability_data, indent=2)}")
            absences = Absence.query.filter(Absence.start_date <= end_date, Absence.end_date >= start_date).all()
            absence_data = [{ "employee_id": ab.employee_id, "start_date": ab.start_date.isoformat(), "end_date": ab.end_date.isoformat(), "reason": ab.reason } for ab in absences]
            data_parts.append(f"Employee Absences ({start_date} to {end_date}):\n{json.dumps(absence_data, indent=2)}")
        except Exception as e:
            logger.app_logger.error(f"Error collecting availability/absence data: {str(e)}", exc_info=True) # Use logger.app_logger
            data_parts.append("Employee Availability/Absences: Error collecting data.")
        general_rules = { "max_consecutive_shifts": 5, "min_rest_between_shifts_hours": 11, "max_weekly_hours": 40 }
        data_parts.append(f"General Scheduling Rules:\n{json.dumps(general_rules, indent=2)}")
        prompt_text_data = "\n\n".join(data_parts)
        logger.app_logger.info("Data collection for AI prompt complete.") # Use logger.app_logger
        return prompt_text_data

    def _construct_system_prompt(self, collected_data_text, start_date, end_date):
        logger.app_logger.info("Constructing system prompt for AI.") # Use logger.app_logger
        prompt = f"""
        You are an advanced AI scheduling assistant. Your task is to generate an optimal employee shift schedule based on the provided data and rules.
        Schedule Period: {start_date.isoformat()} to {end_date.isoformat()}
        Output Format:
        Please provide the schedule STRICTLY in CSV format. The CSV should have the following columns, in this exact order:
        EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime
        Example CSV Row:
        101,2024-07-15,3,Morning Shift,08:00,16:00
        Instructions and Data:
        1. Adhere to all specified coverage needs for each shift and day.
        2. Respect all employee availability (fixed, preferred, unavailable) and absences.
        3. Consider general scheduling rules provided.
        4. Aim for a fair distribution of shifts among employees.
        5. Prioritize fulfilling fixed assignments and preferred shifts where possible.
        6. Ensure assigned shifts match employee qualifications (e.e., keyholder).
        7. The ShiftTemplateID in the output CSV must correspond to an existing ShiftTemplateID from the input data.
        8. The Date must be in YYYY-MM-DD format.
        9. StartTime and EndTime in the output CSV should be in HH:MM format and match the times of the assigned ShiftTemplateID.
        10. Only output the CSV data. Do not include any explanations, comments, or any text before or after the CSV data block.
        Provided Data:
        {collected_data_text}
        Please generate the schedule assignments in CSV format now.
        """
        if logger.app_logger.isEnabledFor(logging.DEBUG): # Use logger.app_logger
             logger.app_logger.debug(f"Generated system prompt: {prompt}") # Use logger.app_logger
        else:
            logger.app_logger.info(f"Generated system prompt (first 500 chars): {prompt[:500]}...") # Use logger.app_logger
        return prompt

    def _call_gemini_api(self, system_prompt, model_parameters=None):
        if not self.gemini_api_key:
            logger.app_logger.error("Gemini API key is not configured. Cannot make API call.") # Use logger.app_logger
            raise ValueError("Gemini API key not configured. Set GEMINI_API_KEY environment variable.")
        logger.app_logger.info(f"Calling Gemini API model: {self.gemini_model_name}") # Use logger.app_logger
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model_name}:generateContent?key={self.gemini_api_key}"
        headers = {"Content-Type": "application/json"}
        current_model_params = self.default_model_params.copy()
        if model_parameters:
            if "generationConfig" in model_parameters:
                current_model_params["generationConfig"] = {**current_model_params.get("generationConfig", {}), **model_parameters["generationConfig"]}
            if "safetySettings" in model_parameters:
                current_model_params["safetySettings"] = model_parameters["safetySettings"]
        payload = {
            "contents": [{"parts": [{"text": system_prompt}]}],
            "generationConfig": current_model_params.get("generationConfig"),
            "safetySettings": current_model_params.get("safetySettings")
        }
        try:
            logger.app_logger.debug(f"Gemini API Request URL: {api_url}") # Use logger.app_logger
            if logger.app_logger.isEnabledFor(logging.DEBUG): # Use logger.app_logger
                 logger.app_logger.debug(f"Gemini API Request Payload: {json.dumps(payload, indent=2)}") # Use logger.app_logger
            response = requests.post(api_url, headers=headers, json=payload, timeout=300)
            response.raise_for_status()
            response_json = response.json()
            logger.app_logger.info("Successfully received response from Gemini API.") # Use logger.app_logger
            if logger.app_logger.isEnabledFor(logging.DEBUG): # Use logger.app_logger
                 logger.app_logger.debug(f"Gemini API Full Response: {json.dumps(response_json, indent=2)}") # Use logger.app_logger
            if (candidates := response_json.get("candidates")) and \
               (content := candidates[0].get("content")) and \
               (parts := content.get("parts")) and \
               (text := parts[0].get("text")):
                csv_text = text.strip()
                logger.app_logger.info(f"Extracted CSV text from Gemini API response (length: {len(csv_text)}).") # Use logger.app_logger
                if not csv_text:
                    logger.app_logger.warning("Gemini API returned an empty CSV string.") # Use logger.app_logger
                return csv_text
            else:
                logger.app_logger.error("Gemini API response missing expected text content structure.", extra={"api_response": response_json}) # Use logger.app_logger
                raise ValueError("Invalid response structure from Gemini API.")
        except requests.exceptions.HTTPError as http_err:
            error_details = http_err.response.text
            try: error_details = http_err.response.json()
            except json.JSONDecodeError: pass
            logger.app_logger.error(f"HTTP error calling Gemini API: {http_err.response.status_code} - {http_err.response.reason}", extra={"error_details": error_details}) # Use logger.app_logger
            raise ConnectionError(f"Gemini API HTTP error: {http_err.response.status_code}. Details: {error_details}") from http_err
        except requests.exceptions.RequestException as req_err:
            logger.app_logger.error(f"Request error calling Gemini API: {str(req_err)}", exc_info=True) # Use logger.app_logger
            raise ConnectionError(f"Gemini API request failed: {str(req_err)}") from req_err
        except ValueError as val_err:
            logger.app_logger.error(f"Value error processing Gemini API response: {str(val_err)}", exc_info=True) # Use logger.app_logger
            raise
        except Exception as e:
            logger.app_logger.error(f"Unexpected error during Gemini API call: {str(e)}", exc_info=True) # Use logger.app_logger
            raise ConnectionError(f"Unexpected error connecting to Gemini: {str(e)}") from e

    def _parse_csv_response(self, csv_text, expected_start_date, expected_end_date):
        logger.app_logger.info(f"Parsing CSV response (length: {len(csv_text)}).") # Use logger.app_logger
        expected_header = ["employeeid", "date", "shifttemplateid", "shiftname", "starttime", "endtime"]
        assignments = []
        malformed_rows = 0
        try:
            csvfile = StringIO(csv_text)
            reader = csv.reader(csvfile)
            header = next(reader, None)
            if not header:
                logger.app_logger.warning("CSV response is empty or contains no header.") # Use logger.app_logger
                return []
            normalized_header = [h.lower().replace(" ", "") for h in header]
            if normalized_header != expected_header:
                logger.app_logger.error(f"CSV header mismatch. Expected: {expected_header}, Got: {normalized_header}") # Use logger.app_logger
                raise ValueError(f"CSV header mismatch. Expected: {expected_header}, Got: {normalized_header}")
            logger.app_logger.info("CSV header validated successfully.") # Use logger.app_logger
            for i, row in enumerate(reader):
                row_num = i + 2
                if len(row) != len(expected_header):
                    logger.app_logger.warning(f"Row {row_num}: Incorrect number of columns. Expected {len(expected_header)}, got {len(row)}. Row: {row}") # Use logger.app_logger
                    malformed_rows += 1
                    continue
                try:
                    raw_assignment = dict(zip(expected_header, row))
                    employee_id = int(raw_assignment["employeeid"])
                    assignment_date_str = raw_assignment["date"]
                    shift_template_id = int(raw_assignment["shifttemplateid"])
                    shift_name = raw_assignment["shiftname"].strip()
                    start_time_str = raw_assignment["starttime"]
                    end_time_str = raw_assignment["endtime"]

                    if employee_id <= 0:
                        logger.app_logger.warning(f"Row {row_num}: Invalid EmployeeID {employee_id}. Must be > 0. Row: {row}") # Use logger.app_logger
                        malformed_rows += 1
                        continue
                    
                    if shift_template_id <= 0:
                        logger.app_logger.warning(f"Row {row_num}: Invalid ShiftTemplateID {shift_template_id}. Must be > 0. Row: {row}") # Use logger.app_logger
                        malformed_rows += 1
                        continue

                    try:
                        assignment_date = datetime.strptime(assignment_date_str, '%Y-%m-%d').date()
                        if not (expected_start_date <= assignment_date <= expected_end_date):
                            logger.app_logger.warning(f"Row {row_num}: Assignment date {assignment_date_str} out of range. Row: {row}") # Use logger.app_logger
                            malformed_rows += 1
                            continue
                    except ValueError:
                        logger.app_logger.warning(f"Row {row_num}: Invalid date format '{assignment_date_str}'. Row: {row}") # Use logger.app_logger
                        malformed_rows += 1
                        continue
                    try:
                        start_time_obj = datetime.strptime(start_time_str, '%H:%M').time()
                        end_time_obj = datetime.strptime(end_time_str, '%H:%M').time()
                    except ValueError:
                        logger.app_logger.warning(f"Row {row_num}: Invalid time format for '{start_time_str}' or '{end_time_str}'. Row: {row}") # Use logger.app_logger
                        malformed_rows += 1
                        continue
                    if not shift_name:
                        logger.app_logger.warning(f"Row {row_num}: ShiftName is empty. Row: {row}") # Use logger.app_logger
                        malformed_rows += 1
                        continue
                    assignments.append({
                        "employee_id": employee_id, "date": assignment_date, "shift_template_id": shift_template_id,
                        "shift_name_from_ai": shift_name, "start_time": start_time_obj, "end_time": end_time_obj,
                        "raw_row": row
                    })
                except ValueError as ve:
                    logger.app_logger.warning(f"Row {row_num}: Data conversion error: {ve}. Row: {row}") # Use logger.app_logger
                    malformed_rows += 1
                except Exception as e:
                    logger.app_logger.error(f"Row {row_num}: Unexpected error processing row: {e}. Row: {row}", exc_info=True) # Use logger.app_logger
                    malformed_rows += 1
            logger.app_logger.info(f"Finished parsing CSV response. Total rows: {i+1}, Malformed rows: {malformed_rows}") # Use logger.app_logger
        except Exception as e:
            logger.app_logger.error(f"Critical error during CSV parsing: {e}", exc_info=True) # Use logger.app_logger
            raise ValueError(f"Failed to parse CSV response: {e}") from e
        return assignments

    def _store_assignments(self, parsed_assignments, version_id, schedule_start_date, schedule_end_date):
        logger.app_logger.info(f"Storing {len(parsed_assignments)} assignments for version {version_id} (Dates: {schedule_start_date} to {schedule_end_date}).") # Use logger.app_logger
        try:
            # Clear existing assignments for this version within the date range if version_id is provided
            if version_id is not None:
                 # Note: This assumes Schedule model has a 'version' column and a 'date' column
                 # Adjust query if model structure is different
                 delete_count = Schedule.query.filter(
                     Schedule.version == version_id,
                     Schedule.date >= schedule_start_date,
                     Schedule.date <= schedule_end_date
                 ).delete(synchronize_session='fetch')
                 logger.app_logger.info(f"Cleared {delete_count} existing assignments for version {version_id} within the date range.")
            else:
                 logger.app_logger.info("version_id is None. Not clearing existing assignments.")

            new_assignments = []
            for assignment_data in parsed_assignments:
                # Map parsed data to Schedule model attributes
                # Ensure column names match your Schedule model exactly
                new_assignment = Schedule(
                    employee_id=assignment_data["employee_id"],
                    date=assignment_data["date"],
                    shift_id=assignment_data["shift_template_id"], # Use shift_id based on likely schema
                    # Assuming Schedule model has these columns or they are derivable/not needed directly from AI output
                    # shift_name=assignment_data["shift_name_from_ai"], # If Schedule has shift_name
                    # start_time=assignment_data["start_time"], # If Schedule has start_time
                    # end_time=assignment_data["end_time"], # If Schedule has end_time
                    version=version_id # Use version based on likely schema
                    # Add other Schedule model attributes as needed, e.g., created_at, updated_at
                )
                new_assignments.append(new_assignment)

            db.session.add_all(new_assignments)
            db.session.commit()
            logger.app_logger.info(f"Successfully stored {len(new_assignments)} new assignments.") # Use logger.app_logger
            return {"status": "success", "message": f"Successfully stored {len(new_assignments)} assignments.", "count": len(new_assignments)}

        except SQLAlchemyError as e:
            db.session.rollback()
            logger.app_logger.error(f"Database error storing assignments: {e}", exc_info=True) # Use logger.app_logger
            raise RuntimeError(f"Database error storing assignments: {e}") from e
        except Exception as e:
            logger.app_logger.error(f"Unexpected error storing assignments: {e}", exc_info=True) # Use logger.app_logger
            raise RuntimeError(f"Unexpected error storing assignments: {e}") from e

    def process_feedback(self, feedback_data: AIScheduleFeedbackRequest):
        """
        Processes user feedback on AI-generated schedules.

        Args:
            feedback_data: An instance of AIScheduleFeedbackRequest containing feedback data.

        Returns:
            A dictionary indicating the result of the feedback processing.
        """
        logger.app_logger.info(f"Processing feedback for version ID: {feedback_data.version_id}")
        logger.app_logger.debug(f"Feedback data received: {feedback_data.manual_assignments}")

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

        return {"status": "received", "message": message, "processed_count": processed_count}

    def generate_schedule_via_ai(self, start_date_str, end_date_str, version_id=None, ai_model_params=None):
        logger.app_logger.info(f"Initiating AI schedule generation for dates {start_date_str} to {end_date_str}, version_id: {version_id}") # Use logger.app_logger
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError as e:
            logger.app_logger.error(f"Invalid date format provided: {e}") # Use logger.app_logger
            raise ValueError("Invalid date format. Use YYYY-MM-DD.") from e

        if start_date > end_date:
            logger.app_logger.warning(f"Start date ({start_date_str}) is after end date ({end_date_str}).") # Use logger.app_logger
            return {"status": "failed", "message": "Start date cannot be after end date."}

        # 1. Collect relevant data
        try:
            collected_data_text = self._collect_data_for_ai_prompt(start_date, end_date)
            if not collected_data_text:
                 logger.app_logger.warning("Collected data for AI prompt is empty.") # Use logger.app_logger
                 # Depending on requirements, might return an error or an empty schedule
                 return {"status": "warning", "message": "No relevant data collected for the specified date range. Cannot generate schedule.", "generated_assignments_count": 0}
        except Exception as e:
            logger.app_logger.error(f"Failed to collect data for AI prompt: {e}", exc_info=True) # Use logger.app_logger
            raise RuntimeError(f"Failed to collect data for AI prompt: {e}") from e

        # 2. Construct the prompt
        try:
            system_prompt = self._construct_system_prompt(collected_data_text, start_date, end_date)
            if not system_prompt:
                 logger.app_logger.warning("Constructed system prompt is empty.") # Use logger.app_logger
                 return {"status": "failed", "message": "Failed to construct system prompt.", "generated_assignments_count": 0}
        except Exception as e:
            logger.app_logger.error(f"Failed to construct system prompt: {e}", exc_info=True) # Use logger.app_logger
            raise RuntimeError(f"Failed to construct system prompt: {e}") from e

        # 3. Call the AI model API
        try:
            csv_response = self._call_gemini_api(system_prompt, ai_model_params)
            if not csv_response:
                 logger.app_logger.warning("AI API returned an empty response.") # Use logger.app_logger
                 return {"status": "warning", "message": "AI model returned an empty response. Could not generate assignments.", "generated_assignments_count": 0}
        except ConnectionError as e:
            logger.app_logger.error(f"Failed to call Gemini API: {e}", exc_info=True) # Use logger.app_logger
            return {"status": "error", "message": f"Failed to call AI service: {e}", "generated_assignments_count": 0}
        except Exception as e:
            logger.app_logger.error(f"Unexpected error calling AI API: {e}", exc_info=True) # Use logger.app_logger
            return {"status": "error", "message": f"An unexpected error occurred during AI call: {e}", "generated_assignments_count": 0}

        # 4. Parse the CSV response
        try:
            parsed_assignments = self._parse_csv_response(csv_response, start_date, end_date)
            logger.app_logger.info(f"Parsed {len(parsed_assignments)} valid assignments from AI response.") # Use logger.app_logger
            if not parsed_assignments:
                logger.app_logger.warning("No valid assignments parsed from AI response.") # Use logger.app_logger
                return {"status": "warning", "message": "AI model generated a response, but no valid assignments could be parsed.", "generated_assignments_count": 0}
        except ValueError as e:
            logger.app_logger.error(f"Failed to parse AI response CSV: {e}", exc_info=True) # Use logger.app_logger
            return {"status": "error", "message": f"Failed to parse AI response: {e}", "generated_assignments_count": 0}
        except Exception as e:
            logger.app_logger.error(f"Unexpected error parsing AI response: {e}", exc_info=True) # Use logger.app_logger
            return {"status": "error", "message": f"An unexpected error occurred during parsing: {e}", "generated_assignments_count": 0}

        # 5. Store the assignments
        try:
            store_result = self._store_assignments(parsed_assignments, version_id, start_date, end_date)
            logger.app_logger.info(f"Assignments stored successfully. Count: {store_result.get('count', 0)}") # Use logger.app_logger
            return {"status": "success", "message": f"Schedule generated and stored successfully. {store_result.get('count', 0)} assignments created.", "generated_assignments_count": store_result.get('count', 0)}
        except RuntimeError as e:
            logger.app_logger.error(f"Failed to store assignments: {e}", exc_info=True) # Use logger.app_logger
            return {"status": "error", "message": f"Failed to store generated schedule: {e}", "generated_assignments_count": 0}
        except Exception as e:
            logger.app_logger.error(f"Unexpected error storing assignments: {e}", exc_info=True) # Use logger.app_logger
            return {"status": "error", "message": f"An unexpected error occurred during storage: {e}", "generated_assignments_count": 0}


# Helper function for testing (optional, can be removed or moved)
def test_ai_scheduler_service():
    # This is a placeholder and requires a running Flask app with DB access
    # and a configured GEMINI_API_KEY to run successfully.
    print("\n--- Testing AISchedulerService ---")
    service = AISchedulerService()
    
    # Example dates (replace with actual dates in your DB)
    start_date_str = "2024-07-01"
    end_date_str = "2024-07-07"
    test_version_id = 99 # Use a test-specific version ID

    try:
        print(f"Attempting to generate schedule for {start_date_str} to {end_date_str}...")
        result = service.generate_schedule_via_ai(
            start_date_str=start_date_str,
            end_date_str=end_date_str,
            version_id=test_version_id,
            ai_model_params={"generationConfig": {"temperature": 0.5}}
        )
        print(f"Generation Result: {result}")

        # Add a placeholder for testing feedback processing
        print("\n--- Testing Feedback Processing (Placeholder) ---")
        mock_feedback_data = AIScheduleFeedbackRequest(
            version_id=test_version_id,
            manual_assignments=[
                {"employee_id": 1, "date": "2024-07-01", "shift_id": 2},
                {"employee_id": 3, "date": "2024-07-03", "shift_id": 1, "action": "remove"},
            ]
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

if __name__ == '__main__':
    # This block is mainly for testing the service in isolation if possible,
    # but note the caveats above about Flask context.
    # test_ai_scheduler_service()
    pass # Avoid running test automatically for now
