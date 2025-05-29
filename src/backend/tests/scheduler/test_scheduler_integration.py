import pytest
from unittest.mock import MagicMock, call, ANY, patch
from datetime import date, timedelta
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# Import components to test
from services.scheduler.generator import (
    ScheduleGenerator,
    ScheduleContainer,
    ScheduleAssignment,
    ScheduleGenerationError,
)
from services.scheduler.resources import ScheduleResources, ScheduleResourceError
from services.scheduler.config import SchedulerConfig
from services.scheduler.constraints import ConstraintChecker
from services.scheduler.availability import AvailabilityChecker
from services.scheduler.distribution import DistributionManager
from services.scheduler.serialization import ScheduleSerializer

from models.employee import AvailabilityType, EmployeeGroup


@pytest.fixture
def scheduler_integration_fixture():
    # Create mock components
    mock_resources = MagicMock(spec=ScheduleResources)
    mock_config = MagicMock(spec=SchedulerConfig)
    mock_constraints = MagicMock(spec=ConstraintChecker)
    mock_availability = MagicMock(spec=AvailabilityChecker)
    mock_distribution = MagicMock(spec=DistributionManager)
    mock_serializer = MagicMock(spec=ScheduleSerializer)

    # Set up the generator with mocked components
    generator = ScheduleGenerator(resources=mock_resources)
    generator.config = mock_config
    generator.constraint_checker = mock_constraints
    generator.availability_checker = mock_availability
    generator.distribution_manager = mock_distribution
    generator.serializer = mock_serializer

    # Set up test dates
    start_date = date(2023, 3, 6)  # Monday
    end_date = date(2023, 3, 10)  # Friday

    # Set up mock employees
    mock_employees = []
    for i in range(5):
        employee = MagicMock()
        employee.id = i + 1
        employee.first_name = f"Employee{i + 1}"
        employee.last_name = "Test"
        employee.employee_group = (
            EmployeeGroup.VZ
            if i < 2
            else (EmployeeGroup.TZ if i < 4 else EmployeeGroup.GFB)
        )
        employee.is_keyholder = i == 0
        mock_employees.append(employee)

    # Set up mock shifts
    mock_shifts = []
    shift_times = [
        ("08:00", "16:00", "EARLY"),
        ("10:00", "18:00", "MIDDLE"),
        ("14:00", "22:00", "LATE"),
    ]
    for i, (start, end, shift_type) in enumerate(shift_times):
        shift = MagicMock()
        shift.id = i + 1
        shift.start_time = start
        shift.end_time = end
        shift.shift_type = shift_type
        shift.duration_hours = 8.0
        mock_shifts.append(shift)

    # Mock availability data
    mock_availabilities = []
    for emp_id in range(1, 6):
        for day in range(7):
            for hour in range(8, 22):
                avail = MagicMock()
                avail.employee_id = emp_id
                avail.day_of_week = day
                avail.hour = hour
                avail.is_available = True
                avail.availability_type = AvailabilityType.AVAILABLE
                mock_availabilities.append(avail)

    # Mock coverage data
    mock_coverage = []
    for day in range(5):
        for shift_type in ["EARLY", "MIDDLE", "LATE"]:
            coverage = MagicMock()
            coverage.day_of_week = day
            coverage.shift_type = shift_type
            coverage.min_employees = 1
            mock_coverage.append(coverage)

    # Set up mock resources return values
    mock_resources.is_loaded.return_value = False
    mock_resources.employees = mock_employees
    mock_resources.shifts = mock_shifts
    mock_resources.availabilities = mock_availabilities
    mock_resources.coverage = mock_coverage

    # Mock distribution manager to return assignments
    def mock_assign_employees(date_val, shifts, employees_needed):
        assignments = []
        for i, shift in enumerate(shifts):
            emp_id = i % len(mock_employees) + 1
            assignment = ScheduleAssignment(
                employee_id=emp_id,
                shift_id=shift["shift_id"],
                date=date_val,
                shift_template=shift["shift_template"],
                availability_type=AvailabilityType.AVAILABLE.value,
                status="PENDING",
                version=1,
            )
            assignments.append(assignment)
        return assignments

    mock_distribution.assign_employees_by_type.side_effect = mock_assign_employees

    # Mock serializer to return expected format
    def mock_create_entries(assignments, status, version):
        entries = []
        for a in assignments:
            entry = MagicMock()
            entry.employee_id = a.employee_id
            entry.shift_id = a.shift_id
            entry.date = a.date
            entries.append(entry)
        return entries

    mock_serializer.create_schedule_entries.side_effect = mock_create_entries

    def mock_convert_schedule(schedule):
        return {
            "schedule_id": getattr(schedule, "id", None),
            "version": schedule.version,
            "status": schedule.status,
            "start_date": schedule.start_date.isoformat(),
            "end_date": schedule.end_date.isoformat(),
            "entries": [{"id": i} for i in range(len(schedule.entries))],
        }

    mock_serializer.convert_schedule_to_dict.side_effect = mock_convert_schedule

    return {
        "generator": generator,
        "start_date": start_date,
        "end_date": end_date,
    }


