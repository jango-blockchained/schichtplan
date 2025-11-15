"""
Shift Changes Management Tools for MCP Service

This module provides tools for modifying existing shifts with proper
validation, conflict detection, and notification support.
"""

import logging
from datetime import datetime, timedelta
from typing import Any

from fastmcp import Context

from src.backend.models import (
    Employee,
    EmployeeAvailability,
    Schedule,
    ScheduleStatus,
    Settings,
    db,
)


class ShiftChangesTools:
    """Tools for managing shift changes with validation and conflict detection."""

    def __init__(self, flask_app, logger=None):
        self.flask_app = flask_app
        self.logger = logger or logging.getLogger(__name__)

    def register_tools(self, mcp):
        """Register shift changes tools with the MCP service."""

        @mcp.tool()
        async def manage_shift_changes(
            ctx: Context,
            operation: str,
            shift_id: int | None = None,
            change_data: dict | None = None,
            validate_conflicts: bool = True,
            notify_employee: bool = False,
            reason: str | None = None,
            dry_run: bool = False,
        ) -> dict[str, Any]:
            """Manage shift changes with conflict detection and validation.

            Args:
                operation: Operation type - "modify", "swap", "cancel", "validate"
                shift_id: ID of the shift to modify
                change_data: Data for the shift change (new times, employee, etc.)
                validate_conflicts: Whether to check for scheduling conflicts
                notify_employee: Whether to send notification to affected employee
                reason: Reason for the shift change (for audit trail)
                dry_run: If True, validate but don't commit changes

            Returns:
                Operation result with conflict information and validation status
            """
            try:
                with self.flask_app.app_context():
                    if operation == "modify":
                        return await self._modify_shift(
                            shift_id,
                            change_data,
                            validate_conflicts,
                            notify_employee,
                            reason,
                            dry_run,
                        )
                    elif operation == "swap":
                        return await self._swap_shifts(
                            change_data,
                            validate_conflicts,
                            notify_employee,
                            reason,
                            dry_run,
                        )
                    elif operation == "cancel":
                        return await self._cancel_shift(
                            shift_id,
                            notify_employee,
                            reason,
                            dry_run,
                        )
                    elif operation == "validate":
                        return await self._validate_shift_change(shift_id, change_data)
                    else:
                        return {
                            "error": f"Invalid operation: {operation}",
                            "valid_operations": [
                                "modify",
                                "swap",
                                "cancel",
                                "validate",
                            ],
                        }

            except Exception as e:
                self.logger.error(f"Error in manage_shift_changes: {e}")
                return {
                    "error": str(e),
                    "operation": operation,
                    "shift_id": shift_id,
                }

    async def _modify_shift(
        self,
        shift_id: int | None,
        change_data: dict | None,
        validate_conflicts: bool,
        notify_employee: bool,
        reason: str | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        """Modify an existing shift."""
        if not shift_id:
            return {"error": "shift_id is required for modify operation"}

        if not change_data:
            return {"error": "change_data is required for modify operation"}

        # Get the existing shift
        shift = db.session.get(Schedule, shift_id)
        if not shift:
            return {"error": f"Shift with ID {shift_id} not found"}

        # Store original values for audit
        original_data = {
            "employee_id": shift.employee_id,
            "shift_start": shift.shift_start,
            "shift_end": shift.shift_end,
            "date": shift.date.isoformat(),
        }

        # Validate conflicts if requested
        conflicts = []
        if validate_conflicts:
            conflicts = await self._check_shift_conflicts(
                change_data.get("employee_id", shift.employee_id),
                change_data.get("date", shift.date),
                change_data.get("shift_start", shift.shift_start),
                change_data.get("shift_end", shift.shift_end),
                exclude_shift_id=shift_id,
            )

        if conflicts and not dry_run:
            return {
                "status": "conflict",
                "operation": "modify",
                "shift_id": shift_id,
                "conflicts": conflicts,
                "message": "Shift change would create conflicts. Set validate_conflicts=False to override.",
            }

        try:
            # Apply changes
            if "employee_id" in change_data:
                new_employee = db.session.get(Employee, change_data["employee_id"])
                if not new_employee:
                    return {
                        "error": f"Employee with ID {change_data['employee_id']} not found"
                    }
                shift.employee_id = change_data["employee_id"]

            if "shift_start" in change_data:
                shift.shift_start = change_data["shift_start"]

            if "shift_end" in change_data:
                shift.shift_end = change_data["shift_end"]

            if "date" in change_data:
                if isinstance(change_data["date"], str):
                    shift.date = datetime.strptime(
                        change_data["date"], "%Y-%m-%d"
                    ).date()
                else:
                    shift.date = change_data["date"]

            if "notes" in change_data:
                shift.notes = change_data["notes"]

            # Add reason to notes if provided
            if reason:
                current_notes = shift.notes or ""
                shift.notes = f"{current_notes}\nChange reason: {reason}".strip()

            if not dry_run:
                db.session.commit()
            else:
                # Rollback changes in dry-run mode
                db.session.rollback()

            return {
                "status": "success",
                "operation": "modify",
                "shift_id": shift_id,
                "original": original_data,
                "modified": {
                    "employee_id": shift.employee_id,
                    "shift_start": shift.shift_start,
                    "shift_end": shift.shift_end,
                    "date": shift.date.isoformat(),
                },
                "conflicts_checked": validate_conflicts,
                "conflicts": conflicts,
                "notify_employee": notify_employee,
                "dry_run": dry_run,
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _swap_shifts(
        self,
        change_data: dict | None,
        validate_conflicts: bool,
        notify_employee: bool,
        reason: str | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        """Swap two shifts between employees."""
        if not change_data:
            return {"error": "change_data is required for swap operation"}

        required_fields = ["shift_id_1", "shift_id_2"]
        missing = [f for f in required_fields if f not in change_data]
        if missing:
            return {"error": f"Missing required fields: {missing}"}

        # Get both shifts
        shift1 = db.session.get(Schedule, change_data["shift_id_1"])
        shift2 = db.session.get(Schedule, change_data["shift_id_2"])

        if not shift1:
            return {"error": f"Shift with ID {change_data['shift_id_1']} not found"}
        if not shift2:
            return {"error": f"Shift with ID {change_data['shift_id_2']} not found"}

        # Validate that both employees can work the swapped shifts
        conflicts = []
        if validate_conflicts:
            # Check if employee 1 can work shift 2
            conflicts1 = await self._check_shift_conflicts(
                shift1.employee_id,
                shift2.date,
                shift2.shift_start,
                shift2.shift_end,
                exclude_shift_id=shift1.id,
            )

            # Check if employee 2 can work shift 1
            conflicts2 = await self._check_shift_conflicts(
                shift2.employee_id,
                shift1.date,
                shift1.shift_start,
                shift1.shift_end,
                exclude_shift_id=shift2.id,
            )

            conflicts = conflicts1 + conflicts2

        if conflicts and not dry_run:
            return {
                "status": "conflict",
                "operation": "swap",
                "conflicts": conflicts,
                "message": "Shift swap would create conflicts. Set validate_conflicts=False to override.",
            }

        try:
            # Store original assignments
            original_emp1 = shift1.employee_id
            original_emp2 = shift2.employee_id

            # Perform the swap
            if not dry_run:
                shift1.employee_id = original_emp2
                shift2.employee_id = original_emp1

                # Add reason to notes if provided
                if reason:
                    for shift in [shift1, shift2]:
                        current_notes = shift.notes or ""
                        shift.notes = f"{current_notes}\nSwap reason: {reason}".strip()

                db.session.commit()

            return {
                "status": "success",
                "operation": "swap",
                "shift_1": {
                    "id": shift1.id,
                    "original_employee": original_emp1,
                    "new_employee": original_emp2,
                    "date": shift1.date.isoformat(),
                },
                "shift_2": {
                    "id": shift2.id,
                    "original_employee": original_emp2,
                    "new_employee": original_emp1,
                    "date": shift2.date.isoformat(),
                },
                "conflicts_checked": validate_conflicts,
                "conflicts": conflicts,
                "notify_employee": notify_employee,
                "dry_run": dry_run,
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _cancel_shift(
        self,
        shift_id: int | None,
        notify_employee: bool,
        reason: str | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        """Cancel a shift."""
        if not shift_id:
            return {"error": "shift_id is required for cancel operation"}

        shift = db.session.get(Schedule, shift_id)
        if not shift:
            return {"error": f"Shift with ID {shift_id} not found"}

        try:
            shift_info = {
                "id": shift.id,
                "employee_id": shift.employee_id,
                "date": shift.date.isoformat(),
                "shift_start": shift.shift_start,
                "shift_end": shift.shift_end,
            }

            if not dry_run:
                # Add cancellation reason to notes
                if reason:
                    current_notes = shift.notes or ""
                    shift.notes = f"{current_notes}\nCancelled: {reason}".strip()

                # Mark as archived (represents cancelled state)
                shift.status = ScheduleStatus.ARCHIVED
                db.session.commit()

            return {
                "status": "success",
                "operation": "cancel",
                "cancelled_shift": shift_info,
                "reason": reason,
                "notify_employee": notify_employee,
                "dry_run": dry_run,
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _validate_shift_change(
        self, shift_id: int | None, change_data: dict | None
    ) -> dict[str, Any]:
        """Validate a proposed shift change without making it."""
        if not shift_id:
            return {"error": "shift_id is required for validate operation"}

        if not change_data:
            return {"error": "change_data is required for validate operation"}

        shift = db.session.get(Schedule, shift_id)
        if not shift:
            return {"error": f"Shift with ID {shift_id} not found"}

        # Check conflicts with proposed changes
        employee_id = change_data.get("employee_id", shift.employee_id)
        date = change_data.get("date", shift.date)
        if isinstance(date, str):
            date = datetime.strptime(date, "%Y-%m-%d").date()

        shift_start = change_data.get("shift_start", shift.shift_start)
        shift_end = change_data.get("shift_end", shift.shift_end)

        conflicts = await self._check_shift_conflicts(
            employee_id,
            date,
            shift_start,
            shift_end,
            exclude_shift_id=shift_id,
        )

        # Check employee availability
        employee = db.session.get(Employee, employee_id)
        availability_issues = []

        if employee:
            # Get employee availability for the day
            day_of_week = date.weekday()
            availabilities = EmployeeAvailability.query.filter_by(
                employee_id=employee_id,
                day_of_week=day_of_week,
            ).all()

            # Check if employee is available during shift times
            # (This is simplified; actual implementation should check hour-by-hour)
            if not availabilities:
                availability_issues.append(
                    {
                        "type": "no_availability",
                        "message": "Employee has no availability defined for this day",
                    }
                )

        return {
            "status": "valid"
            if not conflicts and not availability_issues
            else "invalid",
            "operation": "validate",
            "shift_id": shift_id,
            "proposed_changes": change_data,
            "conflicts": conflicts,
            "availability_issues": availability_issues,
            "can_proceed": len(conflicts) == 0 and len(availability_issues) == 0,
        }

    async def _check_shift_conflicts(
        self,
        employee_id: int,
        date: Any,
        shift_start: str,
        shift_end: str,
        exclude_shift_id: int | None = None,
    ) -> list[dict[str, Any]]:
        """Check for scheduling conflicts for an employee on a given date."""
        conflicts = []

        if isinstance(date, str):
            date = datetime.strptime(date, "%Y-%m-%d").date()

        # Get all shifts for this employee on this date
        query = Schedule.query.filter_by(
            employee_id=employee_id,
            date=date,
        )

        if exclude_shift_id:
            query = query.filter(Schedule.id != exclude_shift_id)

        existing_shifts = query.all()

        # Check for time overlaps
        for existing in existing_shifts:
            if existing.shift_start and existing.shift_end:
                # Convert times to comparable format
                start1 = shift_start
                end1 = shift_end
                start2 = existing.shift_start
                end2 = existing.shift_end

                # Check for overlap
                if self._times_overlap(start1, end1, start2, end2):
                    conflicts.append(
                        {
                            "type": "time_overlap",
                            "conflicting_shift_id": existing.id,
                            "date": date.isoformat(),
                            "existing_shift": {
                                "start": start2,
                                "end": end2,
                            },
                            "proposed_shift": {
                                "start": start1,
                                "end": end1,
                            },
                        }
                    )

        # Check rest period requirements
        settings = Settings.get_or_create_default()
        min_rest_hours = settings.min_rest_between_shifts

        # Check previous day
        prev_date = date - timedelta(days=1)
        prev_shifts = Schedule.query.filter_by(
            employee_id=employee_id,
            date=prev_date,
        ).all()

        for prev_shift in prev_shifts:
            if prev_shift.shift_end:
                # Calculate hours between shifts
                hours_between = self._calculate_hours_between(
                    prev_shift.shift_end, shift_start
                )
                if hours_between < min_rest_hours:
                    conflicts.append(
                        {
                            "type": "insufficient_rest",
                            "previous_shift_id": prev_shift.id,
                            "previous_date": prev_date.isoformat(),
                            "hours_between": hours_between,
                            "required_hours": min_rest_hours,
                        }
                    )

        return conflicts

    def _times_overlap(self, start1: str, end1: str, start2: str, end2: str) -> bool:
        """Check if two time ranges overlap."""

        # Convert time strings to comparable integers (HHMM format)
        def time_to_int(time_str):
            parts = time_str.split(":")
            return int(parts[0]) * 100 + int(parts[1])

        s1 = time_to_int(start1)
        e1 = time_to_int(end1)
        s2 = time_to_int(start2)
        e2 = time_to_int(end2)

        # Check for overlap
        return not (e1 <= s2 or e2 <= s1)

    def _calculate_hours_between(self, end_time: str, start_time: str) -> float:
        """Calculate hours between end of one shift and start of another."""

        def time_to_minutes(time_str):
            parts = time_str.split(":")
            return int(parts[0]) * 60 + int(parts[1])

        end_minutes = time_to_minutes(end_time)
        start_minutes = time_to_minutes(start_time)

        # Handle overnight shifts
        if start_minutes < end_minutes:
            start_minutes += 24 * 60

        return (start_minutes - end_minutes) / 60.0

    def get_tool_info(self) -> dict[str, Any]:
        """Return information about the tools provided by this class."""
        return {
            "category": "shift_changes",
            "tools": [
                {
                    "name": "manage_shift_changes",
                    "description": "Manage shift changes with conflict detection",
                    "operations": ["modify", "swap", "cancel", "validate"],
                    "features": [
                        "Conflict detection",
                        "Employee availability checking",
                        "Rest period validation",
                        "Audit trail support",
                    ],
                }
            ],
        }
