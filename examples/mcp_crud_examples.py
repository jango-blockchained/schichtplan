"""
MCP CRUD Operations Examples

This file demonstrates how to use the new CRUD operations tools
for various common scenarios with the Schichtplan MCP service.
"""

import asyncio
from datetime import date, timedelta

# Example usage scenarios for the new CRUD tools


class MCPCRUDExamples:
    """Examples of using MCP CRUD operations."""

    def __init__(self, mcp_service):
        self.mcp_service = mcp_service

    async def example_employee_management(self):
        """Examples of employee CRUD operations."""

        print("=== Employee Management Examples ===\n")

        # 1. Create a new employee with availability
        print("1. Creating a new part-time employee...")
        create_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_employees",
                "parameters": {
                    "operation": "create",
                    "employee_data": {
                        "first_name": "Sarah",
                        "last_name": "Johnson",
                        "employee_group": "TZ",  # Part-time
                        "contracted_hours": 20,
                        "is_keyholder": False,
                        "is_active": True,
                    },
                    "availability_data": [
                        {"day_of_week": 1, "hour": 9, "availability_type": "FIXED"},
                        {"day_of_week": 1, "hour": 10, "availability_type": "FIXED"},
                        {
                            "day_of_week": 1,
                            "hour": 11,
                            "availability_type": "PREFERRED",
                        },
                        {"day_of_week": 3, "hour": 14, "availability_type": "FIXED"},
                        {"day_of_week": 3, "hour": 15, "availability_type": "FIXED"},
                        {"day_of_week": 5, "hour": 9, "availability_type": "AVAILABLE"},
                        {
                            "day_of_week": 5,
                            "hour": 10,
                            "availability_type": "AVAILABLE",
                        },
                    ],
                    "dry_run": False,
                },
            }
        )
        print(f"Result: {create_result}")

        # 2. List all active employees
        print("\n2. Listing all active employees...")
        list_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_employees",
                "parameters": {
                    "operation": "list",
                    "filters": {"is_active": True},
                    "include_availability": False,
                },
            }
        )
        print(f"Found {list_result.get('count', 0)} active employees")

        # 3. Read specific employee with availability
        if create_result.get("status") == "success":
            employee_id = create_result["employee"]["id"]
            print(f"\n3. Reading employee {employee_id} with availability...")
            read_result = await self.mcp_service.handle_tool_call(
                {
                    "tool": "manage_employees",
                    "parameters": {
                        "operation": "read",
                        "filters": {"id": employee_id},
                        "include_availability": True,
                    },
                }
            )
            print(f"Employee details: {read_result}")

        # 4. Update employee information
        print("\n4. Updating employee to be a keyholder...")
        update_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_employees",
                "parameters": {
                    "operation": "update",
                    "employee_data": {
                        "id": employee_id,
                        "is_keyholder": True,
                        "contracted_hours": 25,  # Increase hours
                    },
                    "availability_data": [
                        # Add weekend availability
                        {
                            "day_of_week": 6,
                            "hour": 10,
                            "availability_type": "AVAILABLE",
                        },
                        {
                            "day_of_week": 6,
                            "hour": 11,
                            "availability_type": "AVAILABLE",
                        },
                    ],
                },
            }
        )
        print(f"Update result: {update_result}")

    async def example_schedule_management(self):
        """Examples of schedule CRUD operations."""

        print("\n=== Schedule Management Examples ===\n")

        # 1. Create individual schedule entry
        print("1. Creating a single schedule entry...")
        schedule_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_schedules",
                "parameters": {
                    "operation": "create",
                    "schedule_data": {
                        "employee_id": 1,
                        "shift_id": 1,
                        "date": "2025-01-15",
                        "status": "DRAFT",
                        "availability_type": "FIXED",
                    },
                    "validate_conflicts": True,
                },
            }
        )
        print(f"Schedule creation result: {schedule_result}")

        # 2. Bulk create multiple schedules
        print("\n2. Creating multiple schedules for a week...")
        bulk_data = []
        base_date = date(2025, 1, 20)
        for i in range(5):  # Monday to Friday
            schedule_date = base_date + timedelta(days=i)
            bulk_data.append(
                {
                    "employee_id": 1,
                    "shift_id": 1,
                    "date": schedule_date.isoformat(),
                    "status": "DRAFT",
                }
            )
            bulk_data.append(
                {
                    "employee_id": 2,
                    "shift_id": 2,
                    "date": schedule_date.isoformat(),
                    "status": "DRAFT",
                }
            )

        bulk_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_schedules",
                "parameters": {
                    "operation": "bulk_create",
                    "bulk_data": bulk_data,
                    "validate_conflicts": True,
                },
            }
        )
        print(f"Bulk schedule result: {bulk_result}")

        # 3. List schedules for a date range
        print("\n3. Listing schedules for date range...")
        list_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_schedules",
                "parameters": {
                    "operation": "list",
                    "filters": {"start_date": "2025-01-15", "end_date": "2025-01-25"},
                },
            }
        )
        print(f"Found {list_result.get('count', 0)} schedules in range")

    async def example_absence_management(self):
        """Examples of absence CRUD operations."""

        print("\n=== Absence Management Examples ===\n")

        # 1. Create vacation absence
        print("1. Creating vacation absence...")
        absence_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_absences",
                "parameters": {
                    "operation": "create",
                    "absence_data": {
                        "employee_id": 1,
                        "start_date": "2025-02-01",
                        "end_date": "2025-02-07",
                        "absence_type": "vacation",
                        "reason": "Annual leave",
                        "is_approved": False,
                    },
                },
            }
        )
        print(f"Absence creation result: {absence_result}")

        # 2. List absences for specific employee
        print("\n2. Listing absences for employee...")
        list_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_absences",
                "parameters": {
                    "operation": "list",
                    "employee_id": 1,
                    "date_range": {
                        "start_date": "2025-01-01",
                        "end_date": "2025-12-31",
                    },
                },
            }
        )
        print(f"Employee absences: {list_result}")

        # 3. Update absence approval
        if absence_result.get("status") == "success":
            absence_id = absence_result.get("absence", {}).get("id")
            if absence_id:
                print(f"\n3. Approving absence {absence_id}...")
                update_result = await self.mcp_service.handle_tool_call(
                    {
                        "tool": "manage_absences",
                        "parameters": {
                            "operation": "update",
                            "absence_data": {
                                "id": absence_id,
                                "is_approved": True,
                                "approved_by": "Manager",
                            },
                        },
                    }
                )
                print(f"Absence approval result: {update_result}")

    async def example_shift_template_management(self):
        """Examples of shift template CRUD operations."""

        print("\n=== Shift Template Management Examples ===\n")

        # 1. Create new shift template
        print("1. Creating new evening shift template...")
        template_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_shift_templates",
                "parameters": {
                    "operation": "create",
                    "template_data": {
                        "name": "Evening Shift",
                        "start_time": "17:00",
                        "end_time": "22:00",
                        "shift_type_id": "LATE",
                        "min_employees": 2,
                        "max_employees": 4,
                        "requires_break": True,
                        "requires_keyholder": True,
                        "active_days": {
                            "0": False,  # Monday
                            "1": True,  # Tuesday
                            "2": True,  # Wednesday
                            "3": True,  # Thursday
                            "4": True,  # Friday
                            "5": True,  # Saturday
                            "6": False,  # Sunday
                        },
                    },
                },
            }
        )
        print(f"Template creation result: {template_result}")

        # 2. List all shift templates
        print("\n2. Listing all active shift templates...")
        list_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_shift_templates",
                "parameters": {"operation": "list", "active_only": True},
            }
        )
        print(f"Found {list_result.get('count', 0)} active templates")

        # 3. Update shift template hours
        if template_result.get("status") == "success":
            template_id = template_result.get("template", {}).get("id")
            if template_id:
                print(f"\n3. Updating template {template_id} hours...")
                update_result = await self.mcp_service.handle_tool_call(
                    {
                        "tool": "manage_shift_templates",
                        "parameters": {
                            "operation": "update",
                            "template_data": {
                                "id": template_id,
                                "end_time": "23:00",  # Extend by 1 hour
                                "max_employees": 5,  # Allow more employees
                            },
                        },
                    }
                )
                print(f"Template update result: {update_result}")

    async def example_complex_scenarios(self):
        """Examples of complex multi-entity operations."""

        print("\n=== Complex Scenario Examples ===\n")

        # Scenario: Onboard new employee and schedule them
        print("Scenario: Complete new employee onboarding...")

        # Step 1: Create employee
        employee_result = await self.mcp_service.handle_tool_call(
            {
                "tool": "manage_employees",
                "parameters": {
                    "operation": "create",
                    "employee_data": {
                        "first_name": "Mike",
                        "last_name": "Wilson",
                        "employee_group": "VZ",  # Full-time
                        "contracted_hours": 40,
                        "is_keyholder": True,
                        "is_active": True,
                    },
                    "availability_data": [
                        # Monday-Friday 8-17
                        {"day_of_week": i, "hour": h, "availability_type": "FIXED"}
                        for i in range(5)
                        for h in range(8, 17)
                    ],
                },
            }
        )

        if employee_result.get("status") == "success":
            employee_id = employee_result["employee"]["id"]
            print(f"✓ Created employee {employee_id}")

            # Step 2: Create schedules for next week
            next_monday = date.today() + timedelta(days=(7 - date.today().weekday()))
            schedules = []
            for i in range(5):  # Monday to Friday
                schedule_date = next_monday + timedelta(days=i)
                schedules.append(
                    {
                        "employee_id": employee_id,
                        "shift_id": 1,  # Assuming shift ID 1 exists
                        "date": schedule_date.isoformat(),
                        "status": "DRAFT",
                    }
                )

            schedule_result = await self.mcp_service.handle_tool_call(
                {
                    "tool": "manage_schedules",
                    "parameters": {"operation": "bulk_create", "bulk_data": schedules},
                }
            )

            if schedule_result.get("status") == "success":
                print(f"✓ Created {len(schedules)} schedules for new employee")

            # Step 3: Verify the complete setup
            verification = await self.mcp_service.handle_tool_call(
                {
                    "tool": "manage_employees",
                    "parameters": {
                        "operation": "read",
                        "filters": {"id": employee_id},
                        "include_availability": True,
                    },
                }
            )

            print(
                f"✓ Onboarding complete for {verification['employee']['first_name']} {verification['employee']['last_name']}"
            )


async def run_examples():
    """Run all CRUD examples."""
    # This would be called with an actual MCP service instance
    # For demonstration purposes only
    print("MCP CRUD Operations Examples")
    print("=" * 50)
    print("These examples show how to use the new CRUD tools:")
    print("1. Employee management (create, read, update, list)")
    print("2. Schedule management (single and bulk operations)")
    print("3. Absence management (leave tracking)")
    print("4. Shift template management (template definitions)")
    print("5. Complex scenarios (multi-step operations)")
    print()
    print("To use these tools with a real MCP service:")
    print("1. Ensure the MCP server is running")
    print("2. Connect your AI client to the MCP server")
    print("3. Call the tools with appropriate parameters")
    print("4. Handle responses and errors appropriately")


if __name__ == "__main__":
    asyncio.run(run_examples())
