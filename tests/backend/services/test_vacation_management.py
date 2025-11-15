"""
Tests for Vacation Management MCP Tools
"""

from datetime import date, timedelta

import pytest

from src.backend.models import (
    Absence,
    Employee,
    EmployeeGroup,
    Schedule,
    ScheduleStatus,
    Settings,
    db,
)
from src.backend.services.mcp_tools.vacation_management import VacationManagementTools


@pytest.fixture
def vacation_tools(app):
    """Create VacationManagementTools instance with app context"""
    return VacationManagementTools(app)


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
def sample_settings(app):
    """Create sample settings"""
    with app.app_context():
        settings = Settings.get_or_create_default()
        yield settings


class TestVacationManagementTools:
    """Test suite for Vacation Management MCP Tools"""

    @pytest.mark.asyncio
    async def test_request_vacation(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test creating a vacation request"""
        with app.app_context():
            vacation_data = {
                "employee_id": sample_employees["emp1"].id,
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
                "note": "Summer vacation",
            }

            result = await vacation_tools._request_vacation(
                vacation_data, check_conflicts=False, dry_run=False
            )

            assert result["status"] == "success"
            assert result["operation"] == "request"
            assert result["vacation"]["days"] == 7
            assert (
                result["vacation"]["employee_id"] == sample_employees["emp1"].id
            )

            # Verify absence was created in database
            absences = Absence.query.filter_by(
                employee_id=sample_employees["emp1"].id
            ).all()
            assert len(absences) == 1
            assert absences[0].start_date == date(2025, 6, 1)
            assert absences[0].end_date == date(2025, 6, 7)

    @pytest.mark.asyncio
    async def test_request_vacation_dry_run(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test vacation request with dry_run=True"""
        with app.app_context():
            vacation_data = {
                "employee_id": sample_employees["emp1"].id,
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
            }

            result = await vacation_tools._request_vacation(
                vacation_data, check_conflicts=False, dry_run=True
            )

            assert result["status"] == "success"
            assert result["dry_run"] is True

            # Verify absence was NOT created
            absences = Absence.query.filter_by(
                employee_id=sample_employees["emp1"].id
            ).all()
            assert len(absences) == 0

    @pytest.mark.asyncio
    async def test_request_vacation_missing_fields(
        self, app, vacation_tools, sample_settings
    ):
        """Test vacation request with missing required fields"""
        with app.app_context():
            vacation_data = {
                "employee_id": 1,
                # Missing start_date and end_date
            }

            result = await vacation_tools._request_vacation(
                vacation_data, check_conflicts=False, dry_run=False
            )

            assert "error" in result
            assert "Missing required fields" in result["error"]

    @pytest.mark.asyncio
    async def test_request_vacation_invalid_date_range(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test vacation request with invalid date range"""
        with app.app_context():
            vacation_data = {
                "employee_id": sample_employees["emp1"].id,
                "start_date": "2025-06-07",
                "end_date": "2025-06-01",  # End before start
            }

            result = await vacation_tools._request_vacation(
                vacation_data, check_conflicts=False, dry_run=False
            )

            assert "error" in result
            assert "must be after" in result["error"]

    @pytest.mark.asyncio
    async def test_approve_vacation(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test approving a vacation request"""
        with app.app_context():
            # Create vacation request
            vacation_data = {
                "employee_id": sample_employees["emp1"].id,
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
            }
            request_result = await vacation_tools._request_vacation(
                vacation_data, check_conflicts=False, dry_run=False
            )

            # Approve the vacation
            approval_data = {"id": request_result["vacation"]["id"]}
            result = await vacation_tools._approve_vacation(
                approval_data, approval_action="Approved by manager", dry_run=False
            )

            assert result["status"] == "success"
            assert result["operation"] == "approve"
            assert result["approval_note"] == "Approved by manager"

            # Verify approval was recorded in notes
            absence = db.session.get(Absence, request_result["vacation"]["id"])
            assert "Approved by manager" in absence.note

    @pytest.mark.asyncio
    async def test_reject_vacation(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test rejecting a vacation request"""
        with app.app_context():
            # Create vacation request
            vacation_data = {
                "employee_id": sample_employees["emp1"].id,
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
            }
            request_result = await vacation_tools._request_vacation(
                vacation_data, check_conflicts=False, dry_run=False
            )

            # Reject the vacation
            rejection_data = {"id": request_result["vacation"]["id"]}
            result = await vacation_tools._reject_vacation(
                rejection_data,
                approval_action="Insufficient coverage",
                dry_run=False,
            )

            assert result["status"] == "success"
            assert result["operation"] == "reject"
            assert result["rejection_reason"] == "Insufficient coverage"

            # Verify absence was deleted
            absence = db.session.get(Absence, request_result["vacation"]["id"])
            assert absence is None

    @pytest.mark.asyncio
    async def test_cancel_vacation(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test canceling an approved vacation"""
        with app.app_context():
            # Create and approve vacation
            vacation_data = {
                "employee_id": sample_employees["emp1"].id,
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
            }
            request_result = await vacation_tools._request_vacation(
                vacation_data, check_conflicts=False, dry_run=False
            )

            # Cancel the vacation
            cancel_data = {"id": request_result["vacation"]["id"]}
            result = await vacation_tools._cancel_vacation(cancel_data, dry_run=False)

            assert result["status"] == "success"
            assert result["operation"] == "cancel"

            # Verify absence was deleted
            absence = db.session.get(Absence, request_result["vacation"]["id"])
            assert absence is None

    @pytest.mark.asyncio
    async def test_list_vacations(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test listing vacations"""
        with app.app_context():
            # Create multiple vacation requests
            vacation1 = {
                "employee_id": sample_employees["emp1"].id,
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
            }
            vacation2 = {
                "employee_id": sample_employees["emp2"].id,
                "start_date": "2025-07-01",
                "end_date": "2025-07-14",
            }

            await vacation_tools._request_vacation(
                vacation1, check_conflicts=False, dry_run=False
            )
            await vacation_tools._request_vacation(
                vacation2, check_conflicts=False, dry_run=False
            )

            # List all vacations
            result = await vacation_tools._list_vacations(None, None)

            assert result["status"] == "success"
            assert result["operation"] == "list"
            assert result["count"] >= 2

    @pytest.mark.asyncio
    async def test_list_vacations_by_employee(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test listing vacations for a specific employee"""
        with app.app_context():
            # Create vacation for emp1
            vacation_data = {
                "employee_id": sample_employees["emp1"].id,
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
            }
            await vacation_tools._request_vacation(
                vacation_data, check_conflicts=False, dry_run=False
            )

            # List vacations for emp1 only
            result = await vacation_tools._list_vacations(
                sample_employees["emp1"].id, None
            )

            assert result["status"] == "success"
            assert result["count"] >= 1
            assert all(
                v["employee_id"] == sample_employees["emp1"].id
                for v in result["vacations"]
            )

    @pytest.mark.asyncio
    async def test_list_vacations_by_date_range(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test listing vacations within a date range"""
        with app.app_context():
            # Create vacation
            vacation_data = {
                "employee_id": sample_employees["emp1"].id,
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
            }
            await vacation_tools._request_vacation(
                vacation_data, check_conflicts=False, dry_run=False
            )

            # List vacations in date range
            date_range = {
                "start_date": "2025-05-01",
                "end_date": "2025-06-30",
            }
            result = await vacation_tools._list_vacations(None, date_range)

            assert result["status"] == "success"
            assert result["count"] >= 1

    @pytest.mark.asyncio
    async def test_check_availability_for_employee(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test checking vacation availability for specific employee"""
        with app.app_context():
            vacation_data = {
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
            }

            result = await vacation_tools._check_vacation_availability(
                vacation_data, sample_employees["emp1"].id
            )

            assert result["status"] == "success"
            assert result["operation"] == "check_availability"
            assert result["employee_id"] == sample_employees["emp1"].id
            assert "available" in result
            assert "conflicts" in result
            assert "coverage_impact" in result

    @pytest.mark.asyncio
    async def test_check_availability_team_wide(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test checking vacation availability for entire team"""
        with app.app_context():
            vacation_data = {
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
            }

            result = await vacation_tools._check_vacation_availability(
                vacation_data, None
            )

            assert result["status"] == "success"
            assert result["operation"] == "check_availability"
            assert "team_availability" in result
            assert "available_employees" in result
            assert "total_employees" in result
            assert result["total_employees"] >= 2

    @pytest.mark.asyncio
    async def test_check_vacation_conflicts_overlapping(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test conflict detection for overlapping vacations"""
        with app.app_context():
            # Create first vacation
            vacation1 = {
                "employee_id": sample_employees["emp1"].id,
                "start_date": "2025-06-01",
                "end_date": "2025-06-07",
            }
            await vacation_tools._request_vacation(
                vacation1, check_conflicts=False, dry_run=False
            )

            # Check for conflicts with overlapping dates
            conflicts = await vacation_tools._check_vacation_conflicts(
                sample_employees["emp1"].id,
                date(2025, 6, 5),  # Overlaps with existing vacation
                date(2025, 6, 10),
            )

            assert len(conflicts) > 0
            assert conflicts[0]["type"] == "existing_vacation"

    @pytest.mark.asyncio
    async def test_check_vacation_conflicts_with_scheduled_shifts(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test conflict detection with scheduled shifts"""
        with app.app_context():
            # Create scheduled shift
            shift = Schedule(
                employee_id=sample_employees["emp1"].id,
                shift_id=1,
                date=date(2025, 6, 5),
                shift_start="09:00",
                shift_end="17:00",
                version=1,
                status=ScheduleStatus.PUBLISHED,
            )
            db.session.add(shift)
            db.session.commit()

            # Check for conflicts
            conflicts = await vacation_tools._check_vacation_conflicts(
                sample_employees["emp1"].id,
                date(2025, 6, 1),
                date(2025, 6, 7),
            )

            # Should find conflict with scheduled shift on June 5
            shift_conflicts = [c for c in conflicts if c["type"] == "scheduled_shift"]
            assert len(shift_conflicts) > 0

    @pytest.mark.asyncio
    async def test_assess_coverage_impact(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test assessment of vacation coverage impact"""
        with app.app_context():
            # Create scheduled shifts
            for i in range(5):
                shift = Schedule(
                    employee_id=sample_employees["emp1"].id,
                    shift_id=1,
                    date=date(2025, 6, 1) + timedelta(days=i),
                    shift_start="09:00",
                    shift_end="17:00",
                    version=1,
                    status=ScheduleStatus.PUBLISHED,
                )
                db.session.add(shift)
            db.session.commit()

            # Assess impact
            impact = await vacation_tools._assess_coverage_impact(
                sample_employees["emp1"].id,
                date(2025, 6, 1),
                date(2025, 6, 5),
            )

            assert len(impact) == 5  # 5 days
            assert all("employee_shifts" in day for day in impact)
            assert all("coverage_percentage_before" in day for day in impact)
            assert all("coverage_percentage_after" in day for day in impact)

    @pytest.mark.asyncio
    async def test_assess_coverage_impact_keyholder(
        self, app, vacation_tools, sample_employees, sample_settings
    ):
        """Test coverage impact assessment for keyholder"""
        with app.app_context():
            # Create shift for keyholder
            shift = Schedule(
                employee_id=sample_employees["emp1"].id,  # Keyholder
                shift_id=1,
                date=date(2025, 6, 1),
                shift_start="09:00",
                shift_end="17:00",
                version=1,
                status=ScheduleStatus.PUBLISHED,
            )
            db.session.add(shift)
            db.session.commit()

            # Assess impact
            impact = await vacation_tools._assess_coverage_impact(
                sample_employees["emp1"].id,
                date(2025, 6, 1),
                date(2025, 6, 1),
            )

            assert len(impact) == 1
            assert impact[0]["is_keyholder"] is True
            assert impact[0]["keyholder_coverage_affected"] is True

    @pytest.mark.asyncio
    async def test_get_tool_info(self, app, vacation_tools):
        """Test get_tool_info method"""
        with app.app_context():
            info = vacation_tools.get_tool_info()

            assert info["category"] == "vacation_management"
            assert "tools" in info
            assert len(info["tools"]) == 1

            tool = info["tools"][0]
            assert tool["name"] == "manage_vacations"
            assert "operations" in tool
            assert "request" in tool["operations"]
            assert "approve" in tool["operations"]
            assert "reject" in tool["operations"]
