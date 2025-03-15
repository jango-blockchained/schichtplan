"""
Schichtplan MCP Server
----------------------

This server provides access to the Schichtplan application through the Model Context Protocol.
It connects to the actual backend database and services to provide real data and functionality.
"""

import os
import sys
import traceback
from flask import Flask, jsonify, request
from datetime import datetime, timedelta
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
    log_file = os.path.join(log_dir, "server.log")
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

logger = logging.getLogger(__name__)

# Add the project root to the path to access backend modules
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.dirname(os.path.dirname(current_dir))
if src_dir not in sys.path:
    sys.path.append(src_dir)

try:
    # Import backend modules
    from src.backend.app import create_app, db
    from src.backend.models.employee import Employee
    from src.backend.models.shift import Shift, ShiftAssignment
    from src.backend.models.schedule import Schedule
    from src.backend.models.absence import Absence
    from src.backend.models.settings import Settings
    from src.backend.services.schedule_generator import ScheduleGenerator
    from src.backend.services.pdf_generator import PDFGenerator

    # Create Flask app using the backend's create_app function
    flask_app = create_app()
    app = flask_app

    # Flag to indicate real mode is active
    USING_REAL_BACKEND = True
    logger.info("Using real backend with database connection")

except ImportError as e:
    # If imports fail, fall back to mock implementation
    logger.warning(f"Backend import failed: {str(e)}. Using mock implementation.")
    USING_REAL_BACKEND = False

    # Create a simple Flask app instead
    app = Flask(__name__)

    # Import simple server implementation
    sys.path.append(current_dir)
    try:
        from simple_server import SimpleResources, SimpleTools

        logger.info("Successfully imported simple server implementation")
    except ImportError:
        logger.error("Failed to import simple server implementation")
        raise


