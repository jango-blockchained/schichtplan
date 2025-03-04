import pytest
from datetime import date, timedelta
from models import Employee, ShiftTemplate, Coverage, db
from models.employee import EmployeeGroup
from models.fixed_shift import ShiftType
from services.schedule_generator import ScheduleGenerator
from unittest.mock import patch
from flask import Flask
from models.employee import AvailabilityType, EmployeeAvailability


@pytest.fixture
def app():
    """Create a Flask app for testing"""
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)
    return app


@pytest.fixture
def app_context(app):
    """Create an application context for testing"""
    with app.app_context():
        db.create_all()
        yield
        db.drop_all()


@pytest.fixture
def schedule_generator():
    """Create a schedule generator instance for testing"""
    return ScheduleGenerator()


@pytest.fixture
def mock_employee_query(app_context):
    """Mock Employee.query to avoid database access"""
    with patch("models.employee.Employee.query") as mock:
        mock.filter_by.return_value.first.return_value = None
        mock.filter_by.return_value.all.return_value = []
        yield mock


@pytest.fixture
def mock_schedule_query(app_context):
    """Mock Schedule.query to avoid database access"""
    with patch("models.Schedule.query") as mock:
        mock.filter_by.return_value.first.return_value = None
        mock.filter_by.return_value.all.return_value = []
        mock.order_by.return_value.all.return_value = []
        yield mock


@pytest.fixture
def test_employees(mock_employee_query):
    """Create test employees"""
    return [
        Employee(
            first_name="TEST1",
            last_name="KEYHOLDER",
            employee_group=EmployeeGroup.TL,
            contracted_hours=40,
            is_keyholder=True,
            is_active=True,
            employee_id="TK1",  # Provide explicit employee_id to avoid query
        ),
        Employee(
            first_name="TEST2",
            last_name="REGULAR",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40,
            is_keyholder=False,
            is_active=True,
            employee_id="TR1",
        ),
        Employee(
            first_name="TEST3",
            last_name="PARTTIME",
            employee_group=EmployeeGroup.TZ,
            contracted_hours=20,
            is_keyholder=False,
            is_active=True,
            employee_id="TP1",
        ),
    ]


@pytest.fixture
def test_shifts():
    # Create test shifts
    morning_shift = ShiftTemplate(
        start_time="08:00",
        end_time="16:00",
        min_employees=2,
        max_employees=4,
        requires_break=True,
        shift_type=ShiftType.EARLY,
    )

    evening_shift = ShiftTemplate(
        start_time="16:00",
        end_time="00:00",
        min_employees=2,
        max_employees=4,
        requires_break=True,
        shift_type=ShiftType.LATE,
    )

    overnight_shift = ShiftTemplate(
        start_time="22:00",
        end_time="06:00",
        min_employees=1,
        max_employees=2,
        requires_break=True,
        shift_type=ShiftType.LATE,
    )

    return [morning_shift, evening_shift, overnight_shift]


@pytest.fixture
def test_coverage():
    """Create test coverage requirements"""
    return [
        Coverage(
            day_index=0,  # Monday
            start_time="09:00",
            end_time="17:00",
            min_employees=1,
            max_employees=2,
            requires_keyholder=False,
            shift_id=1,
            employee_types=[],
        ),
        Coverage(
            day_index=0,  # Monday
            start_time="06:00",
            end_time="14:00",
            min_employees=1,
            max_employees=1,
            requires_keyholder=True,
            shift_id=2,
            employee_types=[],
        ),
        Coverage(
            day_index=0,  # Monday
            start_time="14:00",
            end_time="22:00",
            min_employees=1,
            max_employees=1,
            requires_keyholder=True,
            shift_id=3,
            employee_types=[],
        ),
    ]


def test_schedule_generator_initialization(schedule_generator):
    """Test schedule generator initialization"""
    assert schedule_generator is not None
    assert schedule_generator.resources is not None
    assert schedule_generator.schedule_cache == {}
    assert schedule_generator.generation_errors == []


def test_calculate_duration(schedule_generator):
    """Test duration calculation between time points"""
    # Test normal duration
    assert schedule_generator._calculate_duration("09:00", "17:00") == 8.0

    # Test overnight duration
    assert schedule_generator._calculate_duration("22:00", "06:00") == 8.0

    # Test same time (0 duration)
    assert schedule_generator._calculate_duration("09:00", "09:00") == 0.0

    # Test None values
    assert schedule_generator._calculate_duration(None, "17:00") == 0.0
    assert schedule_generator._calculate_duration("09:00", None) == 0.0
    assert schedule_generator._calculate_duration(None, None) == 0.0


def test_shifts_overlap(test_shifts):
    """Test that overlapping shifts are correctly identified"""
    morning_shift = test_shifts[0]  # 08:00-16:00
    evening_shift = test_shifts[1]  # 16:00-00:00
    overnight_shift = test_shifts[2]  # 22:00-06:00

    # Test non-overlapping shifts
    assert not ScheduleGenerator._shifts_overlap(
        morning_shift.start_time,
        morning_shift.end_time,
        evening_shift.start_time,
        evening_shift.end_time,
    )

    # Test overlapping shifts (overnight shift overlaps with morning shift)
    assert ScheduleGenerator._shifts_overlap(
        overnight_shift.start_time,
        overnight_shift.end_time,
        morning_shift.start_time,
        morning_shift.end_time,
    )

    # Test overlapping shifts (overnight shift overlaps with evening shift)
    assert ScheduleGenerator._shifts_overlap(
        overnight_shift.start_time,
        overnight_shift.end_time,
        evening_shift.start_time,
        evening_shift.end_time,
    )


