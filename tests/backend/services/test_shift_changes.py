"""
Tests for Shift Changes MCP Tools
"""

from datetime import date, timedelta

import pytest

from src.backend.models import (
    Employee,
    EmployeeGroup,
    Schedule,
    ScheduleStatus,
    Settings,
    db,
)
from src.backend.services.mcp_tools.shift_changes import ShiftChangesTools


@pytest.fixture
def shift_changes_tools(app):
    """Create ShiftChangesTools instance with app context"""
    return ShiftChangesTools(app)


@pytest.fixture
def sample_employees(app):
    """Create sample employees"""
    with app.app_context():
        emp1 = Employee(
            first_name="John",
            last_name="Doe",
            employee_group=EmployeeGroup.VZ,
            contracted_hours=40,
            is_keyholder=True,
        )
        emp2 = Employee(
            first_name="Jane",
            last_name="Smith",
            employee_group=EmployeeGroup.TZ,
            contracted_hours=20,
            is_keyholder=False,
        )
        db.session.add(emp1)
        db.session.add(emp2)
        db.session.commit()
        yield {"emp1": emp1, "emp2": emp2}


@pytest.fixture
def sample_schedule(app, sample_employees):
    """Create sample schedule entries"""
    with app.app_context():
        Settings.get_or_create_default()  # Ensure settings exist

        shift = Schedule(
            employee_id=sample_employees["emp1"].id,
            shift_id=1,
            date=date.today(),
            shift_start="09:00",
            shift_end="17:00",
            version=1,
            status=ScheduleStatus.PUBLISHED,
        )
        db.session.add(shift)
        db.session.commit()
        yield shift