class Resources:
    """
    Resources provide read-only data from the Schichtplan application.
    Each method returns structured data from the actual backend.
    """

    @staticmethod
    def greeting():
        """Return welcome message and server info."""
        try:
            if USING_REAL_BACKEND:
                with app.app_context():
                    settings = Settings.query.first()
                    store_name = settings.store_name if settings else "Schichtplan"

                    return {
                        "message": f"Welcome to the {store_name} MCP Server!",
                        "version": "1.0.0",
                        "description": "This server provides access to shift scheduling data and tools.",
                        "server_time": datetime.now().isoformat(),
                        "store_name": store_name,
                        "mode": "real",
                    }
            else:
                # Fall back to simplified implementation
                return SimpleResources.greeting()
        except Exception as e:
            logger.error(f"Error in greeting: {str(e)}")
            return {
                "message": "Welcome to the Schichtplan MCP Server!",
                "version": "1.0.0",
                "description": "This server provides access to shift scheduling data and tools.",
                "server_time": datetime.now().isoformat(),
                "mode": "fallback",
                "error": str(e),
            }

    @staticmethod
    def get_employees():
        """Return all employees from the database."""
        try:
            if USING_REAL_BACKEND:
                with app.app_context():
                    employees = Employee.query.all()
                    result = []

                    for employee in employees:
                        result.append(
                            {
                                "id": employee.id,
                                "name": f"{employee.first_name} {employee.last_name}",
                                "role": employee.role,
                                "email": employee.email,
                                "phone": employee.phone,
                                "hourly_rate": employee.hourly_rate,
                                "max_hours_per_week": employee.max_hours_per_week,
                                "active": employee.active,
                            }
                        )

                    return {"employees": result}
            else:
                # Fall back to simplified implementation
                return SimpleResources.get_employees()
        except Exception as e:
            logger.error(f"Error in get_employees: {str(e)}")
            return {"error": str(e), "employees": []}

    @staticmethod
    def get_employee(employee_id):
        """Return details for a specific employee."""
        with app.app_context():
            employee = Employee.query.get(employee_id)

            if not employee:
                return {"error": "Employee not found", "status": 404}

            # Get employee skills
            skills = [skill.name for skill in employee.skills]

            # Get recent shifts
            recent_shifts = (
                ShiftAssignment.query.filter_by(employee_id=employee_id)
                .order_by(ShiftAssignment.date.desc())
                .limit(5)
                .all()
            )
            shifts_data = []

            for shift in recent_shifts:
                shifts_data.append(
                    {
                        "id": shift.id,
                        "date": shift.date.isoformat(),
                        "shift_name": shift.shift.name,
                        "start_time": shift.shift.start_time.strftime("%H:%M"),
                        "end_time": shift.shift.end_time.strftime("%H:%M"),
                    }
                )

            return {
                "id": employee.id,
                "name": f"{employee.first_name} {employee.last_name}",
                "first_name": employee.first_name,
                "last_name": employee.last_name,
                "role": employee.role,
                "email": employee.email,
                "phone": employee.phone,
                "hourly_rate": employee.hourly_rate,
                "max_hours_per_week": employee.max_hours_per_week,
                "active": employee.active,
                "skills": skills,
                "recent_shifts": shifts_data,
            }

    @staticmethod
    def get_shifts():
        """Return all shift templates."""
        with app.app_context():
            shifts = Shift.query.all()
            result = []

            for shift in shifts:
                required_skills = [skill.name for skill in shift.required_skills]

                result.append(
                    {
                        "id": shift.id,
                        "name": shift.name,
                        "start_time": shift.start_time.strftime("%H:%M"),
                        "end_time": shift.end_time.strftime("%H:%M"),
                        "color": shift.color,
                        "required_skills": required_skills,
                        "min_employees": shift.min_employees,
                        "max_employees": shift.max_employees,
                    }
                )

            return {"shifts": result}

    @staticmethod
    def get_schedules():
        """Return all schedules."""
        with app.app_context():
            schedules = Schedule.query.order_by(Schedule.start_date.desc()).all()
            result = []

            for schedule in schedules:
                # Count shifts and hours in this schedule
                shift_assignments = ShiftAssignment.query.filter(
                    ShiftAssignment.date >= schedule.start_date,
                    ShiftAssignment.date <= schedule.end_date,
                ).all()

                total_hours = 0
                employees_set = set()

                for assignment in shift_assignments:
                    employees_set.add(assignment.employee_id)
                    # Calculate hours for this shift
                    shift = assignment.shift
                    start = shift.start_time
                    end = shift.end_time

                    # Handle overnight shifts
                    if end < start:
                        # Add 24 hours to end time for overnight shifts
                        hours = (24 - start.hour + end.hour) + (
                            end.minute - start.minute
                        ) / 60
                    else:
                        hours = (end.hour - start.hour) + (
                            end.minute - start.minute
                        ) / 60

                    total_hours += hours

                result.append(
                    {
                        "id": schedule.id,
                        "name": schedule.name,
                        "start_date": schedule.start_date.isoformat(),
                        "end_date": schedule.end_date.isoformat(),
                        "published": schedule.published,
                        "shifts_assigned": len(shift_assignments),
                        "total_hours": round(total_hours, 1),
                        "employees": len(employees_set),
                        "created_at": schedule.created_at.isoformat()
                        if schedule.created_at
                        else None,
                        "updated_at": schedule.updated_at.isoformat()
                        if schedule.updated_at
                        else None,
                    }
                )

            return {"schedules": result}

    @staticmethod
    def get_schedule(schedule_id):
        """Return details for a specific schedule."""
        with app.app_context():
            schedule = Schedule.query.get(schedule_id)

            if not schedule:
                return {"error": "Schedule not found", "status": 404}

            # Get all shift assignments for this schedule
            shift_assignments = ShiftAssignment.query.filter(
                ShiftAssignment.date >= schedule.start_date,
                ShiftAssignment.date <= schedule.end_date,
            ).all()

            assignments_by_date = {}

            for assignment in shift_assignments:
                date_str = assignment.date.isoformat()
                if date_str not in assignments_by_date:
                    assignments_by_date[date_str] = []

                employee = Employee.query.get(assignment.employee_id)

                assignments_by_date[date_str].append(
                    {
                        "id": assignment.id,
                        "shift_id": assignment.shift_id,
                        "shift_name": assignment.shift.name,
                        "start_time": assignment.shift.start_time.strftime("%H:%M"),
                        "end_time": assignment.shift.end_time.strftime("%H:%M"),
                        "employee_id": assignment.employee_id,
                        "employee_name": f"{employee.first_name} {employee.last_name}"
                        if employee
                        else "Unknown",
                        "color": assignment.shift.color,
                    }
                )

            # Calculate schedule stats
            total_hours = 0
            employees_set = set()

            for assignment in shift_assignments:
                employees_set.add(assignment.employee_id)
                # Calculate hours for this shift
                shift = assignment.shift
                start = shift.start_time
                end = shift.end_time

                # Handle overnight shifts
                if end < start:
                    # Add 24 hours to end time for overnight shifts
                    hours = (24 - start.hour + end.hour) + (
                        end.minute - start.minute
                    ) / 60
                else:
                    hours = (end.hour - start.hour) + (end.minute - start.minute) / 60

                total_hours += hours

            return {
                "id": schedule.id,
                "name": schedule.name,
                "start_date": schedule.start_date.isoformat(),
                "end_date": schedule.end_date.isoformat(),
                "published": schedule.published,
                "shifts_assigned": len(shift_assignments),
                "total_hours": round(total_hours, 1),
                "employees": len(employees_set),
                "assignments_by_date": assignments_by_date,
                "created_at": schedule.created_at.isoformat()
                if schedule.created_at
                else None,
                "updated_at": schedule.updated_at.isoformat()
                if schedule.updated_at
                else None,
            }

    @staticmethod
    def get_absences():
        """Return all employee absences."""
        with app.app_context():
            # Get absences for the next 30 days by default
            today = datetime.now().date()
            end_date = today + timedelta(days=30)

            absences = Absence.query.filter(
                Absence.start_date <= end_date, Absence.end_date >= today
            ).all()

            result = []

            for absence in absences:
                employee = Employee.query.get(absence.employee_id)

                result.append(
                    {
                        "id": absence.id,
                        "employee_id": absence.employee_id,
                        "employee_name": f"{employee.first_name} {employee.last_name}"
                        if employee
                        else "Unknown",
                        "start_date": absence.start_date.isoformat(),
                        "end_date": absence.end_date.isoformat(),
                        "reason": absence.reason,
                        "approved": absence.approved,
                    }
                )

            return {"absences": result}

    @staticmethod
    def get_settings():
        """Return application settings."""
        with app.app_context():
            settings = Settings.query.first()

            if not settings:
                return {"error": "Settings not found", "status": 404}

            # Parse opening hours
            opening_hours = {}
            days = [
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
            ]

            for day in days:
                open_attr = getattr(settings, f"{day}_open", None)
                close_attr = getattr(settings, f"{day}_close", None)

                if open_attr and close_attr:
                    opening_hours[day] = {
                        "open": open_attr.strftime("%H:%M"),
                        "close": close_attr.strftime("%H:%M"),
                    }

            return {
                "settings": {
                    "store_name": settings.store_name,
                    "address": settings.address,
                    "phone": settings.phone,
                    "email": settings.email,
                    "opening_hours": opening_hours,
                    "break_rules": {
                        "min_break_duration": settings.min_break_duration,
                        "required_after_hours": settings.break_after_hours,
                    },
                    "scheduling_rules": {
                        "min_hours_between_shifts": settings.min_hours_between_shifts,
                        "max_consecutive_days": settings.max_consecutive_days,
                        "scheduling_period_days": settings.scheduling_period_days,
                    },
                }
            }


