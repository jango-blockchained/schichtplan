"""
A simplified MCP server for the Schichtplan application.
This implementation follows the MCP standard for tool and resource integration.
"""

from flask import Flask, jsonify, request
import os
import sys
import logging

# Determine if we're being run via MCP CLI or directly
# When run via MCP CLI, we should not log to stdout
RUN_VIA_MCP_CLI = "MCP_CLI" in os.environ or any(
    "mcp dev" in arg or "mcp run" in arg for arg in sys.argv
)

# Set up logging
if RUN_VIA_MCP_CLI:
    # When run via MCP CLI, log to a file to avoid interfering with stdio communication
    log_dir = os.path.dirname(os.path.abspath(__file__))
    log_file = os.path.join(log_dir, "simple_server.log")
    logging.basicConfig(
        filename=log_file,
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
else:
    # When run directly, log to console
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

logger = logging.getLogger("simple-mcp")

app = Flask(__name__)


class SimpleResources:
    """
    Resources provide read-only data from the Schichtplan application.
    Each method returns structured data that can be consumed by an LLM.
    """

    @staticmethod
    def greeting():
        return {
            "message": "Welcome to the Schichtplan MCP Server!",
            "version": "1.0.0",
            "description": "This server provides access to shift scheduling data and tools.",
        }

    @staticmethod
    def get_employees():
        return {
            "employees": [
                {
                    "id": 1,
                    "name": "John Doe",
                    "role": "Manager",
                    "hourly_rate": 25.50,
                    "max_hours_per_week": 40,
                },
                {
                    "id": 2,
                    "name": "Jane Smith",
                    "role": "Employee",
                    "hourly_rate": 18.75,
                    "max_hours_per_week": 30,
                },
                {
                    "id": 3,
                    "name": "Bob Johnson",
                    "role": "Employee",
                    "hourly_rate": 20.00,
                    "max_hours_per_week": 35,
                },
            ]
        }

    @staticmethod
    def get_employee(employee_id):
        employees = {
            "1": {
                "id": 1,
                "name": "John Doe",
                "role": "Manager",
                "hourly_rate": 25.50,
                "max_hours_per_week": 40,
                "skills": ["opening", "closing", "training"],
            },
            "2": {
                "id": 2,
                "name": "Jane Smith",
                "role": "Employee",
                "hourly_rate": 18.75,
                "max_hours_per_week": 30,
                "skills": ["cashier", "stocking"],
            },
            "3": {
                "id": 3,
                "name": "Bob Johnson",
                "role": "Employee",
                "hourly_rate": 20.00,
                "max_hours_per_week": 35,
                "skills": ["customer_service", "opening"],
            },
        }
        if str(employee_id) in employees:
            return employees[str(employee_id)]
        return {"error": "Employee not found", "status": 404}

    @staticmethod
    def get_shifts():
        return {
            "shifts": [
                {
                    "id": 1,
                    "name": "Morning Shift",
                    "start_time": "08:00",
                    "end_time": "16:00",
                    "required_skills": ["opening", "cashier"],
                },
                {
                    "id": 2,
                    "name": "Evening Shift",
                    "start_time": "16:00",
                    "end_time": "00:00",
                    "required_skills": ["closing", "customer_service"],
                },
                {
                    "id": 3,
                    "name": "Night Shift",
                    "start_time": "00:00",
                    "end_time": "08:00",
                    "required_skills": ["stocking"],
                },
            ]
        }

    @staticmethod
    def get_schedules():
        return {
            "schedules": [
                {
                    "id": 1,
                    "week": "2023-W01",
                    "published": True,
                    "shifts_assigned": 14,
                    "total_hours": 112,
                    "employees": 5,
                },
                {
                    "id": 2,
                    "week": "2023-W02",
                    "published": True,
                    "shifts_assigned": 15,
                    "total_hours": 118,
                    "employees": 5,
                },
                {
                    "id": 3,
                    "week": "2023-W03",
                    "published": False,
                    "shifts_assigned": 12,
                    "total_hours": 96,
                    "employees": 4,
                },
            ]
        }

    @staticmethod
    def get_settings():
        return {
            "settings": {
                "store_name": "Example Store",
                "opening_hours": {
                    "monday": {"open": "08:00", "close": "20:00"},
                    "tuesday": {"open": "08:00", "close": "20:00"},
                    "wednesday": {"open": "08:00", "close": "20:00"},
                    "thursday": {"open": "08:00", "close": "20:00"},
                    "friday": {"open": "08:00", "close": "22:00"},
                    "saturday": {"open": "08:00", "close": "22:00"},
                    "sunday": {"open": "10:00", "close": "18:00"},
                },
                "break_rules": {"min_break_duration": 30, "required_after_hours": 5},
                "scheduling_rules": {
                    "min_hours_between_shifts": 10,
                    "max_consecutive_days": 5,
                },
            }
        }


class SimpleTools:
    """
    Tools provide actions that can modify the Schichtplan application.
    Each method accepts parameters and returns a result with a clear status.
    """

    @staticmethod
    def create_employee(name, role, hourly_rate=None, max_hours=None, skills=None):
        """Create a new employee with the given attributes."""
        try:
            # Input validation
            if not name or not role:
                return {
                    "success": False,
                    "error": "Name and role are required",
                    "status_code": 400,
                }

            # In a real implementation, this would create the employee in the database
            new_employee = {
                "id": 4,  # Would be auto-generated in a real implementation
                "name": name,
                "role": role,
                "hourly_rate": float(hourly_rate) if hourly_rate else 15.0,
                "max_hours_per_week": int(max_hours) if max_hours else 40,
                "skills": skills if skills else [],
            }

            return {
                "success": True,
                "message": "Employee created successfully",
                "employee": new_employee,
            }
        except Exception as e:
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def update_employee(
        employee_id, name=None, role=None, hourly_rate=None, max_hours=None, skills=None
    ):
        """Update an existing employee with the provided attributes."""
        try:
            # Input validation
            if not employee_id:
                return {
                    "success": False,
                    "error": "Employee ID is required",
                    "status_code": 400,
                }

            # In a real implementation, this would update the employee in the database
            # Here we're just returning a mock success response
            updated_fields = []
            if name:
                updated_fields.append("name")
            if role:
                updated_fields.append("role")
            if hourly_rate:
                updated_fields.append("hourly_rate")
            if max_hours:
                updated_fields.append("max_hours_per_week")
            if skills:
                updated_fields.append("skills")

            return {
                "success": True,
                "message": "Employee updated successfully",
                "employee_id": employee_id,
                "updated_fields": updated_fields,
            }
        except Exception as e:
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def delete_employee(employee_id):
        """Delete an employee by ID."""
        try:
            # Input validation
            if not employee_id:
                return {
                    "success": False,
                    "error": "Employee ID is required",
                    "status_code": 400,
                }

            # In a real implementation, this would delete the employee from the database
            return {
                "success": True,
                "message": "Employee deleted successfully",
                "employee_id": employee_id,
            }
        except Exception as e:
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def generate_schedule(week, employees=None, constraints=None):
        """Generate a new schedule for the specified week."""
        try:
            # Input validation
            if not week:
                return {
                    "success": False,
                    "error": "Week is required (format: YYYY-Wnn)",
                    "status_code": 400,
                }

            # In a real implementation, this would generate a schedule in the database
            # using the specified employees and constraints
            return {
                "success": True,
                "message": "Schedule generated successfully",
                "schedule": {
                    "id": 4,
                    "week": week,
                    "published": False,
                    "shifts_assigned": 16,
                    "total_hours": 124,
                    "employees": employees if employees else "all available",
                },
            }
        except Exception as e:
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def export_schedule_pdf(
        schedule_id, include_employee_details=False, include_costs=False
    ):
        """Export a schedule as PDF."""
        try:
            # Input validation
            if not schedule_id:
                return {
                    "success": False,
                    "error": "Schedule ID is required",
                    "status_code": 400,
                }

            # In a real implementation, this would generate a PDF
            # with the schedule details
            return {
                "success": True,
                "message": "Schedule exported to PDF successfully",
                "file_path": f"/tmp/schedule_{schedule_id}.pdf",
                "schedule_id": schedule_id,
                "included_employee_details": include_employee_details,
                "included_costs": include_costs,
            }
        except Exception as e:
            return {"success": False, "error": str(e), "status_code": 500}


# Set up resource routes
@app.route("/greeting")
def greeting():
    return jsonify(SimpleResources.greeting())


@app.route("/employees")
def get_employees():
    return jsonify(SimpleResources.get_employees())


@app.route("/employees/<employee_id>")
def get_employee(employee_id):
    return jsonify(SimpleResources.get_employee(employee_id))


@app.route("/shifts")
def get_shifts():
    return jsonify(SimpleResources.get_shifts())


@app.route("/schedules")
def get_schedules():
    return jsonify(SimpleResources.get_schedules())


@app.route("/settings")
def get_settings():
    return jsonify(SimpleResources.get_settings())


# Set up tool routes (for manual testing)
@app.route("/tools/create_employee", methods=["POST"])
def create_employee_endpoint():
    data = request.json
    return jsonify(SimpleTools.create_employee(**data))


@app.route("/tools/update_employee", methods=["POST"])
def update_employee_endpoint():
    data = request.json
    return jsonify(SimpleTools.update_employee(**data))


@app.route("/tools/delete_employee", methods=["POST"])
def delete_employee_endpoint():
    data = request.json
    return jsonify(SimpleTools.delete_employee(**data))


@app.route("/tools/generate_schedule", methods=["POST"])
def generate_schedule_endpoint():
    data = request.json
    return jsonify(SimpleTools.generate_schedule(**data))


@app.route("/tools/export_schedule_pdf", methods=["POST"])
def export_schedule_pdf_endpoint():
    data = request.json
    return jsonify(SimpleTools.export_schedule_pdf(**data))


# Define the MCP class for tools
class MCP:
    """
    MCP class that follows the Model Context Protocol standard.
    This class is structured to work with the MCP CLI and integrates
    with Claude to provide access to tools and resources.
    """

    def __init__(self):
        self.tools = SimpleTools()
        self._setup_tools()

    def _setup_tools(self):
        """
        Register methods as tools with proper signatures.
        Each tool uses the method directly from SimpleTools.
        """
        # Employee management tools
        self.create_employee = self.tools.create_employee
        self.update_employee = self.tools.update_employee
        self.delete_employee = self.tools.delete_employee

        # Schedule management tools
        self.generate_schedule = self.tools.generate_schedule
        self.export_schedule_pdf = self.tools.export_schedule_pdf

    def run(self, *args, **kwargs):
        """
        Required method for MCP CLI integration.
        Returns the Flask application instance.
        """
        return app


# Create the MCP instance
mcp = MCP()
app.mcp = mcp

# If running directly, start the server
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", 5000))
    if not RUN_VIA_MCP_CLI:
        print(f"Starting Simple MCP server on port {port}")
    logger.info(f"Starting Simple MCP server on port {port}")
    # Use 127.0.0.1 instead of 0.0.0.0 to avoid potential network binding issues
    app.run(debug=True, host="127.0.0.1", port=port)
