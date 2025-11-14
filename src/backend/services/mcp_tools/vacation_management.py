"""
Vacation Management Tools for MCP Service

This module provides comprehensive vacation planning and approval workflow
tools that integrate with schedule generation and absence management.
"""

import logging
from datetime import datetime, timedelta
from typing import Any

from fastmcp import Context

from src.backend.models import Absence, Employee, Schedule, Settings, db


class VacationManagementTools:
    """Tools for vacation planning, approval, and integration with scheduling."""

    def __init__(self, flask_app, logger=None):
        self.flask_app = flask_app
        self.logger = logger or logging.getLogger(__name__)

    def register_tools(self, mcp):
        """Register vacation management tools with the MCP service."""

        @mcp.tool()
        async def manage_vacations(
            ctx: Context,
            operation: str,
            vacation_data: dict | None = None,
            employee_id: int | None = None,
            date_range: dict | None = None,
            approval_action: str | None = None,
            check_conflicts: bool = True,
            dry_run: bool = False,
        ) -> dict[str, Any]:
            """Manage vacation requests and approvals with conflict detection.

            Args:
                operation: Operation type - "request", "approve", "reject", "cancel",
                          "list", "check_availability"
                vacation_data: Vacation request data (employee_id, start_date, end_date, type)
                employee_id: Filter by specific employee
                date_range: Date range for listing vacations
                approval_action: Approval action with optional note
                check_conflicts: Whether to check for scheduling conflicts
                dry_run: If True, validate but don't commit changes

            Returns:
                Operation result with vacation data, conflicts, and approval status
            """
            try:
                with self.flask_app.app_context():
                    if operation == "request":
                        return await self._request_vacation(
                            vacation_data, check_conflicts, dry_run
                        )
                    elif operation == "approve":
                        return await self._approve_vacation(
                            vacation_data, approval_action, dry_run
                        )
                    elif operation == "reject":
                        return await self._reject_vacation(
                            vacation_data, approval_action, dry_run
                        )
                    elif operation == "cancel":
                        return await self._cancel_vacation(vacation_data, dry_run)
                    elif operation == "list":
                        return await self._list_vacations(employee_id, date_range)
                    elif operation == "check_availability":
                        return await self._check_vacation_availability(
                            vacation_data, employee_id
                        )
                    else:
                        return {
                            "error": f"Invalid operation: {operation}",
                            "valid_operations": [
                                "request",
                                "approve",
                                "reject",
                                "cancel",
                                "list",
                                "check_availability",
                            ],
                        }

            except Exception as e:
                self.logger.error(f"Error in manage_vacations: {e}")
                return {
                    "error": str(e),
                    "operation": operation,
                }

    async def _request_vacation(
        self,
        vacation_data: dict | None,
        check_conflicts: bool,
        dry_run: bool,
    ) -> dict[str, Any]:
        """Create a new vacation request."""
        if not vacation_data:
            return {"error": "vacation_data is required for request operation"}

        required_fields = ["employee_id", "start_date", "end_date"]
        missing = [f for f in required_fields if f not in vacation_data]
        if missing:
            return {"error": f"Missing required fields: {missing}"}

        # Validate employee exists
        employee = db.session.get(Employee, vacation_data["employee_id"])
        if not employee:
            return {
                "error": f"Employee with ID {vacation_data['employee_id']} not found"
            }

        # Parse dates
        start_date = vacation_data["start_date"]
        end_date = vacation_data["end_date"]
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

        # Validate date range
        if end_date < start_date:
            return {"error": "end_date must be after start_date"}

        # Calculate vacation days
        vacation_days = (end_date - start_date).days + 1

        # Check for conflicts if requested
        conflicts = []
        coverage_impact = []
        if check_conflicts:
            conflicts = await self._check_vacation_conflicts(
                vacation_data["employee_id"],
                start_date,
                end_date,
            )

            coverage_impact = await self._assess_coverage_impact(
                vacation_data["employee_id"],
                start_date,
                end_date,
            )

        if conflicts and not dry_run:
            return {
                "status": "conflict",
                "operation": "request",
                "conflicts": conflicts,
                "coverage_impact": coverage_impact,
                "message": "Vacation request would create conflicts. Review conflicts before proceeding.",
            }

        try:
            # Get vacation absence type ID from settings
            settings = Settings.get_or_create_default()
            vacation_type_id = None

            # Find vacation/holiday absence type
            for absence_type in settings.absence_types:
                if absence_type.get("id") in ["URL", "HDY", "VACATION"]:
                    vacation_type_id = absence_type.get("id")
                    break

            if not vacation_type_id and settings.absence_types:
                # Use first absence type as fallback
                vacation_type_id = settings.absence_types[0].get("id")

            # Create absence record
            if not dry_run:
                absence = Absence(
                    employee_id=vacation_data["employee_id"],
                    absence_type_id=vacation_type_id or "URL",
                    start_date=start_date,
                    end_date=end_date,
                    note=vacation_data.get("note", "Vacation request"),
                )
                db.session.add(absence)
                db.session.commit()

                absence_id = absence.id
            else:
                absence_id = "dry_run"

            return {
                "status": "success",
                "operation": "request",
                "vacation": {
                    "id": absence_id,
                    "employee_id": vacation_data["employee_id"],
                    "employee_name": f"{employee.first_name} {employee.last_name}",
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": vacation_days,
                    "type": vacation_type_id,
                },
                "conflicts": conflicts,
                "coverage_impact": coverage_impact,
                "dry_run": dry_run,
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _approve_vacation(
        self,
        vacation_data: dict | None,
        approval_action: str | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        """Approve a vacation request."""
        if not vacation_data or "id" not in vacation_data:
            return {
                "error": "vacation_data with 'id' is required for approve operation"
            }

        absence = db.session.get(Absence, vacation_data["id"])
        if not absence:
            return {"error": f"Vacation with ID {vacation_data['id']} not found"}

        try:
            # Update absence record with approval
            if not dry_run:
                # Add approval note
                current_note = absence.note or ""
                approval_note = approval_action or "Approved"
                absence.note = f"{current_note}\nApproved: {approval_note} at {datetime.now().isoformat()}".strip()

                db.session.commit()

            employee = db.session.get(Employee, absence.employee_id)

            return {
                "status": "success",
                "operation": "approve",
                "vacation": {
                    "id": absence.id,
                    "employee_id": absence.employee_id,
                    "employee_name": f"{employee.first_name} {employee.last_name}"
                    if employee
                    else "Unknown",
                    "start_date": absence.start_date.isoformat(),
                    "end_date": absence.end_date.isoformat(),
                    "days": (absence.end_date - absence.start_date).days + 1,
                },
                "approval_note": approval_action,
                "dry_run": dry_run,
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _reject_vacation(
        self,
        vacation_data: dict | None,
        approval_action: str | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        """Reject a vacation request."""
        if not vacation_data or "id" not in vacation_data:
            return {"error": "vacation_data with 'id' is required for reject operation"}

        absence = db.session.get(Absence, vacation_data["id"])
        if not absence:
            return {"error": f"Vacation with ID {vacation_data['id']} not found"}

        try:
            employee = db.session.get(Employee, absence.employee_id)

            vacation_info = {
                "id": absence.id,
                "employee_id": absence.employee_id,
                "employee_name": f"{employee.first_name} {employee.last_name}"
                if employee
                else "Unknown",
                "start_date": absence.start_date.isoformat(),
                "end_date": absence.end_date.isoformat(),
                "days": (absence.end_date - absence.start_date).days + 1,
            }

            if not dry_run:
                # Delete the absence record
                db.session.delete(absence)
                db.session.commit()

            return {
                "status": "success",
                "operation": "reject",
                "rejected_vacation": vacation_info,
                "rejection_reason": approval_action or "Rejected",
                "dry_run": dry_run,
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _cancel_vacation(
        self,
        vacation_data: dict | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        """Cancel an approved vacation."""
        if not vacation_data or "id" not in vacation_data:
            return {"error": "vacation_data with 'id' is required for cancel operation"}

        absence = db.session.get(Absence, vacation_data["id"])
        if not absence:
            return {"error": f"Vacation with ID {vacation_data['id']} not found"}

        try:
            employee = db.session.get(Employee, absence.employee_id)

            vacation_info = {
                "id": absence.id,
                "employee_id": absence.employee_id,
                "employee_name": f"{employee.first_name} {employee.last_name}"
                if employee
                else "Unknown",
                "start_date": absence.start_date.isoformat(),
                "end_date": absence.end_date.isoformat(),
                "days": (absence.end_date - absence.start_date).days + 1,
            }

            if not dry_run:
                # Delete the absence record
                db.session.delete(absence)
                db.session.commit()

            return {
                "status": "success",
                "operation": "cancel",
                "cancelled_vacation": vacation_info,
                "dry_run": dry_run,
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _list_vacations(
        self,
        employee_id: int | None,
        date_range: dict | None,
    ) -> dict[str, Any]:
        """List vacation requests with optional filters."""
        query = Absence.query

        # Filter by employee
        if employee_id:
            query = query.filter(Absence.employee_id == employee_id)

        # Filter by date range
        if date_range:
            if "start_date" in date_range:
                start = date_range["start_date"]
                if isinstance(start, str):
                    start = datetime.strptime(start, "%Y-%m-%d").date()
                query = query.filter(Absence.start_date >= start)

            if "end_date" in date_range:
                end = date_range["end_date"]
                if isinstance(end, str):
                    end = datetime.strptime(end, "%Y-%m-%d").date()
                query = query.filter(Absence.end_date <= end)

        # Filter to vacation types only
        settings = Settings.get_or_create_default()
        vacation_type_ids = []
        for absence_type in settings.absence_types:
            if absence_type.get("id") in ["URL", "HDY", "VACATION"]:
                vacation_type_ids.append(absence_type.get("id"))

        if vacation_type_ids:
            query = query.filter(Absence.absence_type_id.in_(vacation_type_ids))

        absences = query.all()

        # Build vacation list with employee info
        vacations = []
        for absence in absences:
            employee = db.session.get(Employee, absence.employee_id)
            vacations.append(
                {
                    "id": absence.id,
                    "employee_id": absence.employee_id,
                    "employee_name": f"{employee.first_name} {employee.last_name}"
                    if employee
                    else "Unknown",
                    "start_date": absence.start_date.isoformat(),
                    "end_date": absence.end_date.isoformat(),
                    "days": (absence.end_date - absence.start_date).days + 1,
                    "type": absence.absence_type_id,
                    "note": absence.note,
                }
            )

        return {
            "status": "success",
            "operation": "list",
            "count": len(vacations),
            "vacations": vacations,
        }

    async def _check_vacation_availability(
        self,
        vacation_data: dict | None,
        employee_id: int | None,
    ) -> dict[str, Any]:
        """Check if vacation dates are available for an employee or team."""
        if not vacation_data:
            return {
                "error": "vacation_data is required for check_availability operation"
            }

        required_fields = ["start_date", "end_date"]
        missing = [f for f in required_fields if f not in vacation_data]
        if missing:
            return {"error": f"Missing required fields: {missing}"}

        # Parse dates
        start_date = vacation_data["start_date"]
        end_date = vacation_data["end_date"]
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, "%Y-%m-%d").date()

        # Check specific employee or all employees
        if employee_id:
            conflicts = await self._check_vacation_conflicts(
                employee_id,
                start_date,
                end_date,
            )

            coverage_impact = await self._assess_coverage_impact(
                employee_id,
                start_date,
                end_date,
            )

            employee = db.session.get(Employee, employee_id)

            return {
                "status": "success",
                "operation": "check_availability",
                "employee_id": employee_id,
                "employee_name": f"{employee.first_name} {employee.last_name}"
                if employee
                else "Unknown",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": (end_date - start_date).days + 1,
                "available": len(conflicts) == 0,
                "conflicts": conflicts,
                "coverage_impact": coverage_impact,
            }
        else:
            # Check team-wide availability
            all_employees = Employee.query.filter_by(is_active=True).all()

            employee_availability = []
            for emp in all_employees:
                conflicts = await self._check_vacation_conflicts(
                    emp.id,
                    start_date,
                    end_date,
                )

                employee_availability.append(
                    {
                        "employee_id": emp.id,
                        "employee_name": f"{emp.first_name} {emp.last_name}",
                        "available": len(conflicts) == 0,
                        "conflict_count": len(conflicts),
                    }
                )

            return {
                "status": "success",
                "operation": "check_availability",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": (end_date - start_date).days + 1,
                "team_availability": employee_availability,
                "available_employees": len(
                    [e for e in employee_availability if e["available"]]
                ),
                "total_employees": len(employee_availability),
            }

    async def _check_vacation_conflicts(
        self,
        employee_id: int,
        start_date: Any,
        end_date: Any,
    ) -> list[dict[str, Any]]:
        """Check for conflicts with existing vacations and schedules."""
        conflicts = []

        # Check for overlapping vacations
        existing_absences = Absence.query.filter(
            Absence.employee_id == employee_id,
            Absence.start_date <= end_date,
            Absence.end_date >= start_date,
        ).all()

        for absence in existing_absences:
            conflicts.append(
                {
                    "type": "existing_vacation",
                    "absence_id": absence.id,
                    "start_date": absence.start_date.isoformat(),
                    "end_date": absence.end_date.isoformat(),
                    "absence_type": absence.absence_type_id,
                }
            )

        # Check for scheduled shifts during vacation period
        current_date = start_date
        while current_date <= end_date:
            shifts = Schedule.query.filter(
                Schedule.employee_id == employee_id,
                Schedule.date == current_date,
            ).all()

            if shifts:
                conflicts.append(
                    {
                        "type": "scheduled_shift",
                        "date": current_date.isoformat(),
                        "shift_count": len(shifts),
                        "shift_ids": [s.id for s in shifts],
                    }
                )

            current_date += timedelta(days=1)

        return conflicts

    async def _assess_coverage_impact(
        self,
        employee_id: int,
        start_date: Any,
        end_date: Any,
    ) -> list[dict[str, Any]]:
        """Assess the impact of vacation on schedule coverage."""
        impact = []

        employee = db.session.get(Employee, employee_id)
        if not employee:
            return impact

        # Check each day in the vacation period
        current_date = start_date
        while current_date <= end_date:
            # Get all shifts for this date
            all_shifts = Schedule.query.filter(Schedule.date == current_date).all()
            employee_shifts = [s for s in all_shifts if s.employee_id == employee_id]

            if employee_shifts:
                # Check if employee is a keyholder
                keyholder_impact = employee.is_keyholder and len(employee_shifts) > 0

                impact.append(
                    {
                        "date": current_date.isoformat(),
                        "employee_shifts": len(employee_shifts),
                        "total_shifts": len(all_shifts),
                        "is_keyholder": employee.is_keyholder,
                        "keyholder_coverage_affected": keyholder_impact,
                        "coverage_percentage_before": (
                            len(all_shifts) / max(len(all_shifts), 1) * 100
                        ),
                        "coverage_percentage_after": (
                            (len(all_shifts) - len(employee_shifts))
                            / max(len(all_shifts), 1)
                            * 100
                        ),
                    }
                )

            current_date += timedelta(days=1)

        return impact

    def get_tool_info(self) -> dict[str, Any]:
        """Return information about the tools provided by this class."""
        return {
            "category": "vacation_management",
            "tools": [
                {
                    "name": "manage_vacations",
                    "description": "Comprehensive vacation planning and approval workflow",
                    "operations": [
                        "request",
                        "approve",
                        "reject",
                        "cancel",
                        "list",
                        "check_availability",
                    ],
                    "features": [
                        "Conflict detection with existing vacations and schedules",
                        "Coverage impact assessment",
                        "Team-wide availability checking",
                        "Approval workflow support",
                    ],
                }
            ],
        }