class Tools:
    """
    Tools provide actions that modify the Schichtplan application.
    Each method interacts with the actual backend services.
    """

    @staticmethod
    def create_employee(
        first_name,
        last_name,
        role,
        email=None,
        phone=None,
        hourly_rate=None,
        max_hours=None,
        skills=None,
    ):
        """Create a new employee with the given attributes."""
        try:
            if USING_REAL_BACKEND:
                with app.app_context():
                    # Input validation
                    if not first_name or not last_name or not role:
                        return {
                            "success": False,
                            "error": "First name, last name, and role are required",
                            "status_code": 400,
                        }

                    # Create new employee
                    employee = Employee(
                        first_name=first_name,
                        last_name=last_name,
                        role=role,
                        email=email,
                        phone=phone,
                        hourly_rate=float(hourly_rate) if hourly_rate else 15.0,
                        max_hours_per_week=int(max_hours) if max_hours else 40,
                        active=True,
                    )

                    # Add skills if provided
                    if skills:
                        from src.backend.models.skill import Skill

                        for skill_name in skills:
                            skill = Skill.query.filter_by(name=skill_name).first()
                            if skill:
                                employee.skills.append(skill)

                    # Save to database
                    db.session.add(employee)
                    db.session.commit()

                    return {
                        "success": True,
                        "message": "Employee created successfully",
                        "employee": {
                            "id": employee.id,
                            "name": f"{employee.first_name} {employee.last_name}",
                            "role": employee.role,
                            "email": employee.email,
                            "phone": employee.phone,
                            "hourly_rate": employee.hourly_rate,
                            "max_hours_per_week": employee.max_hours_per_week,
                        },
                    }
            else:
                # Convert parameters to match simplified implementation
                name = (
                    f"{first_name} {last_name}"
                    if first_name and last_name
                    else first_name or last_name
                )
                return SimpleTools.create_employee(
                    name=name,
                    role=role,
                    hourly_rate=hourly_rate,
                    max_hours=max_hours,
                    skills=skills,
                )
        except Exception as e:
            logger.error(
                f"Error in create_employee: {str(e)}\n{traceback.format_exc()}"
            )
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def update_employee(
        employee_id,
        first_name=None,
        last_name=None,
        role=None,
        email=None,
        phone=None,
        hourly_rate=None,
        max_hours=None,
        skills=None,
        active=None,
    ):
        """Update an existing employee with the provided attributes."""
        try:
            with app.app_context():
                # Input validation
                if not employee_id:
                    return {
                        "success": False,
                        "error": "Employee ID is required",
                        "status_code": 400,
                    }

                # Get employee
                employee = Employee.query.get(employee_id)
                if not employee:
                    return {
                        "success": False,
                        "error": f"Employee with ID {employee_id} not found",
                        "status_code": 404,
                    }

                # Update attributes
                updated_fields = []

                if first_name:
                    employee.first_name = first_name
                    updated_fields.append("first_name")

                if last_name:
                    employee.last_name = last_name
                    updated_fields.append("last_name")

                if role:
                    employee.role = role
                    updated_fields.append("role")

                if email:
                    employee.email = email
                    updated_fields.append("email")

                if phone:
                    employee.phone = phone
                    updated_fields.append("phone")

                if hourly_rate:
                    employee.hourly_rate = float(hourly_rate)
                    updated_fields.append("hourly_rate")

                if max_hours:
                    employee.max_hours_per_week = int(max_hours)
                    updated_fields.append("max_hours_per_week")

                if active is not None:
                    employee.active = bool(active)
                    updated_fields.append("active")

                # Update skills if provided
                if skills:
                    from src.backend.models.skill import Skill

                    employee.skills = []  # Clear existing skills
                    for skill_name in skills:
                        skill = Skill.query.filter_by(name=skill_name).first()
                        if skill:
                            employee.skills.append(skill)
                    updated_fields.append("skills")

                # Save changes
                db.session.commit()

                return {
                    "success": True,
                    "message": "Employee updated successfully",
                    "employee_id": employee.id,
                    "updated_fields": updated_fields,
                }
        except Exception as e:
            print(traceback.format_exc())
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def delete_employee(employee_id):
        """Delete an employee by ID."""
        try:
            with app.app_context():
                # Input validation
                if not employee_id:
                    return {
                        "success": False,
                        "error": "Employee ID is required",
                        "status_code": 400,
                    }

                # Get employee
                employee = Employee.query.get(employee_id)
                if not employee:
                    return {
                        "success": False,
                        "error": f"Employee with ID {employee_id} not found",
                        "status_code": 404,
                    }

                # Instead of deleting, mark as inactive
                employee.active = False
                db.session.commit()

                return {
                    "success": True,
                    "message": "Employee deactivated successfully",
                    "employee_id": employee_id,
                }
        except Exception as e:
            print(traceback.format_exc())
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def generate_schedule(
        start_date, end_date=None, name=None, employees=None, constraints=None
    ):
        """Generate a new schedule for the specified dates."""
        try:
            with app.app_context():
                # Input validation
                if not start_date:
                    return {
                        "success": False,
                        "error": "Start date is required (format: YYYY-MM-DD)",
                        "status_code": 400,
                    }

                # Parse start date
                try:
                    if isinstance(start_date, str):
                        start_date = datetime.fromisoformat(start_date).date()
                    else:
                        start_date = start_date
                except ValueError:
                    return {
                        "success": False,
                        "error": "Invalid start date format. Use YYYY-MM-DD",
                        "status_code": 400,
                    }

                # Parse or set end date
                if end_date:
                    try:
                        if isinstance(end_date, str):
                            end_date = datetime.fromisoformat(end_date).date()
                        else:
                            end_date = end_date
                    except ValueError:
                        return {
                            "success": False,
                            "error": "Invalid end date format. Use YYYY-MM-DD",
                            "status_code": 400,
                        }
                else:
                    # Default to one week
                    end_date = start_date + timedelta(days=6)

                # Generate schedule name if not provided
                if not name:
                    name = f"Schedule {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"

                # Create schedule
                schedule = Schedule(
                    name=name,
                    start_date=start_date,
                    end_date=end_date,
                    published=False,
                    created_at=datetime.now(),
                )

                db.session.add(schedule)
                db.session.commit()

                # Generate shifts using the schedule generator
                generator = ScheduleGenerator(schedule)
                generator.generate()

                # Count shifts and hours
                shift_assignments = ShiftAssignment.query.filter(
                    ShiftAssignment.date >= schedule.start_date,
                    ShiftAssignment.date <= schedule.end_date,
                ).all()

                total_hours = 0
                employees_set = set()

                for assignment in shift_assignments:
                    employees_set.add(assignment.employee_id)
                    # Calculate hours for this shift
                    shift = assignment.shift
                    start = shift.start_time
                    end = shift.end_time

                    # Handle overnight shifts
                    if end < start:
                        # Add 24 hours to end time for overnight shifts
                        hours = (24 - start.hour + end.hour) + (
                            end.minute - start.minute
                        ) / 60
                    else:
                        hours = (end.hour - start.hour) + (
                            end.minute - start.minute
                        ) / 60

                    total_hours += hours

                return {
                    "success": True,
                    "message": "Schedule generated successfully",
                    "schedule": {
                        "id": schedule.id,
                        "name": schedule.name,
                        "start_date": schedule.start_date.isoformat(),
                        "end_date": schedule.end_date.isoformat(),
                        "published": schedule.published,
                        "shifts_assigned": len(shift_assignments),
                        "total_hours": round(total_hours, 1),
                        "employees": len(employees_set),
                    },
                }
        except Exception as e:
            print(traceback.format_exc())
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def publish_schedule(schedule_id):
        """Publish a schedule."""
        try:
            with app.app_context():
                # Input validation
                if not schedule_id:
                    return {
                        "success": False,
                        "error": "Schedule ID is required",
                        "status_code": 400,
                    }

                # Get schedule
                schedule = Schedule.query.get(schedule_id)
                if not schedule:
                    return {
                        "success": False,
                        "error": f"Schedule with ID {schedule_id} not found",
                        "status_code": 404,
                    }

                # Update published status
                schedule.published = True
                schedule.updated_at = datetime.now()
                db.session.commit()

                return {
                    "success": True,
                    "message": "Schedule published successfully",
                    "schedule_id": schedule.id,
                }
        except Exception as e:
            print(traceback.format_exc())
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def export_schedule_pdf(
        schedule_id, include_employee_details=False, include_costs=False
    ):
        """Export a schedule as PDF."""
        try:
            with app.app_context():
                # Input validation
                if not schedule_id:
                    return {
                        "success": False,
                        "error": "Schedule ID is required",
                        "status_code": 400,
                    }

                # Get schedule
                schedule = Schedule.query.get(schedule_id)
                if not schedule:
                    return {
                        "success": False,
                        "error": f"Schedule with ID {schedule_id} not found",
                        "status_code": 404,
                    }

                # Use PDF generator to create PDF
                pdf_generator = PDFGenerator(schedule)
                file_path = pdf_generator.generate_schedule_pdf(
                    include_employee_details=include_employee_details,
                    include_costs=include_costs,
                )

                return {
                    "success": True,
                    "message": "Schedule exported to PDF successfully",
                    "file_path": file_path,
                    "schedule_id": schedule_id,
                    "included_employee_details": include_employee_details,
                    "included_costs": include_costs,
                }
        except Exception as e:
            print(traceback.format_exc())
            return {"success": False, "error": str(e), "status_code": 500}


