import pytest
from unittest.mock import patch, MagicMock
from datetime import date
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from services.scheduler.resources import ScheduleResources
from models.employee import AvailabilityType, EmployeeGroup


@pytest.fixture
def resources_fixture():
    resources = ScheduleResources()
    mock_settings = MagicMock()
    mock_settings.id = 1
    mock_settings.company_name = "Test Company"

    # mock_employees must be non-empty for is_loaded() to return True
    mock_employees = []
    for i in range(3):
        employee = MagicMock()
        employee.id = i + 1
        employee.first_name = f"Employee{i + 1}"
        employee.last_name = "Test"
        employee.employee_group = (
            EmployeeGroup.VZ
            if i == 0
            else (EmployeeGroup.TZ if i == 1 else EmployeeGroup.GFB)
        )
        employee.is_keyholder = i == 0
        mock_employees.append(employee)

    mock_shifts = []
    for i in range(3):
        shift = MagicMock()
        shift.id = i + 1
        shift.name = f"Shift {i + 1}"
        shift.start_time = "08:00" if i == 0 else "14:00" if i == 1 else "20:00"
        shift.end_time = "14:00" if i == 0 else "20:00" if i == 1 else "02:00"
        shift.duration_hours = 6.0
        mock_shifts.append(shift)

    mock_absences = []
    for i in range(2):
        absence = MagicMock()
        absence.id = i + 1
        absence.employee_id = i + 1
        absence.start_date = date(2023, 3, 1)
        absence.end_date = date(2023, 3, 5)
        absence.reason = "Vacation" if i == 0 else "Sick"
        mock_absences.append(absence)

    mock_availabilities = []
    for emp_id in range(1, 4):
        for day in range(7):
            avail = MagicMock()
            avail.id = len(mock_availabilities) + 1
            avail.employee_id = emp_id
            avail.day_of_week = day
            avail.hour = 12
            avail.is_available = True
            avail.availability_type = AvailabilityType.AVAILABLE
            mock_availabilities.append(avail)

    mock_coverage = []
    for day in range(5):
        coverage = MagicMock()
        coverage.id = day + 1
        coverage.day_of_week = day
        coverage.shift_type = "DAY"
        coverage.min_employees = 2
        mock_coverage.append(coverage)

    mock_schedules = []
    for i in range(3):
        schedule = MagicMock()
        schedule.id = i + 1
        schedule.employee_id = (i % 3) + 1
        schedule.shift_id = (i % 3) + 1
        schedule.date = date(2023, 3, i + 1)
        mock_schedules.append(schedule)

    return {
        "resources": resources,
        "mock_settings": mock_settings,
        "mock_employees": mock_employees,
        "mock_shifts": mock_shifts,
        "mock_absences": mock_absences,
        "mock_availabilities": mock_availabilities,
        "mock_coverage": mock_coverage,
        "mock_schedules": mock_schedules,
    }


@patch("services.scheduler.resources.Settings")
@patch("services.scheduler.resources.Employee")
@patch("services.scheduler.resources.ShiftTemplate")
@patch("services.scheduler.resources.Coverage")
@patch("services.scheduler.resources.Absence")
@patch("services.scheduler.resources.EmployeeAvailability")
@patch("services.scheduler.resources.Schedule")
@patch("services.scheduler.resources.db")
def test_load_resources_success(
    mock_db,
    mock_Schedule,
    mock_EmployeeAvailability,
    mock_Absence,
    mock_Coverage,
    mock_ShiftTemplate,
    mock_Employee,
    mock_Settings,
    resources_fixture,
    app,
):
    resources = resources_fixture["resources"]
    mock_settings = resources_fixture["mock_settings"]
    mock_employees = resources_fixture["mock_employees"]
    mock_shifts = resources_fixture["mock_shifts"]
    mock_coverage = resources_fixture["mock_coverage"]
    mock_absences = resources_fixture["mock_absences"]
    mock_availabilities = resources_fixture["mock_availabilities"]

    mock_Settings.query.first.return_value = mock_settings
    mock_Employee.query.filter_by.return_value.all.return_value = mock_employees
    mock_ShiftTemplate.query.all.return_value = mock_shifts
    mock_Coverage.query.all.return_value = mock_coverage
    mock_Absence.query.all.return_value = mock_absences
    mock_EmployeeAvailability.query.all.return_value = mock_availabilities

    with app.app_context():
        resources.load()
    assert resources.is_loaded()
    assert resources.settings == mock_settings
    assert resources.employees == mock_employees
    assert resources.shifts == mock_shifts
    assert resources.coverage == mock_coverage
    assert resources.absences == mock_absences
    assert resources.availabilities == mock_availabilities


@patch("services.scheduler.resources.Settings")
@patch("services.scheduler.resources.db")
def test_load_settings_creates_default(mock_db, mock_Settings, resources_fixture):
    resources = resources_fixture["resources"]
    mock_Settings.query.first.return_value = None
    mock_session = MagicMock()
    mock_db.session = mock_session
    result = resources._load_settings()
    assert result is not None
    mock_Settings.assert_called_once()
    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()


@patch("services.scheduler.resources.Employee")
def test_load_employees_filters_active(mock_Employee, resources_fixture):
    resources = resources_fixture["resources"]
    resources._load_employees()
    mock_Employee.query.filter_by.assert_called_once_with(is_active=True)


@patch("services.scheduler.resources.Coverage")
def test_load_coverage(mock_Coverage, resources_fixture):
    resources = resources_fixture["resources"]
    mock_coverage = resources_fixture["mock_coverage"]
    mock_Coverage.query.all.return_value = mock_coverage
    result = resources._load_coverage()
    mock_Coverage.query.all.assert_called_once()
    assert result == mock_coverage


@patch("services.scheduler.resources.ShiftTemplate")
def test_load_shifts(mock_ShiftTemplate, resources_fixture):
    resources = resources_fixture["resources"]
    mock_shifts = resources_fixture["mock_shifts"]
    mock_ShiftTemplate.query.all.return_value = mock_shifts
    result = resources._load_shifts()
    mock_ShiftTemplate.query.all.assert_called_once()
    assert result == mock_shifts


@patch("services.scheduler.resources.Absence")
def test_load_absences(mock_Absence, resources_fixture):
    resources = resources_fixture["resources"]
    mock_absences = resources_fixture["mock_absences"]
    mock_Absence.query.all.return_value = mock_absences
    result = resources._load_absences()
    mock_Absence.query.all.assert_called_once()
    assert result == mock_absences