def test_has_valid_duration(schedule_generator, test_shifts):
    """Test shift duration validation"""
    # Test valid duration
    valid_shift = test_shifts[0]  # 8 hours duration
    assert schedule_generator._has_valid_duration(valid_shift) is True

    # Test invalid duration
    invalid_shift = ShiftTemplate(
        start_time="09:00",
        end_time="09:00",
        min_employees=1,
        max_employees=1,
        requires_break=False,
        shift_type=ShiftType.MIDDLE,
    )
    assert schedule_generator._has_valid_duration(invalid_shift) is False


def test_get_available_employees(
    app_context,
    mock_schedule_query,
    schedule_generator,
    test_employees,
    test_shifts,
    test_coverage,
):
    """Test getting available employees for a time slot"""
    # Setup test data
    schedule_generator.resources.employees = test_employees
    schedule_generator.resources.shifts = test_shifts
    schedule_generator.resources.coverage_data = test_coverage
    schedule_generator.resources.availability_data = []
    schedule_generator.resources.absence_data = []

    test_date = date.today()

    # Mock the Absence.query.filter_by().first() call to return None
    with patch("models.Absence.query") as mock_absence_query:
        mock_absence_query.filter_by.return_value.first.return_value = None

        # Mock the Schedule.query.filter_by().first() call to return None
        with patch("models.Schedule.query") as mock_schedule_query:
            mock_schedule_query.filter_by.return_value.first.return_value = None

            # Test normal time slot
            available = schedule_generator._get_available_employees(
                test_date, "09:00", "17:00"
            )
            assert len(available) > 0

            # Test with all employees unavailable
            mock_absence_query.filter_by.return_value.first.return_value = (
                EmployeeAvailability(
                    employee_id=test_employees[0].id,
                    start_date=test_date,
                    end_date=test_date,
                    availability_type=AvailabilityType.UNAVAILABLE,
                )
            )
            available = schedule_generator._get_available_employees(
                test_date, "09:00", "17:00"
            )
            assert len(available) == 0


def test_is_employee_absent(app_context, schedule_generator, test_employees):
    """Test employee absence checking"""
    employee = test_employees[0]
    test_date = date.today()

    # Mock the Absence.query.filter_by().first() call to return None
    with patch("models.Absence.query") as mock_query:
        mock_query.filter_by.return_value.first.return_value = None

        # Test with no absences
        schedule_generator.resources.availability_data = []
        schedule_generator.resources.absence_data = []
        assert (
            schedule_generator._is_employee_absent(
                employee, test_date, schedule_generator.resources
            )
            is False
        )

        # Test with absence
        mock_query.filter_by.return_value.first.return_value = EmployeeAvailability(
            employee_id=employee.id,
            start_date=test_date,
            end_date=test_date,
            availability_type=AvailabilityType.UNAVAILABLE,
        )
        assert (
            schedule_generator._is_employee_absent(
                employee, test_date, schedule_generator.resources
            )
            is True
        )


def test_generate_schedule(
    app_context,
    mock_schedule_query,
    schedule_generator,
    test_employees,
    test_shifts,
    test_coverage,
):
    """Test schedule generation"""
    # Setup test data
    schedule_generator.resources.employees = test_employees
    schedule_generator.resources.shifts = test_shifts
    schedule_generator.resources.coverage_data = test_coverage
    schedule_generator.resources.availability_data = []
    schedule_generator.resources.absence_data = []

    # Ensure employees are active
    for employee in test_employees:
        employee.is_active = True

    # Mock the Absence.query.filter_by().first() call to return None
    with patch("models.Absence.query") as mock_absence_query:
        mock_absence_query.filter_by.return_value.first.return_value = None

        # Mock the Schedule.query.filter_by().first() call to return None
        with patch("models.Schedule.query") as mock_schedule_query:
            mock_schedule_query.filter_by.return_value.first.return_value = None

            # Mock the Settings.query.first() call to return a default settings object
            with patch("models.Settings.query") as mock_settings_query:
                mock_settings_query.first.return_value = None

                # Test schedule generation for a single day
                test_date = date.today()
                result = schedule_generator.generate_schedule(test_date, test_date)

                assert "schedule" in result
                assert len(result["schedule"]) > 0


def test_verify_goals(
    app_context,
    mock_schedule_query,
    schedule_generator,
    test_employees,
    test_shifts,
    test_coverage,
):
    """Test goal verification"""
    # Setup test data
    schedule_generator.resources.employees = test_employees
    schedule_generator.resources.shifts = test_shifts
    schedule_generator.resources.coverage_data = test_coverage
    schedule_generator.resources.availability_data = {}

    # Test verification with no schedule
    schedule_generator.verify_goals()
    assert len(schedule_generator.generation_errors) > 0


def test_error_handling(schedule_generator):
    """Test error handling in various scenarios"""
    # Test invalid date range
    result = schedule_generator.generate_schedule(
        date.today() + timedelta(days=1), date.today()
    )
    assert "error" in result
    assert "Start date must be before end date" in result["error"]

    # Test missing resources
    schedule_generator.resources = None
    result = schedule_generator.generate_schedule(date.today(), date.today())
    assert "error" in result