# Set up resource routes
@app.route("/greeting")
def greeting():
    return jsonify(Resources.greeting())


@app.route("/employees")
def get_employees():
    return jsonify(Resources.get_employees())


@app.route("/employees/<employee_id>")
def get_employee(employee_id):
    if USING_REAL_BACKEND:
        return jsonify(Resources.get_employee(employee_id))
    else:
        return jsonify(SimpleResources.get_employee(employee_id))


@app.route("/shifts")
def get_shifts():
    if USING_REAL_BACKEND:
        return jsonify(Resources.get_shifts())
    else:
        return jsonify(SimpleResources.get_shifts())


@app.route("/schedules")
def get_schedules():
    if USING_REAL_BACKEND:
        return jsonify(Resources.get_schedules())
    else:
        return jsonify(SimpleResources.get_schedules())


@app.route("/schedules/<schedule_id>")
def get_schedule(schedule_id):
    if USING_REAL_BACKEND:
        return jsonify(Resources.get_schedule(schedule_id))
    else:
        # Simplified version may not have this endpoint
        return jsonify({"error": "Not implemented in simplified mode"})


@app.route("/absences")
def get_absences():
    if USING_REAL_BACKEND:
        return jsonify(Resources.get_absences())
    else:
        # Simplified version may not have this endpoint
        return jsonify({"error": "Not implemented in simplified mode"})


