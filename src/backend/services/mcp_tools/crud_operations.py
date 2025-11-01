"""
CRUD Operations Tools for MCP Service

This module provides comprehensive CRUD operations for all core entities
through semantic, AI-friendly tools that group related operations.
"""

import logging
from datetime import datetime
from typing import Any

from fastmcp import Context

from src.backend.models import (
    Employee,
    EmployeeAvailability,
    EmployeeGroup,
    db,
)
from src.backend.models.employee import AvailabilityType


class CRUDOperationsTools:
    """Tools for CRUD operations on core entities."""

    def __init__(self, flask_app, logger=None):
        self.flask_app = flask_app
        self.logger = logger or logging.getLogger(__name__)

    def register_tools(self, mcp):
        """Register CRUD operation tools with the MCP service."""

        @mcp.tool()
        async def manage_employees(
            ctx: Context,
            operation: str,
            employee_data: dict | None = None,
            availability_data: list[dict] | None = None,
            filters: dict | None = None,
            include_availability: bool = True,
            dry_run: bool = False,
        ) -> dict[str, Any]:
            """Manage employee records and their availability.

            Args:
                operation: Operation type - "create", "read", "update", "delete", "list"
                employee_data: Employee data for create/update operations
                availability_data: List of availability records for create/update
                filters: Query filters for read/list operations
                include_availability: Whether to include availability data in response
                dry_run: If True, validate operations but don't commit changes

            Returns:
                Operation result with employee data and status information
            """
            try:
                with self.flask_app.app_context():
                    if operation == "create":
                        return await self._create_employee(
                            employee_data, availability_data, dry_run
                        )
                    elif operation == "read":
                        return await self._read_employee(filters, include_availability)
                    elif operation == "update":
                        return await self._update_employee(
                            employee_data, availability_data, dry_run
                        )
                    elif operation == "delete":
                        return await self._delete_employee(filters, dry_run)
                    elif operation == "list":
                        return await self._list_employees(filters, include_availability)
                    else:
                        return {
                            "error": f"Invalid operation: {operation}",
                            "valid_operations": [
                                "create",
                                "read",
                                "update",
                                "delete",
                                "list",
                            ],
                        }

            except Exception as e:
                self.logger.error(f"Error in manage_employees: {e}")
                return {
                    "error": str(e),
                    "operation": operation,
                    "timestamp": datetime.now().isoformat(),
                }

        @mcp.tool()
        async def manage_schedules(
            ctx: Context,
            operation: str,
            schedule_data: dict | None = None,
            filters: dict | None = None,
            bulk_data: list[dict] | None = None,
            validate_conflicts: bool = True,
            dry_run: bool = False,
        ) -> dict[str, Any]:
            """Manage schedule entries and assignments.

            Args:
                operation: Operation type - "create", "read", "update", "delete", "list", "bulk_create"
                schedule_data: Schedule data for single operations
                filters: Query filters for read/list/delete operations
                bulk_data: List of schedule records for bulk operations
                validate_conflicts: Whether to check for scheduling conflicts
                dry_run: If True, validate operations but don't commit changes

            Returns:
                Operation result with schedule data and conflict information
            """
            try:
                with self.flask_app.app_context():
                    if operation == "create":
                        return await self._create_schedule(
                            schedule_data, validate_conflicts, dry_run
                        )
                    elif operation == "bulk_create":
                        return await self._bulk_create_schedules(
                            bulk_data, validate_conflicts, dry_run
                        )
                    elif operation == "read":
                        return await self._read_schedule(filters)
                    elif operation == "update":
                        return await self._update_schedule(
                            schedule_data, validate_conflicts, dry_run
                        )
                    elif operation == "delete":
                        return await self._delete_schedule(filters, dry_run)
                    elif operation == "list":
                        return await self._list_schedules(filters)
                    else:
                        return {
                            "error": f"Invalid operation: {operation}",
                            "valid_operations": [
                                "create",
                                "read",
                                "update",
                                "delete",
                                "list",
                                "bulk_create",
                            ],
                        }

            except Exception as e:
                self.logger.error(f"Error in manage_schedules: {e}")
                return {
                    "error": str(e),
                    "operation": operation,
                    "timestamp": datetime.now().isoformat(),
                }

        @mcp.tool()
        async def manage_absences(
            ctx: Context,
            operation: str,
            absence_data: dict | None = None,
            filters: dict | None = None,
            employee_id: int | None = None,
            date_range: dict | None = None,
            dry_run: bool = False,
        ) -> dict[str, Any]:
            """Manage employee absence records.

            Args:
                operation: Operation type - "create", "read", "update", "delete", "list"
                absence_data: Absence data for create/update operations
                filters: Query filters for read/list operations
                employee_id: Specific employee ID filter
                date_range: Date range filter with start_date and end_date
                dry_run: If True, validate operations but don't commit changes

            Returns:
                Operation result with absence data and status information
            """
            try:
                with self.flask_app.app_context():
                    if operation == "create":
                        return await self._create_absence(absence_data, dry_run)
                    elif operation == "read":
                        return await self._read_absence(
                            filters, employee_id, date_range
                        )
                    elif operation == "update":
                        return await self._update_absence(absence_data, dry_run)
                    elif operation == "delete":
                        return await self._delete_absence(filters, dry_run)
                    elif operation == "list":
                        return await self._list_absences(
                            filters, employee_id, date_range
                        )
                    else:
                        return {
                            "error": f"Invalid operation: {operation}",
                            "valid_operations": [
                                "create",
                                "read",
                                "update",
                                "delete",
                                "list",
                            ],
                        }

            except Exception as e:
                self.logger.error(f"Error in manage_absences: {e}")
                return {
                    "error": str(e),
                    "operation": operation,
                    "timestamp": datetime.now().isoformat(),
                }

        @mcp.tool()
        async def manage_shift_templates(
            ctx: Context,
            operation: str,
            template_data: dict | None = None,
            filters: dict | None = None,
            active_only: bool = True,
            dry_run: bool = False,
        ) -> dict[str, Any]:
            """Manage shift template definitions.

            Args:
                operation: Operation type - "create", "read", "update", "delete", "list"
                template_data: Template data for create/update operations
                filters: Query filters for read/list operations
                active_only: Whether to only return active templates (for list operations)
                dry_run: If True, validate operations but don't commit changes

            Returns:
                Operation result with template data and status information
            """
            try:
                with self.flask_app.app_context():
                    if operation == "create":
                        return await self._create_shift_template(template_data, dry_run)
                    elif operation == "read":
                        return await self._read_shift_template(filters)
                    elif operation == "update":
                        return await self._update_shift_template(template_data, dry_run)
                    elif operation == "delete":
                        return await self._delete_shift_template(filters, dry_run)
                    elif operation == "list":
                        return await self._list_shift_templates(filters, active_only)
                    else:
                        return {
                            "error": f"Invalid operation: {operation}",
                            "valid_operations": [
                                "create",
                                "read",
                                "update",
                                "delete",
                                "list",
                            ],
                        }

            except Exception as e:
                self.logger.error(f"Error in manage_shift_templates: {e}")
                return {
                    "error": str(e),
                    "operation": operation,
                    "timestamp": datetime.now().isoformat(),
                }

    # Employee management methods
    async def _create_employee(
        self,
        employee_data: dict,
        availability_data: list[dict] | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        """Create a new employee with optional availability data."""
        if not employee_data:
            return {"error": "employee_data is required for create operation"}

        try:
            # Validate required fields
            required_fields = ["first_name", "last_name", "employee_group"]
            missing_fields = [
                field for field in required_fields if field not in employee_data
            ]
            if missing_fields:
                return {"error": f"Missing required fields: {missing_fields}"}

            # Create employee instance
            employee = Employee(
                first_name=employee_data["first_name"],
                last_name=employee_data["last_name"],
                employee_group=EmployeeGroup(employee_data["employee_group"]),
                contracted_hours=employee_data.get("contracted_hours", 0),
                is_keyholder=employee_data.get("is_keyholder", False),
                is_active=employee_data.get("is_active", True),
            )

            if not dry_run:
                db.session.add(employee)
                db.session.flush()  # Get the employee ID

                # Add availability data if provided
                if availability_data:
                    for avail in availability_data:
                        availability = EmployeeAvailability(
                            employee_id=employee.id,
                            day_of_week=avail["day_of_week"],
                            hour=avail["hour"],
                            is_available=avail.get("is_available", True),
                            availability_type=AvailabilityType(
                                avail.get("availability_type", "AVAILABLE")
                            ),
                        )
                        db.session.add(availability)

                db.session.commit()

            return {
                "status": "success",
                "operation": "create",
                "employee": {
                    "id": employee.id if not dry_run else "dry_run",
                    "first_name": employee.first_name,
                    "last_name": employee.last_name,
                    "employee_group": employee.employee_group.value,
                    "contracted_hours": employee.contracted_hours,
                    "is_keyholder": employee.is_keyholder,
                    "is_active": employee.is_active,
                },
                "availability_records": len(availability_data)
                if availability_data
                else 0,
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _read_employee(
        self, filters: dict | None, include_availability: bool
    ) -> dict[str, Any]:
        """Read a single employee by ID or filters."""
        if not filters or "id" not in filters:
            return {"error": "Employee ID is required for read operation"}

        employee = db.session.get(Employee, filters["id"])
        if not employee:
            return {"error": f"Employee with ID {filters['id']} not found"}

        result = {
            "status": "success",
            "operation": "read",
            "employee": {
                "id": employee.id,
                "first_name": employee.first_name,
                "last_name": employee.last_name,
                "employee_group": employee.employee_group.value,
                "contracted_hours": employee.contracted_hours,
                "is_keyholder": employee.is_keyholder,
                "is_active": employee.is_active,
            },
        }

        if include_availability:
            availability = EmployeeAvailability.query.filter_by(
                employee_id=employee.id
            ).all()
            result["availability"] = [
                {
                    "day_of_week": avail.day_of_week,
                    "hour": avail.hour,
                    "is_available": avail.is_available,
                    "availability_type": avail.availability_type.value,
                }
                for avail in availability
            ]

        return result

    async def _list_employees(
        self, filters: dict | None, include_availability: bool
    ) -> dict[str, Any]:
        """List employees with optional filters."""
        query = Employee.query

        if filters:
            if "is_active" in filters:
                query = query.filter(Employee.is_active == filters["is_active"])
            if "employee_group" in filters:
                query = query.filter(
                    Employee.employee_group == EmployeeGroup(filters["employee_group"])
                )
            if "is_keyholder" in filters:
                query = query.filter(Employee.is_keyholder == filters["is_keyholder"])

        employees = query.all()

        result = {
            "status": "success",
            "operation": "list",
            "count": len(employees),
            "employees": [],
        }

        for employee in employees:
            emp_data = {
                "id": employee.id,
                "first_name": employee.first_name,
                "last_name": employee.last_name,
                "employee_group": employee.employee_group.value,
                "contracted_hours": employee.contracted_hours,
                "is_keyholder": employee.is_keyholder,
                "is_active": employee.is_active,
            }

            if include_availability:
                availability = EmployeeAvailability.query.filter_by(
                    employee_id=employee.id
                ).all()
                emp_data["availability"] = [
                    {
                        "day_of_week": avail.day_of_week,
                        "hour": avail.hour,
                        "is_available": avail.is_available,
                        "availability_type": avail.availability_type.value,
                    }
                    for avail in availability
                ]

            result["employees"].append(emp_data)

        return result

        return result

    async def _update_employee(
        self,
        employee_data: dict,
        availability_data: list[dict] | None,
        dry_run: bool,
    ) -> dict[str, Any]:
        """Update an existing employee."""
        if not employee_data or "id" not in employee_data:
            return {"error": "Employee ID is required for update operation"}

        employee = db.session.get(Employee, employee_data["id"])
        if not employee:
            return {"error": f"Employee with ID {employee_data['id']} not found"}

        try:
            # Update fields
            if "first_name" in employee_data:
                employee.first_name = employee_data["first_name"]
            if "last_name" in employee_data:
                employee.last_name = employee_data["last_name"]
            if "employee_group" in employee_data:
                employee.employee_group = EmployeeGroup(employee_data["employee_group"])
            if "contracted_hours" in employee_data:
                employee.contracted_hours = employee_data["contracted_hours"]
            if "is_keyholder" in employee_data:
                employee.is_keyholder = employee_data["is_keyholder"]
            if "is_active" in employee_data:
                employee.is_active = employee_data["is_active"]

            if not dry_run:
                # Update availability if provided
                if availability_data:
                    # Delete existing availability
                    EmployeeAvailability.query.filter_by(
                        employee_id=employee.id
                    ).delete()
                    # Add new availability
                    for avail in availability_data:
                        availability = EmployeeAvailability(
                            employee_id=employee.id,
                            day_of_week=avail["day_of_week"],
                            hour=avail["hour"],
                            is_available=avail.get("is_available", True),
                            availability_type=AvailabilityType(
                                avail.get("availability_type", "AVAILABLE")
                            ),
                        )
                        db.session.add(availability)

                db.session.commit()

            return {
                "status": "success",
                "operation": "update",
                "employee": {
                    "id": employee.id,
                    "first_name": employee.first_name,
                    "last_name": employee.last_name,
                    "employee_group": employee.employee_group.value,
                    "contracted_hours": employee.contracted_hours,
                    "is_keyholder": employee.is_keyholder,
                    "is_active": employee.is_active,
                },
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _delete_employee(
        self, filters: dict | None, dry_run: bool
    ) -> dict[str, Any]:
        """Delete an employee."""
        if not filters or "id" not in filters:
            return {"error": "Employee ID is required for delete operation"}

        employee = db.session.get(Employee, filters["id"])
        if not employee:
            return {"error": f"Employee with ID {filters['id']} not found"}

        try:
            emp_name = f"{employee.first_name} {employee.last_name}"
            if not dry_run:
                db.session.delete(employee)
                db.session.commit()

            return {
                "status": "success",
                "operation": "delete",
                "deleted_employee": emp_name,
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    # Schedule management methods
    async def _create_schedule(
        self, schedule_data: dict, validate_conflicts: bool, dry_run: bool
    ) -> dict[str, Any]:
        """Create a new schedule entry."""
        if not schedule_data:
            return {"error": "schedule_data is required for create operation"}

        try:
            from datetime import datetime as dt

            from src.backend.models import Schedule, ScheduleStatus

            # Validate required fields
            required_fields = ["employee_id", "shift_id", "date"]
            missing_fields = [
                field for field in required_fields if field not in schedule_data
            ]
            if missing_fields:
                return {"error": f"Missing required fields: {missing_fields}"}

            # Parse date if string
            date_val = schedule_data["date"]
            if isinstance(date_val, str):
                date_val = dt.fromisoformat(date_val)

            # Create schedule instance
            schedule = Schedule(
                employee_id=schedule_data["employee_id"],
                shift_id=schedule_data["shift_id"],
                date=date_val,
                version=schedule_data.get("version", 1),
                shift_start=schedule_data.get("shift_start"),
                shift_end=schedule_data.get("shift_end"),
                duration_hours=schedule_data.get("duration_hours"),
                requires_break=schedule_data.get("requires_break", False),
                shift_type_id=schedule_data.get("shift_type_id"),
                notes=schedule_data.get("notes"),
                status=ScheduleStatus(schedule_data.get("status", "DRAFT")),
            )

            if not dry_run:
                db.session.add(schedule)
                db.session.commit()

            return {
                "status": "success",
                "operation": "create",
                "schedule": {
                    "id": schedule.id if not dry_run else "dry_run",
                    "employee_id": schedule.employee_id,
                    "shift_id": schedule.shift_id,
                    "date": schedule.date.isoformat(),
                    "status": schedule.status.value,
                },
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _bulk_create_schedules(
        self, bulk_data: list[dict], validate_conflicts: bool, dry_run: bool
    ) -> dict[str, Any]:
        """Create multiple schedule entries."""
        if not bulk_data:
            return {"error": "bulk_data is required for bulk_create operation"}

        try:
            from datetime import datetime as dt

            from src.backend.models import Schedule, ScheduleStatus

            created_count = 0
            failed_count = 0
            errors = []

            for item in bulk_data:
                try:
                    # Parse date if string
                    date_val = item.get("date")
                    if isinstance(date_val, str):
                        date_val = dt.fromisoformat(date_val)

                    schedule = Schedule(
                        employee_id=item["employee_id"],
                        shift_id=item["shift_id"],
                        date=date_val,
                        version=item.get("version", 1),
                        status=ScheduleStatus(item.get("status", "DRAFT")),
                    )

                    if not dry_run:
                        db.session.add(schedule)
                    created_count += 1

                except Exception as e:
                    failed_count += 1
                    errors.append({"item": item, "error": str(e)})

            if not dry_run and created_count > 0:
                db.session.commit()

            return {
                "status": "success",
                "operation": "bulk_create",
                "created_count": created_count,
                "failed_count": failed_count,
                "errors": errors,
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _read_schedule(self, filters: dict | None) -> dict[str, Any]:
        """Read a single schedule entry."""
        if not filters or "id" not in filters:
            return {"error": "Schedule ID is required for read operation"}

        from src.backend.models import Schedule

        schedule = db.session.get(Schedule, filters["id"])
        if not schedule:
            return {"error": f"Schedule with ID {filters['id']} not found"}

        return {
            "status": "success",
            "operation": "read",
            "schedule": {
                "id": schedule.id,
                "employee_id": schedule.employee_id,
                "shift_id": schedule.shift_id,
                "date": schedule.date.isoformat(),
                "version": schedule.version,
                "shift_start": schedule.shift_start,
                "shift_end": schedule.shift_end,
                "status": schedule.status.value,
                "notes": schedule.notes,
            },
        }

    async def _list_schedules(self, filters: dict | None) -> dict[str, Any]:
        """List schedules with optional filters."""
        from src.backend.models import Schedule

        query = Schedule.query

        if filters:
            if "employee_id" in filters:
                query = query.filter(Schedule.employee_id == filters["employee_id"])
            if "shift_id" in filters:
                query = query.filter(Schedule.shift_id == filters["shift_id"])
            if "date" in filters:
                query = query.filter(Schedule.date == filters["date"])
            if "status" in filters:
                from src.backend.models import ScheduleStatus

                query = query.filter(
                    Schedule.status == ScheduleStatus(filters["status"])
                )

        schedules = query.all()

        return {
            "status": "success",
            "operation": "list",
            "count": len(schedules),
            "schedules": [
                {
                    "id": s.id,
                    "employee_id": s.employee_id,
                    "shift_id": s.shift_id,
                    "date": s.date.isoformat(),
                    "version": s.version,
                    "status": s.status.value,
                }
                for s in schedules
            ],
        }

    async def _update_schedule(
        self, schedule_data: dict, validate_conflicts: bool, dry_run: bool
    ) -> dict[str, Any]:
        """Update a schedule entry."""
        if not schedule_data or "id" not in schedule_data:
            return {"error": "Schedule ID is required for update operation"}

        from src.backend.models import Schedule

        schedule = db.session.get(Schedule, schedule_data["id"])
        if not schedule:
            return {"error": f"Schedule with ID {schedule_data['id']} not found"}

        try:
            # Update fields
            if "shift_start" in schedule_data:
                schedule.shift_start = schedule_data["shift_start"]
            if "shift_end" in schedule_data:
                schedule.shift_end = schedule_data["shift_end"]
            if "notes" in schedule_data:
                schedule.notes = schedule_data["notes"]
            if "status" in schedule_data:
                from src.backend.models import ScheduleStatus

                schedule.status = ScheduleStatus(schedule_data["status"])

            if not dry_run:
                db.session.commit()

            return {
                "status": "success",
                "operation": "update",
                "schedule": {
                    "id": schedule.id,
                    "employee_id": schedule.employee_id,
                    "shift_id": schedule.shift_id,
                    "date": schedule.date.isoformat(),
                    "status": schedule.status.value,
                },
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _delete_schedule(
        self, filters: dict | None, dry_run: bool
    ) -> dict[str, Any]:
        """Delete a schedule entry."""
        if not filters or "id" not in filters:
            return {"error": "Schedule ID is required for delete operation"}

        from src.backend.models import Schedule

        schedule = db.session.get(Schedule, filters["id"])
        if not schedule:
            return {"error": f"Schedule with ID {filters['id']} not found"}

        try:
            schedule_info = (
                f"Schedule {schedule.id} for employee {schedule.employee_id}"
            )
            if not dry_run:
                db.session.delete(schedule)
                db.session.commit()

            return {
                "status": "success",
                "operation": "delete",
                "deleted_schedule": schedule_info,
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    # Absence management methods
    async def _create_absence(
        self, absence_data: dict, dry_run: bool
    ) -> dict[str, Any]:
        """Create a new absence record."""
        if not absence_data:
            return {"error": "absence_data is required for create operation"}

        try:
            from datetime import datetime as dt

            from src.backend.models import Absence

            # Validate required fields
            required_fields = [
                "employee_id",
                "absence_type_id",
                "start_date",
                "end_date",
            ]
            missing_fields = [
                field for field in required_fields if field not in absence_data
            ]
            if missing_fields:
                return {"error": f"Missing required fields: {missing_fields}"}

            # Parse dates if strings
            start_date = absence_data["start_date"]
            end_date = absence_data["end_date"]
            if isinstance(start_date, str):
                start_date = dt.strptime(start_date, "%Y-%m-%d").date()
            if isinstance(end_date, str):
                end_date = dt.strptime(end_date, "%Y-%m-%d").date()

            # Create absence instance
            absence = Absence(
                employee_id=absence_data["employee_id"],
                absence_type_id=absence_data["absence_type_id"],
                start_date=start_date,
                end_date=end_date,
                note=absence_data.get("note"),
            )

            if not dry_run:
                db.session.add(absence)
                db.session.commit()

            return {
                "status": "success",
                "operation": "create",
                "absence": {
                    "id": absence.id if not dry_run else "dry_run",
                    "employee_id": absence.employee_id,
                    "absence_type_id": absence.absence_type_id,
                    "start_date": absence.start_date.isoformat(),
                    "end_date": absence.end_date.isoformat(),
                },
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _read_absence(
        self,
        filters: dict | None,
        employee_id: int | None,
        date_range: dict | None,
    ) -> dict[str, Any]:
        """Read absence record(s)."""
        from src.backend.models import Absence

        if filters and "id" in filters:
            absence = db.session.get(Absence, filters["id"])
            if not absence:
                return {"error": f"Absence with ID {filters['id']} not found"}

            return {
                "status": "success",
                "operation": "read",
                "absence": absence.to_dict(),
            }

        return {"error": "Absence ID is required for read operation"}

    async def _list_absences(
        self,
        filters: dict | None,
        employee_id: int | None,
        date_range: dict | None,
    ) -> dict[str, Any]:
        """List absences with optional filters."""
        from datetime import datetime as dt

        from src.backend.models import Absence

        query = Absence.query

        if employee_id:
            query = query.filter(Absence.employee_id == employee_id)

        if date_range:
            if "start_date" in date_range:
                start = date_range["start_date"]
                if isinstance(start, str):
                    start = dt.strptime(start, "%Y-%m-%d").date()
                query = query.filter(Absence.start_date >= start)

            if "end_date" in date_range:
                end = date_range["end_date"]
                if isinstance(end, str):
                    end = dt.strptime(end, "%Y-%m-%d").date()
                query = query.filter(Absence.end_date <= end)

        if filters and "absence_type_id" in filters:
            query = query.filter(
                Absence.absence_type_id == filters["absence_type_id"]
            )

        absences = query.all()

        return {
            "status": "success",
            "operation": "list",
            "count": len(absences),
            "absences": [absence.to_dict() for absence in absences],
        }

    async def _update_absence(
        self, absence_data: dict, dry_run: bool
    ) -> dict[str, Any]:
        """Update an absence record."""
        if not absence_data or "id" not in absence_data:
            return {"error": "Absence ID is required for update operation"}

        from datetime import datetime as dt

        from src.backend.models import Absence

        absence = db.session.get(Absence, absence_data["id"])
        if not absence:
            return {"error": f"Absence with ID {absence_data['id']} not found"}

        try:
            # Update fields
            if "absence_type_id" in absence_data:
                absence.absence_type_id = absence_data["absence_type_id"]
            if "start_date" in absence_data:
                start = absence_data["start_date"]
                if isinstance(start, str):
                    start = dt.strptime(start, "%Y-%m-%d").date()
                absence.start_date = start
            if "end_date" in absence_data:
                end = absence_data["end_date"]
                if isinstance(end, str):
                    end = dt.strptime(end, "%Y-%m-%d").date()
                absence.end_date = end
            if "note" in absence_data:
                absence.note = absence_data["note"]

            if not dry_run:
                db.session.commit()

            return {
                "status": "success",
                "operation": "update",
                "absence": absence.to_dict(),
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _delete_absence(
        self, filters: dict | None, dry_run: bool
    ) -> dict[str, Any]:
        """Delete an absence record."""
        if not filters or "id" not in filters:
            return {"error": "Absence ID is required for delete operation"}

        from src.backend.models import Absence

        absence = db.session.get(Absence, filters["id"])
        if not absence:
            return {"error": f"Absence with ID {filters['id']} not found"}

        try:
            absence_info = f"Absence {absence.id} for employee {absence.employee_id}"
            if not dry_run:
                db.session.delete(absence)
                db.session.commit()

            return {
                "status": "success",
                "operation": "delete",
                "deleted_absence": absence_info,
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    # Shift template management methods
    async def _create_shift_template(
        self, template_data: dict, dry_run: bool
    ) -> dict[str, Any]:
        """Create a new shift template."""
        if not template_data:
            return {"error": "template_data is required for create operation"}

        try:
            from src.backend.models import ShiftTemplate

            # Validate required fields
            required_fields = ["start_time", "end_time"]
            missing_fields = [
                field for field in required_fields if field not in template_data
            ]
            if missing_fields:
                return {"error": f"Missing required fields: {missing_fields}"}

            # Create template instance
            template = ShiftTemplate(
                name=template_data.get("name"),
                start_time=template_data["start_time"],
                end_time=template_data["end_time"],
                duration_hours=template_data.get("duration_hours"),
                requires_break=template_data.get("requires_break", True),
                active_days=template_data.get("active_days", [0, 1, 2, 3, 4, 5]),
                shift_type_id=template_data.get("shift_type_id"),
            )

            if not dry_run:
                db.session.add(template)
                db.session.commit()

            return {
                "status": "success",
                "operation": "create",
                "template": {
                    "id": template.id if not dry_run else "dry_run",
                    "name": template.name,
                    "start_time": template.start_time,
                    "end_time": template.end_time,
                    "active_days": template.active_days,
                },
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _read_shift_template(self, filters: dict | None) -> dict[str, Any]:
        """Read a single shift template."""
        if not filters or "id" not in filters:
            return {"error": "Template ID is required for read operation"}

        from src.backend.models import ShiftTemplate

        template = db.session.get(ShiftTemplate, filters["id"])
        if not template:
            return {"error": f"Template with ID {filters['id']} not found"}

        return {
            "status": "success",
            "operation": "read",
            "template": {
                "id": template.id,
                "name": template.name,
                "start_time": template.start_time,
                "end_time": template.end_time,
                "duration_hours": template.duration_hours,
                "requires_break": template.requires_break,
                "active_days": template.active_days,
                "shift_type_id": template.shift_type_id,
            },
        }

    async def _list_shift_templates(
        self, filters: dict | None, active_only: bool
    ) -> dict[str, Any]:
        """List shift templates."""
        from src.backend.models import ShiftTemplate

        query = ShiftTemplate.query

        if filters:
            if "shift_type_id" in filters:
                query = query.filter(
                    ShiftTemplate.shift_type_id == filters["shift_type_id"]
                )
            if "name" in filters:
                query = query.filter(ShiftTemplate.name.ilike(f"%{filters['name']}%"))

        templates = query.all()

        return {
            "status": "success",
            "operation": "list",
            "count": len(templates),
            "templates": [
                {
                    "id": t.id,
                    "name": t.name,
                    "start_time": t.start_time,
                    "end_time": t.end_time,
                    "duration_hours": t.duration_hours,
                    "active_days": t.active_days,
                    "shift_type_id": t.shift_type_id,
                }
                for t in templates
            ],
        }

    async def _update_shift_template(
        self, template_data: dict, dry_run: bool
    ) -> dict[str, Any]:
        """Update a shift template."""
        if not template_data or "id" not in template_data:
            return {"error": "Template ID is required for update operation"}

        from src.backend.models import ShiftTemplate

        template = db.session.get(ShiftTemplate, template_data["id"])
        if not template:
            return {"error": f"Template with ID {template_data['id']} not found"}

        try:
            # Update fields
            if "name" in template_data:
                template.name = template_data["name"]
            if "start_time" in template_data:
                template.start_time = template_data["start_time"]
            if "end_time" in template_data:
                template.end_time = template_data["end_time"]
            if "duration_hours" in template_data:
                template.duration_hours = template_data["duration_hours"]
            if "requires_break" in template_data:
                template.requires_break = template_data["requires_break"]
            if "active_days" in template_data:
                template.active_days = template_data["active_days"]
            if "shift_type_id" in template_data:
                template.shift_type_id = template_data["shift_type_id"]

            if not dry_run:
                db.session.commit()

            return {
                "status": "success",
                "operation": "update",
                "template": {
                    "id": template.id,
                    "name": template.name,
                    "start_time": template.start_time,
                    "end_time": template.end_time,
                },
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e

    async def _delete_shift_template(
        self, filters: dict | None, dry_run: bool
    ) -> dict[str, Any]:
        """Delete a shift template."""
        if not filters or "id" not in filters:
            return {"error": "Template ID is required for delete operation"}

        from src.backend.models import ShiftTemplate

        template = db.session.get(ShiftTemplate, filters["id"])
        if not template:
            return {"error": f"Template with ID {filters['id']} not found"}

        try:
            template_info = f"Template {template.name or template.id} ({template.start_time}-{template.end_time})"
            if not dry_run:
                db.session.delete(template)
                db.session.commit()

            return {
                "status": "success",
                "operation": "delete",
                "deleted_template": template_info,
                "dry_run": dry_run,
                "timestamp": datetime.now().isoformat(),
            }

        except Exception as e:
            if not dry_run:
                db.session.rollback()
            raise e
