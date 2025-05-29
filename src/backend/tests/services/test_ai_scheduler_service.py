# src/backend/tests/services/test_ai_scheduler_service.py
import unittest
from unittest.mock import patch, MagicMock
import os
from datetime import date, time
import json
import logging
import requests
from sqlalchemy.exc import SQLAlchemyError

# Attempt to import the service, handling potential import issues early
try:
    from src.backend.services.ai_scheduler_service import (
        AISchedulerService as AIService,
    )
except ImportError as e:
    # This print helps in diagnosing import errors when tests are run
    print(f"Import Error in test_ai_scheduler_service.py: {e}")
    AIService = None  # Allows file to be parsed if service can't be imported


class TestAISchedulerService(unittest.TestCase):
    def setUp(self):
        if AIService is None:
            self.skipTest("AISchedulerService (AIService) could not be imported.")

        # Store original environment variables
        self.original_gemini_api_key = os.environ.get("GEMINI_API_KEY")

    def tearDown(self):
        # Restore original environment variables
        if self.original_gemini_api_key is not None:
            os.environ["GEMINI_API_KEY"] = self.original_gemini_api_key
        elif "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_load_api_key_from_settings_success(self, mock_logger):
        """Test that API key is loaded correctly when GEMINI_API_KEY is set."""
        test_api_key = "test_key_123"
        os.environ["GEMINI_API_KEY"] = test_api_key

        service = AIService()  # type: ignore
        self.assertEqual(service.gemini_api_key, test_api_key)
        mock_logger.app_logger.info.assert_any_call("Loading Gemini API Key.")
        mock_logger.app_logger.info.assert_any_call(
            "GEMINI_API_KEY loaded successfully."
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_load_api_key_from_settings_failure(self, mock_logger):
        """Test that None is returned and error logged if GEMINI_API_KEY is not set."""
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]

        service = AIService()  # type: ignore
        self.assertIsNone(service.gemini_api_key)
        mock_logger.app_logger.info.assert_any_call("Loading Gemini API Key.")
        mock_logger.app_logger.error.assert_called_once_with(
            "GEMINI_API_KEY environment variable not set. AI scheduling will fail if attempted."
        )

    @patch("src.backend.services.ai_scheduler_service.Employee")
    @patch("src.backend.services.ai_scheduler_service.ShiftTemplate")
    @patch("src.backend.services.ai_scheduler_service.Coverage")
    @patch("src.backend.services.ai_scheduler_service.EmployeeAvailability")
    @patch("src.backend.services.ai_scheduler_service.Absence")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_collect_data_for_ai_prompt_success(
        self,
        mock_logger,
        MockAbsence,
        MockEmployeeAvailability,
        MockCoverage,
        MockShiftTemplate,
        MockEmployee,
    ):
        """Test successful data collection for the AI prompt."""

        # Mock class-level attributes for date comparisons in SUT's filter calls
        mock_class_date_attr = MagicMock()
        # These should return a mock that can be part of a SQLAlchemy expression
        mock_comparison_expression = MagicMock()
        mock_class_date_attr.__ge__ = MagicMock(return_value=mock_comparison_expression)
        mock_class_date_attr.__le__ = MagicMock(return_value=mock_comparison_expression)
        mock_class_date_attr.__eq__ = MagicMock(
            return_value=mock_comparison_expression
        )  # Just in case

        MockEmployeeAvailability.start_date = mock_class_date_attr
        MockEmployeeAvailability.end_date = mock_class_date_attr
        MockAbsence.start_date = mock_class_date_attr
        MockAbsence.end_date = mock_class_date_attr

        # Setup mock return values for model queries
        mock_emp = MagicMock()
        mock_emp.id = 1
        mock_emp.name = "John Doe"
        mock_emp.role = "Cashier"
        mock_emp.is_keyholder = False
        MockEmployee.query.filter_by.return_value.all.return_value = [mock_emp]

        mock_st = MagicMock()
        mock_st.id = 10
        mock_st.name = "Morning"
        mock_st.start_time = time(8, 0)
        mock_st.end_time = time(16, 0)
        mock_st.active_days = [0, 1, 2, 3, 4]  # Mon-Fri
        MockShiftTemplate.query.all.return_value = [mock_st]

        mock_cov = MagicMock()
        mock_cov.id = 100
        mock_cov.shift_template_id = 10
        mock_cov.min_employees = 1
        mock_cov.max_employees = 2
        mock_cov.days_of_week = [0, 1, 2, 3, 4]
        MockCoverage.query.all.return_value = [mock_cov]

        # Mock EmployeeAvailability.availability_type.value
        mock_avail_type = MagicMock()
        mock_avail_type.value = "Available"

        mock_avail = MagicMock()
        mock_avail.employee_id = 1
        mock_avail.start_date = date(2024, 1, 1)
        mock_avail.end_date = date(2024, 1, 1)
        mock_avail.availability_type = mock_avail_type  # mock the enum wrapper
        mock_avail.day_of_week = 0  # Monday
        mock_avail.hour = 8
        mock_avail.is_available = True
        MockEmployeeAvailability.query.filter.return_value.all.return_value = [
            mock_avail
        ]

        mock_abs = MagicMock()
        mock_abs.employee_id = 1
        mock_abs.start_date = date(2024, 1, 2)
        mock_abs.end_date = date(2024, 1, 2)
        mock_abs.reason = "Sick"
        MockAbsence.query.filter.return_value.all.return_value = [mock_abs]

        service = AIService()  # type: ignore
        start_date_obj = date(2024, 1, 1)
        end_date_obj = date(2024, 1, 7)

        result_text = service._collect_data_for_ai_prompt(start_date_obj, end_date_obj)

        # Verify that the expected sections are present
        self.assertIn("Employees:", result_text)
        self.assertIn(
            json.dumps(
                [
                    {
                        "id": 1,
                        "name": "John Doe",
                        "role": "Cashier",
                        "is_keyholder": False,
                    }
                ],
                indent=2,
            ),
            result_text,
        )

        self.assertIn("Shift Templates:", result_text)
        self.assertIn(
            json.dumps(
                [
                    {
                        "id": 10,
                        "name": "Morning",
                        "start_time": "08:00:00",
                        "end_time": "16:00:00",
                        "active_days": [0, 1, 2, 3, 4],
                    }
                ],
                indent=2,
            ),
            result_text,
        )

        self.assertIn("Coverage Needs:", result_text)
        self.assertIn(
            json.dumps(
                [
                    {
                        "id": 100,
                        "shift_template_id": 10,
                        "min_employees": 1,
                        "max_employees": 2,
                        "days_of_week": [0, 1, 2, 3, 4],
                    }
                ],
                indent=2,
            ),
            result_text,
        )

        self.assertIn(
            f"Employee Availability ({start_date_obj} to {end_date_obj}):", result_text
        )
        # Construct expected availability string carefully based on the service's formatting
        expected_avail_record = f"From 2024-01-01 to 2024-01-01, Type: Available, Day: 0, Hour: 8, IsAvailable: True"
        expected_avail_json_part = {
            "employee_id": 1,
            "availability_type": "Available",
            "raw_availability_record": expected_avail_record,
        }
        self.assertIn(json.dumps([expected_avail_json_part], indent=2), result_text)

        self.assertIn(
            f"Employee Absences ({start_date_obj} to {end_date_obj}):", result_text
        )
        self.assertIn(
            json.dumps(
                [
                    {
                        "employee_id": 1,
                        "start_date": "2024-01-02",
                        "end_date": "2024-01-02",
                        "reason": "Sick",
                    }
                ],
                indent=2,
            ),
            result_text,
        )

        self.assertIn("General Scheduling Rules:", result_text)
        self.assertIn(
            json.dumps(
                {
                    "max_consecutive_shifts": 5,
                    "min_rest_between_shifts_hours": 11,
                    "max_weekly_hours": 40,
                },
                indent=2,
            ),
            result_text,
        )

        mock_logger.app_logger.info.assert_any_call(
            f"Collecting data for AI prompt from {start_date_obj} to {end_date_obj}."
        )
        mock_logger.app_logger.info.assert_any_call(
            "Data collection for AI prompt complete."
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    @patch("src.backend.services.ai_scheduler_service.Absence")
    @patch("src.backend.services.ai_scheduler_service.EmployeeAvailability")
    @patch("src.backend.services.ai_scheduler_service.Coverage")
    @patch("src.backend.services.ai_scheduler_service.ShiftTemplate")
    @patch("src.backend.services.ai_scheduler_service.Employee")
    def test_collect_data_for_ai_prompt_db_errors(
        self,
        MockEmployee,
        MockShiftTemplate,
        MockCoverage,
        MockEmployeeAvailability,
        MockAbsence,
        mock_logger,
    ):
        """Test data collection when various database queries fail."""
        # Setup side effects for model queries to simulate DB errors
        MockEmployee.query.filter_by.return_value.all.side_effect = Exception(
            "DB Employee Error"
        )
        MockShiftTemplate.query.all.side_effect = Exception("DB ShiftTemplate Error")
        MockCoverage.query.all.side_effect = Exception("DB Coverage Error")
        # Make the filter call itself raise the error for EmployeeAvailability
        MockEmployeeAvailability.query.filter.side_effect = Exception(
            "DB Availability Error"
        )
        # Absence query is in the same try-catch block, so the above error will be caught first.

        service = AIService()  # type: ignore
        start_date_obj = date(2024, 1, 1)
        end_date_obj = date(2024, 1, 7)

        result_text = service._collect_data_for_ai_prompt(start_date_obj, end_date_obj)

        # Verify error messages are included in the output
        self.assertIn("Employees: Error collecting data.", result_text)
        self.assertIn("Shift Templates: Error collecting data.", result_text)
        self.assertIn("Coverage Needs: Error collecting data.", result_text)
        self.assertIn(
            "Employee Availability/Absences: Error collecting data.", result_text
        )  # Combined error message

        # Verify errors were logged
        mock_logger.app_logger.error.assert_any_call(
            "Error collecting employee data: DB Employee Error", exc_info=True
        )
        mock_logger.app_logger.error.assert_any_call(
            "Error collecting shift template data: DB ShiftTemplate Error",
            exc_info=True,
        )
        mock_logger.app_logger.error.assert_any_call(
            "Error collecting coverage data: DB Coverage Error", exc_info=True
        )
        # This will be called for the availability query, and since absences are in the same block, it's one error log for that section
        mock_logger.app_logger.error.assert_any_call(
            "Error collecting availability/absence data: DB Availability Error",
            exc_info=True,
        )

        # General rules should still be present
        self.assertIn("General Scheduling Rules:", result_text)
        self.assertIn(
            json.dumps(
                {
                    "max_consecutive_shifts": 5,
                    "min_rest_between_shifts_hours": 11,
                    "max_weekly_hours": 40,
                },
                indent=2,
            ),
            result_text,
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_construct_system_prompt(self, mock_logger):
        """Test the construction of the system prompt for the AI."""
        service = AIService()  # type: ignore
        start_date_obj = date(2024, 8, 1)
        end_date_obj = date(2024, 8, 7)
        collected_data_text = (
            "Employees:\n[]\n\nShift Templates:\n[]\n\nCoverage Needs:\n[]"
        )

        prompt = service._construct_system_prompt(
            collected_data_text, start_date_obj, end_date_obj
        )

        self.assertIn(
            f"Schedule Period: {start_date_obj.isoformat()} to {end_date_obj.isoformat()}",
            prompt,
        )
        self.assertIn("Output Format:", prompt)
        self.assertIn("Please provide the schedule STRICTLY in CSV format.", prompt)
        self.assertIn(
            "EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime", prompt
        )
        self.assertIn("Provided Data:", prompt)
        self.assertIn(collected_data_text, prompt)
        self.assertIn(
            "Please generate the schedule assignments in CSV format now.", prompt
        )

        mock_logger.app_logger.info.assert_any_call(
            "Constructing system prompt for AI."
        )
        # Check if debug logging for the prompt was called or info for truncated prompt
        # This depends on the default logging level, so we check if either was logged appropriately.
        if mock_logger.app_logger.isEnabledFor(logging.DEBUG):
            mock_logger.app_logger.debug.assert_called_with(
                f"Generated system prompt: {prompt}"
            )
        else:
            mock_logger.app_logger.info.assert_called_with(
                f"Generated system prompt (first 500 chars): {prompt[:500]}..."
            )

    @patch("src.backend.services.ai_scheduler_service.requests.post")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_call_gemini_api_success(self, mock_logger, mock_post):
        """Test successful call to Gemini API and CSV extraction."""
        service = AIService()  # type: ignore
        service.gemini_api_key = "fake_api_key"

        expected_csv_text = "EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime\n1,2024-08-01,10,Morning,08:00,16:00"
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": expected_csv_text}]}}]
        }
        mock_response.raise_for_status = MagicMock()  # Does nothing for success
        mock_post.return_value = mock_response

        system_prompt = "Test prompt"
        csv_text = service._call_gemini_api(system_prompt)

        self.assertEqual(csv_text, expected_csv_text.strip())
        mock_post.assert_called_once()
        # Further assertions can be made on the payload if needed
        mock_logger.app_logger.info.assert_any_call(
            f"Calling Gemini API model: {service.gemini_model_name}"
        )
        mock_logger.app_logger.info.assert_any_call(
            "Successfully received response from Gemini API."
        )
        mock_logger.app_logger.info.assert_any_call(
            f"Extracted CSV text from Gemini API response (length: {len(expected_csv_text.strip())})."
        )

    @patch("src.backend.services.ai_scheduler_service.requests.post")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_call_gemini_api_http_error(self, mock_logger, mock_post):
        """Test Gemini API call that results in an HTTP error."""
        service = AIService()  # type: ignore
        service.gemini_api_key = "fake_api_key"

        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.reason = "Bad Request"
        mock_response.text = "Invalid API key"
        mock_response.json.side_effect = json.JSONDecodeError(
            "msg", "doc", 0
        )  # Simulate no valid JSON in error
        http_error = requests.exceptions.HTTPError(response=mock_response)
        mock_response.raise_for_status.side_effect = http_error
        mock_post.return_value = mock_response

        with self.assertRaises(ConnectionError) as context:
            service._call_gemini_api("Test prompt")

        self.assertIn("Gemini API HTTP error: 400", str(context.exception))
        self.assertIn("Invalid API key", str(context.exception))
        mock_logger.app_logger.error.assert_any_call(
            f"HTTP error calling Gemini API: 400 - Bad Request",
            extra={"error_details": "Invalid API key"},
        )

    @patch("src.backend.services.ai_scheduler_service.requests.post")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_call_gemini_api_request_exception(self, mock_logger, mock_post):
        """Test Gemini API call that results in a RequestException (e.g., timeout)."""
        service = AIService()  # type: ignore
        service.gemini_api_key = "fake_api_key"

        mock_post.side_effect = requests.exceptions.Timeout("Connection timed out")

        with self.assertRaises(ConnectionError) as context:
            service._call_gemini_api("Test prompt")

        self.assertIn(
            "Gemini API request failed: Connection timed out", str(context.exception)
        )
        mock_logger.app_logger.error.assert_any_call(
            "Request error calling Gemini API: Connection timed out", exc_info=True
        )

    @patch("src.backend.services.ai_scheduler_service.requests.post")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_call_gemini_api_invalid_response_structure(self, mock_logger, mock_post):
        """Test Gemini API call with a response missing expected structure."""
        service = AIService()  # type: ignore
        service.gemini_api_key = "fake_api_key"

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "error": "Some error"
        }  # Missing 'candidates'
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        with self.assertRaises(ValueError) as context:
            service._call_gemini_api("Test prompt")

        self.assertIn(
            "Invalid response structure from Gemini API", str(context.exception)
        )
        mock_logger.app_logger.error.assert_any_call(
            "Gemini API response missing expected text content structure.",
            extra={"api_response": {"error": "Some error"}},
        )

    @patch("src.backend.services.ai_scheduler_service.requests.post")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_call_gemini_api_empty_csv_text(self, mock_logger, mock_post):
        """Test Gemini API call returns success but with empty CSV text."""
        service = AIService()  # type: ignore
        service.gemini_api_key = "fake_api_key"

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "candidates": [
                {
                    "content": {"parts": [{"text": "  "}]}  # Empty text after strip
                }
            ]
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        csv_text = service._call_gemini_api("Test prompt")
        self.assertEqual(csv_text, "")
        mock_logger.app_logger.warning.assert_any_call(
            "Gemini API returned an empty CSV string."
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_call_gemini_api_no_api_key(self, mock_logger):
        """Test Gemini API call when API key is not configured."""
        service = AIService()  # type: ignore
        service.gemini_api_key = None  # Simulate API key not loaded

        with self.assertRaises(ValueError) as context:
            service._call_gemini_api("Test prompt")

        self.assertIn("Gemini API key not configured", str(context.exception))
        mock_logger.app_logger.error.assert_any_call(
            "Gemini API key is not configured. Cannot make API call."
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_parse_csv_response_valid_data(self, mock_logger):
        """Test parsing a valid CSV response."""
        service = AIService()  # type: ignore
        csv_text = (
            "EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime\n"
            "1,2024-08-01,10,Morning,08:00,16:00\n"
            "2,2024-08-02,11,Evening,16:00,23:00"
        )
        start_date_obj = date(2024, 8, 1)
        end_date_obj = date(2024, 8, 7)

        assignments = service._parse_csv_response(
            csv_text, start_date_obj, end_date_obj
        )

        self.assertEqual(len(assignments), 2)
        self.assertEqual(assignments[0]["employee_id"], 1)
        self.assertEqual(assignments[0]["date"], date(2024, 8, 1))
        self.assertEqual(assignments[0]["shift_template_id"], 10)
        self.assertEqual(assignments[0]["shift_name_from_ai"], "Morning")
        self.assertEqual(assignments[0]["start_time"], time(8, 0))
        self.assertEqual(assignments[0]["end_time"], time(16, 0))
        self.assertEqual(
            assignments[0]["raw_row"],
            ["1", "2024-08-01", "10", "Morning", "08:00", "16:00"],
        )

        self.assertEqual(assignments[1]["employee_id"], 2)
        self.assertEqual(assignments[1]["date"], date(2024, 8, 2))
        mock_logger.app_logger.info.assert_any_call(
            f"Parsing CSV response (length: {len(csv_text)})."
        )
        mock_logger.app_logger.info.assert_any_call(
            "CSV header validated successfully."
        )
        mock_logger.app_logger.info.assert_any_call(
            f"Successfully parsed {len(assignments)} valid assignments from CSV."
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_parse_csv_response_empty_input(self, mock_logger):
        """Test parsing an empty CSV string."""
        service = AIService()  # type: ignore
        assignments = service._parse_csv_response(
            "", date(2024, 1, 1), date(2024, 1, 1)
        )
        self.assertEqual(assignments, [])
        mock_logger.app_logger.warning.assert_any_call(
            "CSV response is empty or contains no header."
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_parse_csv_response_no_header(self, mock_logger):
        """Test parsing CSV with no header (effectively empty after trying to read header)."""
        service = AIService()  # type: ignore
        # Simulate CSV where next(reader, None) returns None for header
        assignments = service._parse_csv_response(
            "\n", date(2024, 1, 1), date(2024, 1, 1)
        )  # Only a newline
        self.assertEqual(assignments, [])
        mock_logger.app_logger.warning.assert_any_call(
            "CSV response is empty or contains no header."
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_parse_csv_response_mismatched_header(self, mock_logger):
        """Test parsing CSV with a mismatched header."""
        service = AIService()  # type: ignore
        csv_text = "Wrong,Header,Columns\n1,2024-08-01,10,Morning,08:00,16:00"
        with self.assertRaisesRegex(ValueError, "CSV header mismatch"):
            service._parse_csv_response(csv_text, date(2024, 1, 1), date(2024, 1, 1))
        expected_header = [
            "employeeid",
            "date",
            "shifttemplateid",
            "shiftname",
            "starttime",
            "endtime",
        ]
        normalized_actual_header = ["wrong", "header", "columns"]
        mock_logger.app_logger.error.assert_any_call(
            f"CSV header mismatch. Expected: {expected_header}, Got: {normalized_actual_header}"
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_parse_csv_response_incorrect_column_count(self, mock_logger):
        """Test parsing CSV rows with incorrect number of columns."""
        service = AIService()  # type: ignore
        csv_text = (
            "EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime\n"
            "1,2024-08-01,10,Morning,08:00\n"  # Missing EndTime
            "2,2024-08-02,11,Evening,16:00,23:00,ExtraCol"
        )
        assignments = service._parse_csv_response(
            csv_text, date(2024, 8, 1), date(2024, 8, 7)
        )
        self.assertEqual(len(assignments), 0)  # Both rows should be skipped
        mock_logger.app_logger.warning.assert_any_call(
            "Row 2: Incorrect number of columns. Expected 6, got 5. Row: ['1', '2024-08-01', '10', 'Morning', '08:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Row 3: Incorrect number of columns. Expected 6, got 7. Row: ['2', '2024-08-02', '11', 'Evening', '16:00', '23:00', 'ExtraCol']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Finished parsing CSV. Total malformed/skipped rows: 2"
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_parse_csv_response_invalid_data_types(self, mock_logger):
        """Test parsing CSV with invalid data types in rows."""
        service = AIService()  # type: ignore
        csv_text = (
            "EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime\n"
            "abc,2024-08-01,10,Morning,08:00,16:00\n"  # Invalid EmployeeID
            "1,bad-date,10,Morning,08:00,16:00\n"  # Invalid Date
            "2,2024-08-02,xyz,Evening,16:00,23:00\n"  # Invalid ShiftTemplateID
            "3,2024-08-03,11,Late,bad-time,23:00\n"  # Invalid StartTime
            "4,2024-08-04,12,Night,23:00,bad-time\n"  # Invalid EndTime
        )
        start_date = date(2024, 8, 1)
        end_date = date(2024, 8, 7)
        assignments = service._parse_csv_response(csv_text, start_date, end_date)
        self.assertEqual(len(assignments), 0)
        mock_logger.app_logger.warning.assert_any_call(
            "Row 2: Error converting data type: invalid literal for int() with base 10: 'abc'. Row: ['abc', '2024-08-01', '10', 'Morning', '08:00', '16:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Row 3: Invalid date format 'bad-date'. Row: ['1', 'bad-date', '10', 'Morning', '08:00', '16:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Row 4: Error converting data type: invalid literal for int() with base 10: 'xyz'. Row: ['2', '2024-08-02', 'xyz', 'Evening', '16:00', '23:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Row 5: Invalid time format for 'bad-time' or '23:00'. Row: ['3', '2024-08-03', '11', 'Late', 'bad-time', '23:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Row 6: Invalid time format for '23:00' or 'bad-time'. Row: ['4', '2024-08-04', '12', 'Night', '23:00', 'bad-time']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Finished parsing CSV. Total malformed/skipped rows: 5"
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_parse_csv_response_invalid_ids_and_date_range(self, mock_logger):
        """Test parsing CSV with invalid IDs (<=0) and dates out of range."""
        service = AIService()  # type: ignore
        csv_text = (
            "EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime\n"
            "0,2024-08-01,10,Morning,08:00,16:00\n"  # Invalid EmployeeID (<=0)
            "1,2024-08-01,0,Morning,08:00,16:00\n"  # Invalid ShiftTemplateID (<=0)
            "2,2024-07-31,10,PastShift,08:00,16:00\n"  # Date out of range (before start)
            "3,2024-08-08,11,FutureShift,16:00,23:00\n"  # Date out of range (after end)
            "4,2024-08-01,12,,08:00,16:00\n"  # Empty ShiftName
        )
        start_date = date(2024, 8, 1)
        end_date = date(2024, 8, 7)
        assignments = service._parse_csv_response(csv_text, start_date, end_date)
        self.assertEqual(len(assignments), 0)
        mock_logger.app_logger.warning.assert_any_call(
            "Row 2: Invalid EmployeeID 0. Must be > 0. Row: ['0', '2024-08-01', '10', 'Morning', '08:00', '16:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Row 3: Invalid ShiftTemplateID 0. Must be > 0. Row: ['1', '2024-08-01', '0', 'Morning', '08:00', '16:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Row 4: Assignment date 2024-07-31 out of range. Row: ['2', '2024-07-31', '10', 'PastShift', '08:00', '16:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Row 5: Assignment date 2024-08-08 out of range. Row: ['3', '2024-08-08', '11', 'FutureShift', '16:00', '23:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Row 6: ShiftName is empty. Row: ['4', '2024-08-01', '12', '', '08:00', '16:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Finished parsing CSV. Total malformed/skipped rows: 5"
        )

    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_parse_csv_response_mixed_valid_invalid(self, mock_logger):
        """Test parsing CSV with a mix of valid and invalid rows."""
        service = AIService()  # type: ignore
        csv_text = (
            "EmployeeID,Date,ShiftTemplateID,ShiftName,StartTime,EndTime\n"
            "1,2024-08-01,10,ValidMorning,08:00,16:00\n"  # Valid
            "bad,2024-08-01,10,InvalidEmp,08:00,16:00\n"  # Invalid EmployeeID
            "2,2024-08-02,11,ValidEvening,16:00,23:00\n"  # Valid
            "3,2024-08-03,12,MissingTime,16:00\n"  # Incorrect column count
        )
        start_date = date(2024, 8, 1)
        end_date = date(2024, 8, 7)
        assignments = service._parse_csv_response(csv_text, start_date, end_date)

        self.assertEqual(len(assignments), 2)
        self.assertEqual(assignments[0]["employee_id"], 1)
        self.assertEqual(assignments[1]["employee_id"], 2)

        mock_logger.app_logger.warning.assert_any_call(
            "Row 3: Error converting data type: invalid literal for int() with base 10: 'bad'. Row: ['bad', '2024-08-01', '10', 'InvalidEmp', '08:00', '16:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Row 5: Incorrect number of columns. Expected 6, got 5. Row: ['3', '2024-08-03', '12', 'MissingTime', '16:00']"
        )
        mock_logger.app_logger.warning.assert_any_call(
            "Finished parsing CSV. Total malformed/skipped rows: 2"
        )
        mock_logger.app_logger.info.assert_any_call(
            f"Successfully parsed {len(assignments)} valid assignments from CSV."
        )

    @patch("src.backend.services.ai_scheduler_service.db")
    @patch("src.backend.services.ai_scheduler_service.Schedule")
    @patch("src.backend.services.ai_scheduler_service.Employee")
    @patch("src.backend.services.ai_scheduler_service.ShiftTemplate")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_store_assignments_success(
        self, mock_logger, MockShiftTemplate, MockEmployee, MockSchedule, mock_db
    ):
        """Test successful storage of assignments."""
        service = AIService()  # type: ignore

        # Mock class-level attributes for Schedule for comparisons in SUT's filter
        mock_class_date_attr = MagicMock()
        mock_comparison_expression = MagicMock()
        mock_class_date_attr.__ge__ = MagicMock(return_value=mock_comparison_expression)
        mock_class_date_attr.__le__ = MagicMock(return_value=mock_comparison_expression)
        MockSchedule.date = mock_class_date_attr

        mock_class_version_attr = MagicMock()
        mock_class_version_attr.__eq__ = MagicMock(
            return_value=mock_comparison_expression
        )
        MockSchedule.version = mock_class_version_attr

        parsed_assignments = [
            {
                "employee_id": 1,
                "date": date(2024, 8, 1),
                "shift_template_id": 10,
                "shift_name_from_ai": "Morning",
                "start_time": time(8, 0),
                "end_time": time(16, 0),
                "raw_row": [],
            },
            {
                "employee_id": 2,
                "date": date(2024, 8, 1),
                "shift_template_id": 11,
                "shift_name_from_ai": "Evening",
                "start_time": time(16, 0),
                "end_time": time(23, 0),
                "raw_row": [],
            },
        ]
        version_id = "v1-ai"
        start_date_obj = date(2024, 8, 1)
        end_date_obj = date(2024, 8, 7)

        # Mock Employee.query.get
        mock_emp1 = MagicMock(id=1)
        mock_emp2 = MagicMock(id=2)
        MockEmployee.query.get.side_effect = (
            lambda eid: mock_emp1 if eid == 1 else (mock_emp2 if eid == 2 else None)
        )

        # Mock ShiftTemplate.query.get
        mock_st10 = MagicMock(id=10)
        mock_st11 = MagicMock(id=11)
        MockShiftTemplate.query.get.side_effect = (
            lambda sid: mock_st10 if sid == 10 else (mock_st11 if sid == 11 else None)
        )

        # Mock Schedule.query.filter().delete()
        mock_delete_query = MagicMock()
        MockSchedule.query.filter.return_value = mock_delete_query
        mock_delete_query.delete.return_value = 2  # Simulate 2 rows deleted

        stored_count = service._store_assignments(
            parsed_assignments, version_id, start_date_obj, end_date_obj
        )

        self.assertEqual(stored_count, 2)
        MockSchedule.query.filter.assert_called_once()
        # Check args of filter if more specific (omitted for brevity here, but can be done)
        mock_delete_query.delete.assert_called_once_with(synchronize_session=False)

        self.assertEqual(mock_db.session.add.call_count, 2)
        mock_db.session.commit.assert_called_once()
        mock_db.session.rollback.assert_not_called()

        # Check that Schedule objects were instantiated correctly
        # This requires checking the arguments to mock_db.session.add
        first_add_call_args = mock_db.session.add.call_args_list[0][0][0]
        self.assertIsInstance(
            first_add_call_args, MockSchedule
        )  # It will be an instance of the *mocked* Schedule
        self.assertEqual(first_add_call_args.employee_id, 1)
        self.assertEqual(first_add_call_args.shift_id, 10)
        self.assertEqual(first_add_call_args.date, date(2024, 8, 1))
        self.assertEqual(first_add_call_args.version, version_id)
        self.assertEqual(first_add_call_args.notes, "AI Generated: Morning")

        mock_logger.app_logger.info.assert_any_call(
            f"Storing {len(parsed_assignments)} assignments for version {version_id} from {start_date_obj} to {end_date_obj}."
        )
        mock_logger.app_logger.info.assert_any_call(
            f"Deleted existing schedules for version {version_id} in date range."
        )
        mock_logger.app_logger.info.assert_any_call(
            f"Successfully added {stored_count} new assignments to DB."
        )

    @patch("src.backend.services.ai_scheduler_service.db")
    @patch("src.backend.services.ai_scheduler_service.Schedule")
    @patch("src.backend.services.ai_scheduler_service.Employee")
    @patch("src.backend.services.ai_scheduler_service.ShiftTemplate")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_store_assignments_no_parsed_data(
        self, mock_logger, MockShiftTemplate, MockEmployee, MockSchedule, mock_db
    ):
        service = AIService()  # type: ignore
        stored_count = service._store_assignments(
            [], "v1", date(2024, 1, 1), date(2024, 1, 1)
        )
        self.assertEqual(stored_count, 0)
        mock_logger.app_logger.info.assert_any_call("No assignments to store.")
        mock_db.session.add.assert_not_called()
        mock_db.session.commit.assert_not_called()

    @patch("src.backend.services.ai_scheduler_service.db")
    @patch("src.backend.services.ai_scheduler_service.Schedule")
    @patch("src.backend.services.ai_scheduler_service.Employee")
    @patch("src.backend.services.ai_scheduler_service.ShiftTemplate")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_store_assignments_employee_not_found(
        self, mock_logger, MockShiftTemplate, MockEmployee, MockSchedule, mock_db
    ):
        service = AIService()  # type: ignore

        # Mock class-level attributes for Schedule for comparisons in SUT's filter
        mock_class_date_attr = MagicMock()
        mock_comparison_expression = MagicMock()
        mock_class_date_attr.__ge__ = MagicMock(return_value=mock_comparison_expression)
        mock_class_date_attr.__le__ = MagicMock(return_value=mock_comparison_expression)
        MockSchedule.date = mock_class_date_attr
        mock_class_version_attr = MagicMock()
        mock_class_version_attr.__eq__ = MagicMock(
            return_value=mock_comparison_expression
        )
        MockSchedule.version = mock_class_version_attr

        parsed_assignments = [
            {
                "employee_id": 999,
                "date": date(2024, 8, 1),
                "shift_template_id": 10,
                "shift_name_from_ai": "GhostShift",
                "raw_row": ["999", "2024-08-01", "10", "GhostShift", "08:00", "16:00"],
            }
        ]
        MockEmployee.query.get.return_value = None  # Employee 999 not found
        MockShiftTemplate.query.get.return_value = MagicMock(
            id=10
        )  # ShiftTemplate 10 exists

        stored_count = service._store_assignments(
            parsed_assignments, "v1", date(2024, 8, 1), date(2024, 8, 7)
        )
        self.assertEqual(stored_count, 0)
        mock_logger.app_logger.warning.assert_any_call(
            "Employee with ID 999 not found. Skipping assignment for row: ['999', '2024-08-01', '10', 'GhostShift', '08:00', '16:00']"
        )
        mock_db.session.add.assert_not_called()
        # Commit might be called to finalize deletions even if no new assignments are added.
        # The SUT logic for no new assignments is: logger.info -> try: db.session.commit() -> return 0
        mock_logger.app_logger.info.assert_any_call(
            "No valid new schedule entries to add after processing deletions."
        )
        mock_db.session.commit.assert_called_once()  # Check if commit is called for the deletion part

    @patch("src.backend.services.ai_scheduler_service.db")
    @patch("src.backend.services.ai_scheduler_service.Schedule")
    @patch("src.backend.services.ai_scheduler_service.Employee")
    @patch("src.backend.services.ai_scheduler_service.ShiftTemplate")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_store_assignments_shifttemplate_not_found(
        self, mock_logger, MockShiftTemplate, MockEmployee, MockSchedule, mock_db
    ):
        service = AIService()  # type: ignore

        # Mock class-level attributes for Schedule for comparisons in SUT's filter
        mock_class_date_attr = MagicMock()
        mock_comparison_expression = MagicMock()
        mock_class_date_attr.__ge__ = MagicMock(return_value=mock_comparison_expression)
        mock_class_date_attr.__le__ = MagicMock(return_value=mock_comparison_expression)
        MockSchedule.date = mock_class_date_attr
        mock_class_version_attr = MagicMock()
        mock_class_version_attr.__eq__ = MagicMock(
            return_value=mock_comparison_expression
        )
        MockSchedule.version = mock_class_version_attr

        parsed_assignments = [
            {
                "employee_id": 1,
                "date": date(2024, 8, 1),
                "shift_template_id": 999,
                "shift_name_from_ai": "PhantomShift",
                "raw_row": ["1", "2024-08-01", "999", "PhantomShift", "08:00", "16:00"],
            }
        ]
        MockEmployee.query.get.return_value = MagicMock(id=1)
        MockShiftTemplate.query.get.return_value = None  # ShiftTemplate 999 not found

        stored_count = service._store_assignments(
            parsed_assignments, "v1", date(2024, 8, 1), date(2024, 8, 7)
        )
        self.assertEqual(stored_count, 0)
        mock_logger.app_logger.warning.assert_any_call(
            "ShiftTemplate with ID 999 not found. Skipping assignment for row: ['1', '2024-08-01', '999', 'PhantomShift', '08:00', '16:00']"
        )
        mock_db.session.add.assert_not_called()
        mock_logger.app_logger.info.assert_any_call(
            "No valid new schedule entries to add after processing deletions."
        )
        mock_db.session.commit.assert_called_once()

    @patch("src.backend.services.ai_scheduler_service.db")
    @patch("src.backend.services.ai_scheduler_service.Schedule")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_store_assignments_delete_fails(self, mock_logger, MockSchedule, mock_db):
        service = AIService()  # type: ignore

        # Mock class-level attributes for Schedule for comparisons in SUT's filter
        mock_class_date_attr = MagicMock()
        mock_comparison_expression = MagicMock()
        mock_class_date_attr.__ge__ = MagicMock(return_value=mock_comparison_expression)
        mock_class_date_attr.__le__ = MagicMock(return_value=mock_comparison_expression)
        MockSchedule.date = mock_class_date_attr
        mock_class_version_attr = MagicMock()
        mock_class_version_attr.__eq__ = MagicMock(
            return_value=mock_comparison_expression
        )
        MockSchedule.version = mock_class_version_attr

        parsed_assignments = [
            {
                "employee_id": 1,
                "date": date(2024, 8, 1),
                "shift_template_id": 10,
                "shift_name_from_ai": "Morning",
            }
        ]
        MockSchedule.query.filter.return_value.delete.side_effect = SQLAlchemyError(
            "Delete failed"
        )

        with self.assertRaisesRegex(
            RuntimeError, "Failed to clear existing schedule data."
        ):
            service._store_assignments(
                parsed_assignments, "v1", date(2024, 8, 1), date(2024, 8, 7)
            )

        mock_db.session.rollback.assert_called_once()
        mock_logger.app_logger.error.assert_any_call(
            "Error deleting existing schedule assignments: Delete failed", exc_info=True
        )

    @patch("src.backend.services.ai_scheduler_service.db")
    @patch(
        "src.backend.services.ai_scheduler_service.Schedule"
    )  # Needed for delete part
    @patch("src.backend.services.ai_scheduler_service.Employee")
    @patch("src.backend.services.ai_scheduler_service.ShiftTemplate")
    @patch("src.backend.services.ai_scheduler_service.logger")
    def test_store_assignments_add_fails(
        self, mock_logger, MockShiftTemplate, MockEmployee, MockSchedule, mock_db
    ):
        service = AIService()  # type: ignore

        # Mock class-level attributes for Schedule for comparisons in SUT's filter
        mock_class_date_attr = MagicMock()
        mock_comparison_expression = MagicMock()
        mock_class_date_attr.__ge__ = MagicMock(return_value=mock_comparison_expression)
        mock_class_date_attr.__le__ = MagicMock(return_value=mock_comparison_expression)
        MockSchedule.date = mock_class_date_attr
        mock_class_version_attr = MagicMock()
        mock_class_version_attr.__eq__ = MagicMock(
            return_value=mock_comparison_expression
        )
        MockSchedule.version = mock_class_version_attr

        parsed_assignments = [
            {
                "employee_id": 1,
                "date": date(2024, 8, 1),
                "shift_template_id": 10,
                "shift_name_from_ai": "Morning",
                "raw_row": [],
            }
        ]
        MockEmployee.query.get.return_value = MagicMock(id=1)
        MockShiftTemplate.query.get.return_value = MagicMock(id=10)
        mock_db.session.commit.side_effect = SQLAlchemyError("Commit failed")
        # Delete part should work
        MockSchedule.query.filter.return_value.delete.return_value = 0

        with self.assertRaisesRegex(
            RuntimeError, "Failed to save new assignments to database."
        ):
            service._store_assignments(
                parsed_assignments, "v1", date(2024, 8, 1), date(2024, 8, 7)
            )

        self.assertEqual(
            mock_db.session.rollback.call_count, 1
        )  # Should be 1 due to the add failure. The SUT has nested try-except for commit.
        mock_logger.app_logger.error.assert_any_call(
            "Database error storing new assignments: Commit failed", exc_info=True
        )

    # We will add more tests here for:
    # - generate_schedule_via_ai (integration for the service)


if __name__ == "__main__":
    unittest.main()