@app.route("/settings")
def get_settings():
    if USING_REAL_BACKEND:
        return jsonify(Resources.get_settings())
    else:
        return jsonify(SimpleResources.get_settings())


# Set up tool routes (for manual testing)
@app.route("/tools/create_employee", methods=["POST"])
def create_employee_endpoint():
    data = request.json
    return jsonify(Tools.create_employee(**data))


@app.route("/tools/update_employee", methods=["POST"])
def update_employee_endpoint():
    data = request.json
    if USING_REAL_BACKEND:
        return jsonify(Tools.update_employee(**data))
    else:
        return jsonify(SimpleTools.update_employee(**data))


@app.route("/tools/delete_employee", methods=["POST"])
def delete_employee_endpoint():
    data = request.json
    if USING_REAL_BACKEND:
        return jsonify(Tools.delete_employee(**data))
    else:
        return jsonify(SimpleTools.delete_employee(**data))


@app.route("/tools/generate_schedule", methods=["POST"])
def generate_schedule_endpoint():
    data = request.json
    if USING_REAL_BACKEND:
        return jsonify(Tools.generate_schedule(**data))
    else:
        # Convert parameters for simplified implementation
        if "start_date" in data and "week" not in data:
            data["week"] = f"{data['start_date']}-W"
        return jsonify(SimpleTools.generate_schedule(**data))


