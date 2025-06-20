"""
CRUD Operations Tools for MCP Service

This module provides comprehensive CRUD operations for all core entities
through semantic, AI-friendly tools that group related operations.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

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
            employee_data: Optional[Dict] = None,
            availability_data: Optional[List[Dict]] = None,
            filters: Optional[Dict] = None,
            include_availability: bool = True,
            dry_run: bool = False,
        ) -> Dict[str, Any]:
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
            schedule_data: Optional[Dict] = None,
            filters: Optional[Dict] = None,
            bulk_data: Optional[List[Dict]] = None,
            validate_conflicts: bool = True,
            dry_run: bool = False,
        ) -> Dict[str, Any]:
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
            absence_data: Optional[Dict] = None,
            filters: Optional[Dict] = None,
            employee_id: Optional[int] = None,
            date_range: Optional[Dict] = None,
            dry_run: bool = False,
        ) -> Dict[str, Any]:
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
            template_data: Optional[Dict] = None,
            filters: Optional[Dict] = None,
            active_only: bool = True,
            dry_run: bool = False,
        ) -> Dict[str, Any]:
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
        employee_data: Dict,
        availability_data: Optional[List[Dict]],
        dry_run: bool,
    ) -> Dict[str, Any]:
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
        self, filters: Optional[Dict], include_availability: bool
    ) -> Dict[str, Any]:
        """Read a single employee by ID or filters."""
        if not filters or "id" not in filters:
            return {"error": "Employee ID is required for read operation"}

        employee = Employee.query.get(filters["id"])
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
        self, filters: Optional[Dict], include_availability: bool
    ) -> Dict[str, Any]:
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

    # Additional implementation methods would follow for other operations...
    # This is a foundation that can be extended with the remaining CRUD methods