class TestShiftChangesTools:
    """Test suite for Shift Changes MCP Tools"""

    @pytest.mark.asyncio
    async def test_modify_shift_time(
        self, app, shift_changes_tools, sample_schedule, sample_employees
    ):
        """Test modifying shift times"""
        with app.app_context():
            change_data = {
                "shift_start": "10:00",
                "shift_end": "18:00",
            }

            result = await shift_changes_tools._modify_shift(
                sample_schedule.id,
                change_data,
                validate_conflicts=False,
                notify_employee=False,
                reason="Schedule adjustment",
                dry_run=False,
            )

            assert result["status"] == "success"
            assert result["operation"] == "modify"
            assert result["modified"]["shift_start"] == "10:00"
            assert result["modified"]["shift_end"] == "18:00"

            # Verify shift was actually updated
            shift = db.session.get(Schedule, sample_schedule.id)
            assert shift.shift_start == "10:00"
            assert shift.shift_end == "18:00"

    @pytest.mark.asyncio
    async def test_modify_shift_employee(
        self, app, shift_changes_tools, sample_schedule, sample_employees
    ):
        """Test changing employee for a shift"""
        with app.app_context():
            change_data = {
                "employee_id": sample_employees["emp2"].id,
            }

            result = await shift_changes_tools._modify_shift(
                sample_schedule.id,
                change_data,
                validate_conflicts=False,
                notify_employee=False,
                reason="Employee swap",
                dry_run=False,
            )

            assert result["status"] == "success"
            assert (
                result["modified"]["employee_id"] == sample_employees["emp2"].id
            )

            # Verify shift was actually updated
            shift = db.session.get(Schedule, sample_schedule.id)
            assert shift.employee_id == sample_employees["emp2"].id

    @pytest.mark.asyncio
    async def test_modify_shift_dry_run(
        self, app, shift_changes_tools, sample_schedule
    ):
        """Test modify shift with dry_run=True"""
        with app.app_context():
            original_start = sample_schedule.shift_start

            change_data = {
                "shift_start": "11:00",
            }

            result = await shift_changes_tools._modify_shift(
                sample_schedule.id,
                change_data,
                validate_conflicts=False,
                notify_employee=False,
                reason="Test",
                dry_run=True,
            )

            assert result["status"] == "success"
            assert result["dry_run"] is True

            # Verify shift was NOT updated
            shift = db.session.get(Schedule, sample_schedule.id)
            assert shift.shift_start == original_start

    @pytest.mark.asyncio
    async def test_modify_shift_with_reason(
        self, app, shift_changes_tools, sample_schedule
    ):
        """Test that reason is added to shift notes"""
        with app.app_context():
            change_data = {"shift_start": "10:00"}

            await shift_changes_tools._modify_shift(
                sample_schedule.id,
                change_data,
                validate_conflicts=False,
                notify_employee=False,
                reason="Emergency schedule change",
                dry_run=False,
            )

            # Verify reason was added to notes
            shift = db.session.get(Schedule, sample_schedule.id)
            assert "Emergency schedule change" in shift.notes

    @pytest.mark.asyncio
    async def test_swap_shifts(
        self, app, shift_changes_tools, sample_schedule, sample_employees
    ):
        """Test swapping shifts between employees"""
        with app.app_context():
            # Create second shift
            shift2 = Schedule(
                employee_id=sample_employees["emp2"].id,
                shift_id=1,
                date=date.today() + timedelta(days=1),
                shift_start="09:00",
                shift_end="17:00",
                version=1,
                status=ScheduleStatus.PUBLISHED,
            )
            db.session.add(shift2)
            db.session.commit()

            change_data = {
                "shift_id_1": sample_schedule.id,
                "shift_id_2": shift2.id,
            }

            result = await shift_changes_tools._swap_shifts(
                change_data,
                validate_conflicts=False,
                notify_employee=False,
                reason="Employee request",
                dry_run=False,
            )

            assert result["status"] == "success"
            assert result["operation"] == "swap"
            assert (
                result["shift_1"]["original_employee"]
                == sample_employees["emp1"].id
            )
            assert (
                result["shift_1"]["new_employee"] == sample_employees["emp2"].id
            )
            assert (
                result["shift_2"]["original_employee"]
                == sample_employees["emp2"].id
            )
            assert (
                result["shift_2"]["new_employee"] == sample_employees["emp1"].id
            )

            # Verify swaps in database
            shift1 = db.session.get(Schedule, sample_schedule.id)
            shift2 = db.session.get(Schedule, shift2.id)
            assert shift1.employee_id == sample_employees["emp2"].id
            assert shift2.employee_id == sample_employees["emp1"].id

    @pytest.mark.asyncio
    async def test_swap_shifts_dry_run(
        self, app, shift_changes_tools, sample_schedule, sample_employees
    ):
        """Test swap shifts with dry_run=True"""
        with app.app_context():
            # Create second shift
            shift2 = Schedule(
                employee_id=sample_employees["emp2"].id,
                shift_id=1,
                date=date.today() + timedelta(days=1),
                shift_start="09:00",
                shift_end="17:00",
                version=1,
                status=ScheduleStatus.PUBLISHED,
            )
            db.session.add(shift2)
            db.session.commit()

            original_emp1 = sample_schedule.employee_id
            original_emp2 = shift2.employee_id

            change_data = {
                "shift_id_1": sample_schedule.id,
                "shift_id_2": shift2.id,
            }

            result = await shift_changes_tools._swap_shifts(
                change_data,
                validate_conflicts=False,
                notify_employee=False,
                reason="Test",
                dry_run=True,
            )

            assert result["status"] == "success"
            assert result["dry_run"] is True

            # Verify shifts were NOT swapped
            shift1 = db.session.get(Schedule, sample_schedule.id)
            shift2_check = db.session.get(Schedule, shift2.id)
            assert shift1.employee_id == original_emp1
            assert shift2_check.employee_id == original_emp2

    @pytest.mark.asyncio
    async def test_cancel_shift(self, app, shift_changes_tools, sample_schedule):
        """Test canceling a shift"""
        with app.app_context():
            result = await shift_changes_tools._cancel_shift(
                sample_schedule.id,
                notify_employee=False,
                reason="Store closure",
                dry_run=False,
            )

            assert result["status"] == "success"
            assert result["operation"] == "cancel"
            assert result["reason"] == "Store closure"

            # Verify shift was marked as cancelled (archived)
            shift = db.session.get(Schedule, sample_schedule.id)
            assert shift.status == ScheduleStatus.ARCHIVED
            assert "Store closure" in shift.notes

    @pytest.mark.asyncio
    async def test_cancel_shift_dry_run(
        self, app, shift_changes_tools, sample_schedule
    ):
        """Test cancel shift with dry_run=True"""
        with app.app_context():
            original_status = sample_schedule.status

            result = await shift_changes_tools._cancel_shift(
                sample_schedule.id,
                notify_employee=False,
                reason="Test",
                dry_run=True,
            )

            assert result["status"] == "success"
            assert result["dry_run"] is True

            # Verify shift was NOT cancelled
            shift = db.session.get(Schedule, sample_schedule.id)
            assert shift.status == original_status

    @pytest.mark.asyncio
    async def test_validate_shift_change(
        self, app, shift_changes_tools, sample_schedule
    ):
        """Test validating a proposed shift change"""
        with app.app_context():
            change_data = {
                "shift_start": "10:00",
                "shift_end": "18:00",
            }

            result = await shift_changes_tools._validate_shift_change(
                sample_schedule.id, change_data
            )

            assert result["operation"] == "validate"
            assert result["shift_id"] == sample_schedule.id
            assert "conflicts" in result
            assert "availability_issues" in result
            assert "can_proceed" in result

    @pytest.mark.asyncio
    async def test_check_shift_conflicts_time_overlap(
        self, app, shift_changes_tools, sample_schedule, sample_employees
    ):
        """Test conflict detection for overlapping shifts"""
        with app.app_context():
            # Create overlapping shift
            overlapping_shift = Schedule(
                employee_id=sample_employees["emp1"].id,
                shift_id=1,
                date=date.today(),
                shift_start="16:00",
                shift_end="20:00",
                version=1,
                status=ScheduleStatus.PUBLISHED,
            )
            db.session.add(overlapping_shift)
            db.session.commit()

            # Check for conflicts
            conflicts = await shift_changes_tools._check_shift_conflicts(
                sample_employees["emp1"].id,
                date.today(),
                "15:00",  # Overlaps with existing 16:00-20:00
                "19:00",
                exclude_shift_id=sample_schedule.id,
            )

            assert len(conflicts) > 0
            assert conflicts[0]["type"] == "time_overlap"

    @pytest.mark.asyncio
    async def test_times_overlap_detection(self, app, shift_changes_tools):
        """Test times_overlap helper method"""
        with app.app_context():
            # Test overlapping times
            assert shift_changes_tools._times_overlap(
                "09:00", "17:00", "16:00", "20:00"
            )
            assert shift_changes_tools._times_overlap(
                "09:00", "17:00", "08:00", "10:00"
            )

            # Test non-overlapping times
            assert not shift_changes_tools._times_overlap(
                "09:00", "17:00", "17:00", "20:00"
            )
            assert not shift_changes_tools._times_overlap(
                "09:00", "17:00", "07:00", "09:00"
            )

    @pytest.mark.asyncio
    async def test_calculate_hours_between(self, app, shift_changes_tools):
        """Test calculate_hours_between helper method"""
        with app.app_context():
            # Test same day
            hours = shift_changes_tools._calculate_hours_between("17:00", "09:00")
            assert hours == 16.0

            # Test overnight
            hours = shift_changes_tools._calculate_hours_between("20:00", "06:00")
            assert hours == 10.0

    @pytest.mark.asyncio
    async def test_modify_shift_not_found(self, app, shift_changes_tools):
        """Test modifying a non-existent shift"""
        with app.app_context():
            result = await shift_changes_tools._modify_shift(
                99999,  # Non-existent ID
                {"shift_start": "10:00"},
                validate_conflicts=False,
                notify_employee=False,
                reason="Test",
                dry_run=False,
            )

            assert "error" in result
            assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_get_tool_info(self, app, shift_changes_tools):
        """Test get_tool_info method"""
        with app.app_context():
            info = shift_changes_tools.get_tool_info()

            assert info["category"] == "shift_changes"
            assert "tools" in info
            assert len(info["tools"]) == 1

            tool = info["tools"][0]
            assert tool["name"] == "manage_shift_changes"
            assert "operations" in tool
            assert "modify" in tool["operations"]
            assert "swap" in tool["operations"]
            assert "cancel" in tool["operations"]