@app.route("/tools/publish_schedule", methods=["POST"])
def publish_schedule_endpoint():
    data = request.json
    if USING_REAL_BACKEND:
        return jsonify(Tools.publish_schedule(**data))
    else:
        # Simplified version may not have this endpoint
        return jsonify({"success": True, "message": "Schedule published (mock)"})


@app.route("/tools/export_schedule_pdf", methods=["POST"])
def export_schedule_pdf_endpoint():
    data = request.json
    if USING_REAL_BACKEND:
        return jsonify(Tools.export_schedule_pdf(**data))
    else:
        return jsonify(SimpleTools.export_schedule_pdf(**data))


# Define the MCP class for tools
class MCP:
    """
    MCP class that follows the Model Context Protocol standard.
    This class is structured to work with the MCP CLI and integrates
    with Claude to provide access to tools and resources.
    """

    def __init__(self):
        logger.info("Initializing MCP class")
        self.resources = {}
        self.endpoint_descriptions = {}
        self._setup_resources()
        self._setup_tools()
        logger.info("MCP initialization complete")

    def _setup_resources(self):
        """Register resources with proper URLs."""
        logger.info("Setting up resources")

        # Define resource descriptions
        self.endpoint_descriptions = {
            "/greeting": "Get a welcome message and server information",
            "/employees": "Get a list of all employees",
            "/employees/{id}": "Get details for a specific employee",
            "/shifts": "Get a list of all shift templates",
            "/schedules": "Get a list of all schedules",
            "/schedules/{id}": "Get details for a specific schedule",
            "/absences": "Get a list of all employee absences",
            "/settings": "Get application settings",
        }

        # Register resource endpoints
        self.resource(
            "http://localhost:8000/greeting",
            description="Get a welcome message and server information",
        )
        self.resource(
            "http://localhost:8000/employees", description="Get a list of all employees"
        )
        self.resource(
            "http://localhost:8000/employees/{employee_id}",
            description="Get details for a specific employee",
        )
        self.resource(
            "http://localhost:8000/shifts",
            description="Get a list of all shift templates",
        )
        self.resource(
            "http://localhost:8000/schedules", description="Get a list of all schedules"
        )
        self.resource(
            "http://localhost:8000/schedules/{schedule_id}",
            description="Get details for a specific schedule",
        )
        self.resource(
            "http://localhost:8000/absences",
            description="Get a list of all employee absences",
        )
        self.resource(
            "http://localhost:8000/settings", description="Get application settings"
        )

        logger.info(f"Registered {len(self.endpoint_descriptions)} resources")

    def _setup_tools(self):
        """
        Register methods as tools with proper signatures.
        """
        logger.info("Setting up tools")

        # Employee management tools
        self.tool(
            "create_employee",
            description="Create a new employee",
            parameters=[
                {
                    "name": "first_name",
                    "description": "Employee's first name",
                    "required": True,
                },
                {
                    "name": "last_name",
                    "description": "Employee's last name",
                    "required": True,
                },
                {"name": "role", "description": "Employee's role", "required": True},
                {
                    "name": "email",
                    "description": "Employee's email address",
                    "required": False,
                },
                {
                    "name": "phone",
                    "description": "Employee's phone number",
                    "required": False,
                },
                {
                    "name": "hourly_rate",
                    "description": "Employee's hourly rate",
                    "required": False,
                },
                {
                    "name": "max_hours",
                    "description": "Maximum hours per week",
                    "required": False,
                },
                {"name": "skills", "description": "List of skills", "required": False},
            ],
        )

        self.tool(
            "update_employee",
            description="Update an existing employee",
            parameters=[
                {
                    "name": "employee_id",
                    "description": "ID of the employee to update",
                    "required": True,
                },
                {
                    "name": "first_name",
                    "description": "Employee's first name",
                    "required": False,
                },
                {
                    "name": "last_name",
                    "description": "Employee's last name",
                    "required": False,
                },
                {"name": "role", "description": "Employee's role", "required": False},
                {
                    "name": "email",
                    "description": "Employee's email address",
                    "required": False,
                },
                {
                    "name": "phone",
                    "description": "Employee's phone number",
                    "required": False,
                },
                {
                    "name": "hourly_rate",
                    "description": "Employee's hourly rate",
                    "required": False,
                },
                {
                    "name": "max_hours",
                    "description": "Maximum hours per week",
                    "required": False,
                },
                {"name": "skills", "description": "List of skills", "required": False},
                {
                    "name": "active",
                    "description": "Whether the employee is active",
                    "required": False,
                },
            ],
        )

        self.tool(
            "delete_employee",
            description="Deactivate an employee",
            parameters=[
                {
                    "name": "employee_id",
                    "description": "ID of the employee to deactivate",
                    "required": True,
                }
            ],
        )

        # Schedule management tools
        self.tool(
            "generate_schedule",
            description="Generate a new schedule",
            parameters=[
                {
                    "name": "start_date",
                    "description": "Start date (YYYY-MM-DD)",
                    "required": True,
                },
                {
                    "name": "end_date",
                    "description": "End date (YYYY-MM-DD)",
                    "required": False,
                },
                {"name": "name", "description": "Schedule name", "required": False},
                {
                    "name": "employees",
                    "description": "List of employee IDs to include",
                    "required": False,
                },
                {
                    "name": "constraints",
                    "description": "Additional scheduling constraints",
                    "required": False,
                },
            ],
        )

        self.tool(
            "publish_schedule",
            description="Publish a schedule",
            parameters=[
                {
                    "name": "schedule_id",
                    "description": "ID of the schedule to publish",
                    "required": True,
                }
            ],
        )

        self.tool(
            "export_schedule_pdf",
            description="Export a schedule as PDF",
            parameters=[
                {
                    "name": "schedule_id",
                    "description": "ID of the schedule to export",
                    "required": True,
                },
                {
                    "name": "include_employee_details",
                    "description": "Include detailed employee information",
                    "required": False,
                },
                {
                    "name": "include_costs",
                    "description": "Include cost calculations",
                    "required": False,
                },
            ],
        )

        logger.info("Tools setup complete")

    def resource(self, url, description=""):
        """Register a resource endpoint."""
        self.resources[url] = {"description": description}
        return lambda f: f

    def tool(self, name, description="", parameters=None):
        """Register a tool with the specified name and parameters."""
        if parameters is None:
            parameters = []

        # Create wrapper for the tool
        def wrapper(*args, **kwargs):
            logger.info(f"Tool '{name}' called with args: {args}, kwargs: {kwargs}")
            if USING_REAL_BACKEND:
                method = getattr(Tools, name, None)
            else:
                # Map method name to SimpleTools equivalent if needed
                simple_method_name = name
                method = getattr(SimpleTools, simple_method_name, None)

            if method:
                try:
                    result = method(*args, **kwargs)
                    logger.info(f"Tool '{name}' result: {result}")
                    return result
                except Exception as e:
                    logger.error(
                        f"Error executing tool '{name}': {str(e)}\n{traceback.format_exc()}"
                    )
                    return {"success": False, "error": str(e)}
            else:
                logger.error(f"Tool method '{name}' not found")
                return {"success": False, "error": f"Tool method '{name}' not found"}

        # Set the wrapped function as an attribute
        setattr(self, name, wrapper)

        # Store metadata for the tool
        wrapper.__name__ = name
        wrapper.__doc__ = description
        wrapper.parameters = parameters

        return wrapper

    def run(self, *args, **kwargs):
        """
        Required method for MCP CLI integration.
        Returns the Flask application instance.
        """
        logger.info("MCP.run called with args: {}, kwargs: {}".format(args, kwargs))
        return app


# Create the MCP instance
mcp = MCP()
app.mcp = mcp

# If running directly, start the server
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", 8000))
    logger.info(f"Starting server on port {port}")
    app.run(debug=True, host="127.0.0.1", port=port)
