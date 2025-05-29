import unittest
from unittest.mock import patch, MagicMock
from datetime import date
import sys
import os
import json
import logging

# Add the src directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

# Import components to test
from services.scheduler.serialization import ScheduleSerializer
from services.scheduler.generator import ScheduleContainer


class TestScheduleSerializer(unittest.TestCase):
    """
    Test the ScheduleSerializer class which handles converting scheduler
    data structures to API-friendly dictionaries.
    """

    def setUp(self):
        """Set up test fixtures"""
        # Create a logger for testing
        self.mock_logger = MagicMock(spec=logging.Logger)

        # Create a ScheduleSerializer instance with the logger
        self.serializer = ScheduleSerializer(logger=self.mock_logger)

        # Create a mock schedule container
        self.mock_schedule = MagicMock(spec=ScheduleContainer)
        self.mock_schedule.id = 1
        self.mock_schedule.version = 1
        self.mock_schedule.status = "DRAFT"
        self.mock_schedule.start_date = date(2023, 3, 1)
        self.mock_schedule.end_date = date(2023, 3, 31)
        self.mock_schedule.entries = []

        # Create mock entries
        self.mock_entries = []
        for i in range(3):
            entry = MagicMock()
            entry.id = i + 1
            entry.employee_id = (i % 3) + 1
            entry.employee_first_name = f"Employee{(i % 3) + 1}"
            entry.employee_last_name = "Test"
            entry.shift_id = (i % 3) + 1
            entry.shift_name = f"Shift {(i % 3) + 1}"
            entry.shift_start_time = (
                "08:00" if i == 0 else "14:00" if i == 1 else "20:00"
            )
            entry.shift_end_time = "14:00" if i == 0 else "20:00" if i == 1 else "02:00"
            entry.date = date(2023, 3, i + 1)
            self.mock_entries.append(entry)

        # Add entries to the schedule
        self.mock_schedule.entries = self.mock_entries

    def test_convert_entry_to_dict(self):
        """Test converting a schedule entry to a dictionary"""
        # Test case 1: Complete entry
        entry = self.mock_entries[0]
        result = self.serializer.convert_entry_to_dict(entry)

        # Verify the result has the expected keys and values
        self.assertEqual(result["id"], entry.id)
        self.assertEqual(result["employee_id"], entry.employee_id)
        self.assertEqual(
            result["employee_name"],
            f"{entry.employee_first_name} {entry.employee_last_name}",
        )
        self.assertEqual(result["shift_id"], entry.shift_id)
        self.assertEqual(result["shift_name"], entry.shift_name)
        self.assertEqual(result["shift_start_time"], entry.shift_start_time)
        self.assertEqual(result["shift_end_time"], entry.shift_end_time)
        self.assertEqual(result["date"], entry.date.isoformat())

        # Test case 2: Entry with minimal attributes
        minimal_entry = MagicMock()
        minimal_entry.id = 999
        minimal_entry.employee_id = 1
        minimal_entry.shift_id = 1
        minimal_entry.date = date(2023, 3, 15)

        result = self.serializer.convert_entry_to_dict(minimal_entry)

        # Verify required fields
        self.assertEqual(result["id"], minimal_entry.id)
        self.assertEqual(result["employee_id"], minimal_entry.employee_id)
        self.assertEqual(result["shift_id"], minimal_entry.shift_id)
        self.assertEqual(result["date"], minimal_entry.date.isoformat())

        # Verify optional fields have default values
        self.assertEqual(result["employee_name"], "")
        self.assertEqual(result["shift_name"], "")
        self.assertEqual(result["shift_start_time"], "")
        self.assertEqual(result["shift_end_time"], "")

        # Test case 3: Entry with None values
        none_entry = MagicMock()
        none_entry.id = 1000
        none_entry.employee_id = None
        none_entry.shift_id = None
        none_entry.date = None

        result = self.serializer.convert_entry_to_dict(none_entry)

        # Verify None values are handled appropriately
        self.assertEqual(result["id"], none_entry.id)
        self.assertEqual(result["employee_id"], None)
        self.assertEqual(result["shift_id"], None)
        self.assertEqual(result["date"], None)

    def test_convert_schedule_to_dict(self):
        """Test converting a schedule to a dictionary"""
        # Test case 1: Schedule with entries
        result = self.serializer.convert_schedule_to_dict(self.mock_schedule)

        # Verify schedule metadata
        self.assertEqual(result["schedule_id"], self.mock_schedule.id)
        self.assertEqual(result["version"], self.mock_schedule.version)
        self.assertEqual(result["status"], self.mock_schedule.status)
        self.assertEqual(
            result["start_date"], self.mock_schedule.start_date.isoformat()
        )
        self.assertEqual(result["end_date"], self.mock_schedule.end_date.isoformat())

        # Verify entries
        self.assertEqual(len(result["entries"]), 3)
        for i, entry in enumerate(self.mock_entries):
            entry_dict = result["entries"][i]
            self.assertEqual(entry_dict["id"], entry.id)
            self.assertEqual(entry_dict["employee_id"], entry.employee_id)
            self.assertEqual(entry_dict["shift_id"], entry.shift_id)
            self.assertEqual(entry_dict["date"], entry.date.isoformat())

        # Test case 2: Schedule without entries
        self.mock_schedule.entries = []
        result = self.serializer.convert_schedule_to_dict(self.mock_schedule)

        # Verify entries array is empty
        self.assertEqual(len(result["entries"]), 0)

        # Test case 3: Schedule with None properties
        none_schedule = MagicMock(spec=ScheduleContainer)
        none_schedule.id = None
        none_schedule.version = None
        none_schedule.status = None
        none_schedule.start_date = None
        none_schedule.end_date = None
        none_schedule.entries = None

        result = self.serializer.convert_schedule_to_dict(none_schedule)

        # Verify None values are handled appropriately
        self.assertEqual(result["schedule_id"], None)
        self.assertEqual(result["version"], None)
        self.assertEqual(result["status"], None)
        self.assertEqual(result["start_date"], None)
        self.assertEqual(result["end_date"], None)
        self.assertEqual(len(result["entries"]), 0)  # None entries becomes empty list

        # Reset entries for subsequent tests
        self.mock_schedule.entries = self.mock_entries

    def test_serialize_schedule(self):
        """Test serializing a schedule using the ScheduleSerializer class"""
        # Test case 1: Regular schedule
        result = self.serializer.serialize_schedule(self.mock_schedule)

        # Verify the result is a string containing valid JSON
        self.assertIsInstance(result, str)
        schedule_dict = json.loads(result)

        # Verify schedule metadata
        self.assertEqual(schedule_dict["schedule_id"], self.mock_schedule.id)
        self.assertEqual(schedule_dict["version"], self.mock_schedule.version)
        self.assertEqual(schedule_dict["status"], self.mock_schedule.status)

        # Verify entries are included
        self.assertEqual(len(schedule_dict["entries"]), 3)

        # Test case 2: Schedule without entries
        self.mock_schedule.entries = []
        result = self.serializer.serialize_schedule(self.mock_schedule)
        schedule_dict = json.loads(result)

        # Verify entries array is empty
        self.assertEqual(len(schedule_dict["entries"]), 0)

        # Reset entries for subsequent tests
        self.mock_schedule.entries = self.mock_entries

    def test_deserialize_schedule(self):
        """Test deserializing a schedule from JSON"""
        # Create a schedule JSON string
        schedule_dict = {
            "schedule_id": 1,
            "version": 1,
            "status": "DRAFT",
            "start_date": "2023-03-01",
            "end_date": "2023-03-31",
            "entries": [
                {
                    "id": 1,
                    "employee_id": 1,
                    "employee_name": "Employee1 Test",
                    "shift_id": 1,
                    "shift_name": "Shift 1",
                    "shift_start_time": "08:00",
                    "shift_end_time": "14:00",
                    "date": "2023-03-01",
                },
                {
                    "id": 2,
                    "employee_id": 2,
                    "employee_name": "Employee2 Test",
                    "shift_id": 2,
                    "shift_name": "Shift 2",
                    "shift_start_time": "14:00",
                    "shift_end_time": "20:00",
                    "date": "2023-03-02",
                },
            ],
        }
        schedule_json = json.dumps(schedule_dict)

        # Test deserializing
        with patch(
            "services.scheduler.serialization.ScheduleContainer"
        ) as mock_container:
            # Configure the mock to return a proper container instance
            container_instance = MagicMock()
            mock_container.return_value = container_instance

            self.serializer.deserialize_schedule(schedule_json)

            # Verify ScheduleContainer was created with correct parameters
            mock_container.assert_called_once()
            container_instance.entries.append.assert_called()

            # Verify it was called twice (once for each entry)
            self.assertEqual(container_instance.entries.append.call_count, 2)

    def test_deserialize_entry(self):
        """Test deserializing an entry from JSON"""
        # Create an entry JSON string
        entry_dict = {
            "id": 1,
            "employee_id": 1,
            "employee_name": "Employee1 Test",
            "shift_id": 1,
            "shift_name": "Shift 1",
            "shift_start_time": "08:00",
            "shift_end_time": "14:00",
            "date": "2023-03-01",
        }
        entry_json = json.dumps(entry_dict)

        # Test deserializing
        entry = self.serializer.deserialize_entry(entry_json)

        # Verify entry data
        self.assertEqual(entry.id, entry_dict["id"])
        self.assertEqual(entry.employee_id, entry_dict["employee_id"])

        # We need to check if the serializer is parsing the employee name
        if hasattr(entry, "employee_first_name"):
            # If the serializer parses the full name into first and last
            self.assertEqual(entry.employee_first_name, "Employee1")
            self.assertEqual(entry.employee_last_name, "Test")
        else:
            # If the serializer keeps the full name as one field
            self.assertEqual(entry.employee_name, entry_dict["employee_name"])

        self.assertEqual(entry.shift_id, entry_dict["shift_id"])
        self.assertEqual(entry.shift_name, entry_dict["shift_name"])
        self.assertEqual(entry.shift_start_time, entry_dict["shift_start_time"])
        self.assertEqual(entry.shift_end_time, entry_dict["shift_end_time"])

        # Check if date is properly parsed to a date object
        if isinstance(entry.date, date):
            self.assertEqual(entry.date, date.fromisoformat(entry_dict["date"]))
        else:
            # If not parsed to a date object, keep as string
            self.assertEqual(entry.date, entry_dict["date"])

    def test_format_date(self):
        """Test date formatting utility method"""
        # Test case 1: Valid date object
        test_date = date(2023, 3, 15)
        result = self.serializer.format_date(test_date)
        self.assertEqual(result, "2023-03-15")

        # Test case 2: None value
        result = self.serializer.format_date(None)
        self.assertIsNone(result)

        # Test case 3: Date string
        result = self.serializer.format_date("2023-03-15")
        self.assertEqual(result, "2023-03-15")

    def test_parse_date(self):
        """Test date parsing utility method"""
        # Test case 1: Valid date string
        result = self.serializer.parse_date("2023-03-15")
        self.assertEqual(result, date(2023, 3, 15))

        # Test case 2: None value
        result = self.serializer.parse_date(None)
        self.assertIsNone(result)

        # Test case 3: Date object
        test_date = date(2023, 3, 15)
        result = self.serializer.parse_date(test_date)
        self.assertEqual(result, test_date)

        # Test case 4: Invalid date string
        with self.assertRaises(ValueError):
            self.serializer.parse_date("not-a-date")


if __name__ == "__main__":
    unittest.main()