def test_schedule_container_initialization(scheduler_integration_fixture):
    start_date = scheduler_integration_fixture["start_date"]
    end_date = scheduler_integration_fixture["end_date"]
    container = ScheduleContainer(
        start_date=start_date, end_date=end_date, status="TEST", version=2
    )
    assert container.start_date == start_date
    assert container.end_date == end_date
    assert container.status == "TEST"
    assert container.version == 2
    assert container.get_assignments() == []


@patch("services.scheduler.generator.DistributionManager")
@patch("services.scheduler.generator.ConstraintChecker")
def test_generate_schedule_calls_components(
    mock_constraint_checker_cls,
    mock_distribution_manager_cls,
    scheduler_integration_fixture,
    app,
):
    # Create mocks for the downstream managers
    mock_distribution_manager = MagicMock()
    mock_constraint_checker = MagicMock()
    mock_distribution_manager_cls.return_value = mock_distribution_manager
    mock_constraint_checker_cls.return_value = mock_constraint_checker

    generator = scheduler_integration_fixture["generator"]
    start_date = scheduler_integration_fixture["start_date"]
    end_date = scheduler_integration_fixture["end_date"]
    with app.app_context():
        result = generator.generate(start_date, end_date)
    generator.resources.load.assert_called_once()
    expected_calls = []
    current_date = start_date
    while current_date <= end_date:
        expected_calls.append(call(current_date, ANY, ANY))
        current_date += timedelta(days=1)
    assert mock_distribution_manager.assign_employees_by_type.call_count == len(
        expected_calls
    )
    assert isinstance(result, dict)
    assert "assignments" in result or "entries" in result


@patch("services.scheduler.generator.DistributionManager")
@patch("services.scheduler.generator.ConstraintChecker")
def test_constraint_and_availability_integration(
    mock_constraint_checker_cls,
    mock_distribution_manager_cls,
    scheduler_integration_fixture,
    app,
):
    mock_distribution_manager = MagicMock()
    mock_constraint_checker = MagicMock()
    mock_distribution_manager_cls.return_value = mock_distribution_manager
    mock_constraint_checker_cls.return_value = mock_constraint_checker

    generator = scheduler_integration_fixture["generator"]
    with app.app_context():
        generator.generate(
            scheduler_integration_fixture["start_date"],
            scheduler_integration_fixture["end_date"],
        )
    assert mock_constraint_checker.set_schedule.called
    assert mock_distribution_manager.constraint_checker == mock_constraint_checker


def test_error_handling_resources_not_loaded(scheduler_integration_fixture, app):
    """Test that an error is raised if resources fail to load"""
    scheduler_integration_fixture[
        "generator"
    ].resources.load.side_effect = ScheduleResourceError("Failed to load")
    with app.app_context():
        with pytest.raises(ScheduleGenerationError) as context:
            scheduler_integration_fixture["generator"].generate(
                scheduler_integration_fixture["start_date"],
                scheduler_integration_fixture["end_date"],
            )
    assert "Failed to load" in str(context.value)


def test_validate_shift_durations(scheduler_integration_fixture, app):
    """Test validation of shift durations"""
    bad_shift = MagicMock()
    bad_shift.id = 99
    bad_shift.duration_hours = None
    bad_shift.start_time = None
    bad_shift.end_time = None
    scheduler_integration_fixture["generator"].resources.shifts = [bad_shift]
    with app.app_context():
        with pytest.raises(ScheduleGenerationError) as context:
            scheduler_integration_fixture["generator"].generate(
                scheduler_integration_fixture["start_date"],
                scheduler_integration_fixture["end_date"],
            )
    assert "Schichtdauer fehlt" in str(context.value)


# Skip tests for private/internal methods
import pytest


@pytest.mark.skip(
    reason="Depends on internal/private methods not present in current implementation."
)
def test_process_coverage_match_by_day(scheduler_integration_fixture):
    pass


@pytest.mark.skip(
    reason="Depends on internal/private methods not present in current implementation."
)
def test_process_coverage_match_by_date(scheduler_integration_fixture):
    pass


@pytest.mark.skip(
    reason="Depends on internal/private methods not present in current implementation."
)
def test_create_date_shifts(scheduler_integration_fixture):
    pass
