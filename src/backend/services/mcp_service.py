"""
FastMCP Service for Schichtplan Application

This service exposes core scheduling functionality through the Model Context Protocol,
enabling AI applications to interact with the shift planning system.
"""

import asyncio
import json
import logging
import threading
import traceback
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastmcp import Context, FastMCP
from flask import Flask

# Import Schichtplan models and services
from src.backend.models import (
    Absence,
    Coverage,
    Employee,
    EmployeeAvailability,
    Schedule,
    Settings,
    ShiftTemplate,
    db,
)


class SchichtplanMCPService:
    """FastMCP service for the Schichtplan application."""

    def __init__(self, flask_app: Optional[Flask] = None):
        self.flask_app = flask_app
        self.mcp = FastMCP("Schichtplan MCP Server")
        self.logger = logging.getLogger(__name__)

        # Register all tools
        self._register_tools()
        self._register_resources()
        self._register_prompts()

    def _register_tools(self):
        """Register all MCP tools."""

        @self.mcp.tool()
        async def get_server_info(ctx: Context = None) -> Dict[str, Any]:
            """Get detailed information about the MCP server.

            Returns:
                Server information including version, capabilities, and endpoints
            """
            try:
                server_info = {
                    "name": "Schichtplan MCP Server",
                    "version": "1.0.0",
                    "description": "Model Context Protocol server for Schichtplan shift scheduling application",
                    "author": "Schichtplan Development Team",
                    "protocol_version": "2024-11-05",
                    "server_capabilities": {
                        "tools": True,
                        "resources": True,
                        "prompts": True,
                        "logging": True,
                    },
                    "supported_transports": ["stdio", "sse", "streamable-http"],
                    "endpoints": {
                        "stdio": "Direct stdin/stdout communication",
                        "sse": "Server-Sent Events on configurable port (default: 8001)",
                        "http": "Streamable HTTP on configurable port (default: 8002)",
                    },
                    "features": [
                        "Employee management",
                        "Shift template management",
                        "Schedule generation (AI and traditional)",
                        "System status monitoring",
                        "Demo data generation",
                        "Schedule analysis and optimization",
                    ],
                    "system_requirements": {
                        "python": ">=3.8",
                        "database": "SQLite/PostgreSQL",
                        "dependencies": ["FastMCP", "Flask", "SQLAlchemy"],
                    },
                }

                if ctx:
                    await ctx.info("Server information retrieved successfully")

                return server_info

            except Exception as e:
                if ctx:
                    await ctx.error(f"Error getting server info: {str(e)}")
                raise

        @self.mcp.tool()
        async def get_capabilities(ctx: Context = None) -> Dict[str, Any]:
            """Get detailed capabilities and available tools of the MCP server.

            Returns:
                Comprehensive list of server capabilities, tools, resources, and prompts
            """
            try:
                capabilities = {
                    "tools": {
                        "get_server_info": {
                            "description": "Get server information and metadata",
                            "parameters": {},
                            "returns": "Server information object",
                        },
                        "get_capabilities": {
                            "description": "Get detailed server capabilities",
                            "parameters": {},
                            "returns": "Capabilities object",
                        },
                        "get_employees": {
                            "description": "Retrieve employee information",
                            "parameters": {
                                "active_only": "boolean - Filter for active employees only",
                                "include_details": "boolean - Include detailed employee information",
                            },
                            "returns": "List of employee objects",
                        },
                        "get_shift_templates": {
                            "description": "Retrieve shift template definitions",
                            "parameters": {
                                "active_only": "boolean - Filter for active shift templates only"
                            },
                            "returns": "List of shift template objects",
                        },
                        "generate_schedule": {
                            "description": "Generate new schedule for date range",
                            "parameters": {
                                "start_date": "string - Start date (YYYY-MM-DD)",
                                "end_date": "string - End date (YYYY-MM-DD)",
                                "use_ai": "boolean - Use AI-powered scheduling",
                                "version": "integer - Schedule version number",
                            },
                            "returns": "Schedule generation result",
                        },
                        "get_schedule": {
                            "description": "Retrieve existing schedule",
                            "parameters": {
                                "start_date": "string - Start date (YYYY-MM-DD)",
                                "end_date": "string - End date (YYYY-MM-DD)",
                                "version": "integer - Schedule version number",
                            },
                            "returns": "Schedule data with assignments",
                        },
                        "generate_demo_data": {
                            "description": "Generate demo data for testing",
                            "parameters": {
                                "employee_count": "integer - Number of employees to create",
                                "shift_count": "integer - Number of shift templates",
                                "coverage_blocks": "integer - Number of coverage requirements",
                            },
                            "returns": "Demo data generation result",
                        },
                        "get_system_status": {
                            "description": "Get system status and statistics",
                            "parameters": {},
                            "returns": "System status information",
                        },
                    },
                    "resources": {
                        "config://system": {
                            "description": "System configuration information",
                            "content_type": "application/json",
                        },
                        "employees://{employee_id}": {
                            "description": "Detailed employee information by ID",
                            "content_type": "application/json",
                            "parameters": {"employee_id": "integer - Employee ID"},
                        },
                    },
                    "prompts": {
                        "schedule_analysis_prompt": {
                            "description": "Generate AI prompt for schedule analysis",
                            "parameters": {
                                "schedule_data": "string - JSON schedule data"
                            },
                        },
                        "employee_scheduling_prompt": {
                            "description": "Generate AI prompt for employee scheduling",
                            "parameters": {
                                "employee_data": "string - JSON employee data",
                                "requirements": "string - Scheduling requirements",
                            },
                        },
                    },
                    "protocols": {
                        "mcp_version": "2024-11-05",
                        "implementation": "FastMCP",
                        "transports": ["stdio", "sse", "streamable-http"],
                    },
                    "ai_integration": {
                        "supported": True,
                        "models": "Compatible with OpenAI, Anthropic, and other MCP-supporting AI systems",
                        "use_cases": [
                            "Schedule optimization",
                            "Conflict resolution",
                            "Workload analysis",
                            "Compliance checking",
                            "Resource planning",
                        ],
                    },
                }

                if ctx:
                    await ctx.info("Capabilities information retrieved successfully")

                return capabilities

            except Exception as e:
                if ctx:
                    await ctx.error(f"Error getting capabilities: {str(e)}")
                raise

        @self.mcp.tool()
        async def mcp_health_check(ctx: Context = None) -> Dict[str, Any]:
            """Health check for MCP server connectivity and status.

            Returns:
                Health status information including server status and connectivity
            """
            try:
                with self.flask_app.app_context():
                    # Check database connectivity
                    db_healthy = True
                    db_error = None
                    try:
                        db.session.execute(db.text("SELECT 1"))
                        db.session.commit()
                    except Exception as e:
                        db_healthy = False
                        db_error = str(e)

                    # Check if tables exist
                    tables_exist = True
                    missing_tables = []
                    try:
                        for table_name in [
                            "employee",
                            "schedule",
                            "shift_template",
                            "settings",
                        ]:
                            result = db.session.execute(
                                db.text(
                                    "SELECT name FROM sqlite_master WHERE type='table' AND name=:table_name"
                                ),
                                {"table_name": table_name},
                            ).fetchone()
                            if not result:
                                tables_exist = False
                                missing_tables.append(table_name)
                    except Exception as e:
                        tables_exist = False
                        missing_tables = [f"Error checking tables: {str(e)}"]

                    health_status = {
                        "status": "healthy"
                        if db_healthy and tables_exist
                        else "degraded",
                        "timestamp": datetime.now().isoformat(),
                        "server_version": "1.0.0",
                        "database": {
                            "connected": db_healthy,
                            "error": db_error,
                            "tables_exist": tables_exist,
                            "missing_tables": missing_tables,
                        },
                        "services": {
                            "mcp_server": "running",
                            "flask_app": "initialized"
                            if self.flask_app
                            else "not_initialized",
                        },
                    }

                    if ctx:
                        status_msg = (
                            "MCP server is healthy"
                            if health_status["status"] == "healthy"
                            else "MCP server has issues"
                        )
                        await ctx.info(status_msg)

                    return health_status

            except Exception as e:
                error_response = {
                    "status": "unhealthy",
                    "timestamp": datetime.now().isoformat(),
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                }
                if ctx:
                    await ctx.error(f"Health check failed: {str(e)}")
                return error_response

        @self.mcp.tool()
        async def get_employee_availability(
            ctx: Context = None,
            employee_id: Optional[int] = None,
            start_date: Optional[str] = None,
            end_date: Optional[str] = None,
        ) -> Dict[str, Any]:
            """Get employee availability information for scheduling.

            Args:
                employee_id: Specific employee ID (optional)
                start_date: Start date for availability query (YYYY-MM-DD)
                end_date: End date for availability query (YYYY-MM-DD)

            Returns:
                Employee availability data
            """
            try:
                with self.flask_app.app_context():
                    query = EmployeeAvailability.query

                    if employee_id:
                        query = query.filter_by(employee_id=employee_id)

                    if start_date:
                        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                        # Filter by start_date and end_date range
                        query = query.filter(
                            (EmployeeAvailability.start_date.is_(None))
                            | (EmployeeAvailability.start_date <= start_dt)
                        )
                        query = query.filter(
                            (EmployeeAvailability.end_date.is_(None))
                            | (EmployeeAvailability.end_date >= start_dt)
                        )

                    if end_date:
                        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                        query = query.filter(
                            (EmployeeAvailability.end_date.is_(None))
                            | (EmployeeAvailability.end_date >= end_dt)
                        )
                        query = query.filter(
                            (EmployeeAvailability.start_date.is_(None))
                            | (EmployeeAvailability.start_date <= end_dt)
                        )

                    availability_records = query.all()

                    result = {
                        "availability_records": [],
                        "summary": {
                            "total_records": len(availability_records),
                            "employees_with_availability": len(
                                set(rec.employee_id for rec in availability_records)
                            ),
                            "date_range": {"start": start_date, "end": end_date},
                        },
                    }

                    for record in availability_records:
                        employee = Employee.query.get(record.employee_id)
                        result["availability_records"].append(
                            {
                                "employee_id": record.employee_id,
                                "employee_name": f"{employee.first_name} {employee.last_name}"
                                if employee
                                else "Unknown",
                                "start_date": record.start_date.strftime("%Y-%m-%d")
                                if record.start_date
                                else None,
                                "end_date": record.end_date.strftime("%Y-%m-%d")
                                if record.end_date
                                else None,
                                "day_of_week": record.day_of_week,
                                "hour": record.hour,
                                "is_available": record.is_available,
                                "availability_type": record.availability_type.value
                                if hasattr(record.availability_type, "value")
                                else str(record.availability_type),
                                # Remove preferred_shift and notes if not present
                            }
                        )

                    if ctx:
                        await ctx.info(
                            f"Retrieved {len(availability_records)} availability records"
                        )

                    return result

            except Exception as e:
                if ctx:
                    await ctx.error(f"Error getting employee availability: {str(e)}")
                raise

        @self.mcp.tool()
        async def get_absences(
            ctx: Context = None,
            employee_id: Optional[int] = None,
            start_date: Optional[str] = None,
            end_date: Optional[str] = None,
        ) -> Dict[str, Any]:
            """Get employee absence information.

            Args:
                employee_id: Specific employee ID (optional)
                start_date: Start date for absence query (YYYY-MM-DD)
                end_date: End date for absence query (YYYY-MM-DD)

            Returns:
                Employee absence data
            """
            try:
                with self.flask_app.app_context():
                    query = Absence.query

                    if employee_id:
                        query = query.filter_by(employee_id=employee_id)

                    if start_date:
                        start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                        query = query.filter(Absence.end_date >= start_dt)

                    if end_date:
                        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                        query = query.filter(Absence.start_date <= end_dt)

                    absences = query.all()

                    result = {
                        "absences": [],
                        "summary": {
                            "total_absences": len(absences),
                            "employees_with_absences": len(
                                set(abs_rec.employee_id for abs_rec in absences)
                            ),
                            "date_range": {"start": start_date, "end": end_date},
                        },
                    }

                    for absence in absences:
                        employee = Employee.query.get(absence.employee_id)
                        result["absences"].append(
                            {
                                "id": absence.id,
                                "employee_id": absence.employee_id,
                                "employee_name": employee.name
                                if employee
                                else "Unknown",
                                "start_date": absence.start_date.strftime("%Y-%m-%d"),
                                "end_date": absence.end_date.strftime("%Y-%m-%d"),
                                "reason": absence.reason,
                                "approved": absence.approved,
                                "notes": absence.notes,
                            }
                        )

                    if ctx:
                        await ctx.info(f"Retrieved {len(absences)} absence records")

                    return result

            except Exception as e:
                if ctx:
                    await ctx.error(f"Error getting absences: {str(e)}")
                raise

        @self.mcp.tool()
        async def get_coverage_requirements(
            ctx: Context = None, query_date: Optional[str] = None
        ) -> Dict[str, Any]:
            """Get coverage requirements for scheduling.

            Args:
                query_date: Specific date for coverage query (YYYY-MM-DD, optional)

            Returns:
                Coverage requirements data
            """
            try:
                with self.flask_app.app_context():
                    query = Coverage.query

                    if query_date:
                        date_obj = datetime.strptime(query_date, "%Y-%m-%d").date()
                        # Filter by day of week if date is provided
                        weekday = date_obj.weekday()  # 0=Monday, 6=Sunday
                        query = query.filter_by(day_of_week=weekday)

                    coverage_requirements = query.all()

                    result = {
                        "coverage_requirements": [],
                        "summary": {
                            "total_requirements": len(coverage_requirements),
                            "date_queried": query_date,
                        },
                    }

                    for coverage in coverage_requirements:
                        result["coverage_requirements"].append(
                            {
                                "id": coverage.id,
                                "day_of_week": coverage.day_of_week,
                                "day_name": [
                                    "Monday",
                                    "Tuesday",
                                    "Wednesday",
                                    "Thursday",
                                    "Friday",
                                    "Saturday",
                                    "Sunday",
                                ][coverage.day_of_week],
                                "time_slot": coverage.time_slot,
                                "required_employees": coverage.required_employees,
                                "required_keyholders": coverage.required_keyholders,
                                "shift_template_id": coverage.shift_template_id,
                            }
                        )

                    if ctx:
                        await ctx.info(
                            f"Retrieved {len(coverage_requirements)} coverage requirements"
                        )

                    return result

            except Exception as e:
                if ctx:
                    await ctx.error(f"Error getting coverage requirements: {str(e)}")
                raise

        @self.mcp.tool()
        async def analyze_schedule_conflicts(
            start_date: str, end_date: str, ctx: Context = None
        ) -> Dict[str, Any]:
            """Analyze schedule for conflicts and issues.

            Args:
                start_date: Start date for analysis (YYYY-MM-DD)
                end_date: End date for analysis (YYYY-MM-DD)

            Returns:
                Analysis results with conflicts and recommendations
            """
            try:
                with self.flask_app.app_context():
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    # Get schedules in date range
                    schedules = Schedule.query.filter(
                        Schedule.date >= start_dt, Schedule.date <= end_dt
                    ).all()

                    conflicts = []
                    warnings = []
                    statistics = {
                        "total_shifts": len(schedules),
                        "employees_scheduled": len(
                            set(s.employee_id for s in schedules if s.employee_id)
                        ),
                        "unassigned_shifts": len(
                            [s for s in schedules if not s.employee_id]
                        ),
                        "keyholder_shifts": len(
                            [
                                s
                                for s in schedules
                                if s.employee_id
                                and Employee.query.get(s.employee_id).is_keyholder
                            ]
                        ),
                    }

                    # Check for double bookings
                    employee_schedules = {}
                    for schedule in schedules:
                        if schedule.employee_id:
                            if schedule.employee_id not in employee_schedules:
                                employee_schedules[schedule.employee_id] = []
                            employee_schedules[schedule.employee_id].append(schedule)

                    for emp_id, emp_schedules in employee_schedules.items():
                        employee = Employee.query.get(emp_id)
                        emp_name = employee.name if employee else f"Employee {emp_id}"

                        # Group by date
                        by_date = {}
                        for schedule in emp_schedules:
                            date_key = schedule.date.strftime("%Y-%m-%d")
                            if date_key not in by_date:
                                by_date[date_key] = []
                            by_date[date_key].append(schedule)

                        # Check for conflicts on same date
                        for date_key, day_schedules in by_date.items():
                            if len(day_schedules) > 1:
                                shift_details = []
                                for schedule in day_schedules:
                                    shift_template = ShiftTemplate.query.get(
                                        schedule.shift_template_id
                                    )
                                    shift_name = (
                                        shift_template.name
                                        if shift_template
                                        else f"Shift {schedule.shift_template_id}"
                                    )
                                    shift_details.append(shift_name)

                                conflicts.append(
                                    {
                                        "type": "double_booking",
                                        "employee_id": emp_id,
                                        "employee_name": emp_name,
                                        "date": date_key,
                                        "shifts": shift_details,
                                        "severity": "high",
                                    }
                                )

                    # Check for missing keyholder coverage
                    coverage_days = {}
                    for schedule in schedules:
                        date_key = schedule.date.strftime("%Y-%m-%d")
                        if date_key not in coverage_days:
                            coverage_days[date_key] = {
                                "has_keyholder": False,
                                "total_staff": 0,
                            }

                        coverage_days[date_key]["total_staff"] += 1
                        if schedule.employee_id:
                            employee = Employee.query.get(schedule.employee_id)
                            if employee and employee.is_keyholder:
                                coverage_days[date_key]["has_keyholder"] = True

                    for date_key, coverage in coverage_days.items():
                        if (
                            coverage["total_staff"] > 0
                            and not coverage["has_keyholder"]
                        ):
                            warnings.append(
                                {
                                    "type": "missing_keyholder",
                                    "date": date_key,
                                    "staff_count": coverage["total_staff"],
                                    "severity": "medium",
                                }
                            )

                    result = {
                        "analysis_period": {
                            "start_date": start_date,
                            "end_date": end_date,
                        },
                        "statistics": statistics,
                        "conflicts": conflicts,
                        "warnings": warnings,
                        "summary": {
                            "total_conflicts": len(conflicts),
                            "total_warnings": len(warnings),
                            "overall_status": "critical"
                            if conflicts
                            else ("warning" if warnings else "good"),
                        },
                    }

                    if ctx:
                        status_msg = f"Found {len(conflicts)} conflicts and {len(warnings)} warnings"
                        await ctx.info(status_msg)

                    return result

            except Exception as e:
                if ctx:
                    await ctx.error(f"Error analyzing schedule conflicts: {str(e)}")
                raise

        @self.mcp.tool()
        async def get_schedule_statistics(
            start_date: str, end_date: str, ctx: Context = None
        ) -> Dict[str, Any]:
            """Get comprehensive schedule statistics for analysis.

            Args:
                start_date: Start date for statistics (YYYY-MM-DD)
                end_date: End date for statistics (YYYY-MM-DD)

            Returns:
                Detailed schedule statistics
            """
            try:
                with self.flask_app.app_context():
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    # Get schedules in date range
                    schedules = Schedule.query.filter(
                        Schedule.date >= start_dt, Schedule.date <= end_dt
                    ).all()

                    # Get all employees
                    employees = Employee.query.filter_by(is_active=True).all()

                    # Calculate employee workload distribution
                    employee_shifts = {}
                    for schedule in schedules:
                        if schedule.employee_id:
                            if schedule.employee_id not in employee_shifts:
                                employee_shifts[schedule.employee_id] = 0
                            employee_shifts[schedule.employee_id] += 1

                    workload_stats = []
                    for employee in employees:
                        shift_count = employee_shifts.get(employee.id, 0)
                        workload_stats.append(
                            {
                                "employee_id": employee.id,
                                "employee_name": employee.name,
                                "shift_count": shift_count,
                                "is_keyholder": employee.is_keyholder,
                            }
                        )

                    # Sort by shift count
                    workload_stats.sort(key=lambda x: x["shift_count"], reverse=True)

                    # Calculate shift type distribution
                    shift_types = {}
                    for schedule in schedules:
                        if schedule.shift_template_id:
                            template = ShiftTemplate.query.get(
                                schedule.shift_template_id
                            )
                            if template:
                                shift_name = template.name
                                if shift_name not in shift_types:
                                    shift_types[shift_name] = 0
                                shift_types[shift_name] += 1

                    # Calculate daily coverage
                    daily_coverage = {}
                    current_date = start_dt
                    while current_date <= end_dt:
                        date_key = current_date.strftime("%Y-%m-%d")
                        day_schedules = [s for s in schedules if s.date == current_date]

                        daily_coverage[date_key] = {
                            "total_shifts": len(day_schedules),
                            "assigned_shifts": len(
                                [s for s in day_schedules if s.employee_id]
                            ),
                            "unassigned_shifts": len(
                                [s for s in day_schedules if not s.employee_id]
                            ),
                            "keyholder_coverage": len(
                                [
                                    s
                                    for s in day_schedules
                                    if s.employee_id
                                    and Employee.query.get(s.employee_id).is_keyholder
                                ]
                            ),
                        }

                        current_date += timedelta(days=1)

                    result = {
                        "period": {
                            "start_date": start_date,
                            "end_date": end_date,
                            "total_days": (end_dt - start_dt).days + 1,
                        },
                        "overall_statistics": {
                            "total_shifts": len(schedules),
                            "assigned_shifts": len(
                                [s for s in schedules if s.employee_id]
                            ),
                            "unassigned_shifts": len(
                                [s for s in schedules if not s.employee_id]
                            ),
                            "total_employees": len(employees),
                            "active_employees": len(
                                [e for e in employees if e.id in employee_shifts]
                            ),
                            "keyholders": len([e for e in employees if e.is_keyholder]),
                        },
                        "workload_distribution": workload_stats,
                        "shift_type_distribution": shift_types,
                        "daily_coverage": daily_coverage,
                    }

                    if ctx:
                        await ctx.info(
                            f"Generated statistics for {len(schedules)} shifts over {result['period']['total_days']} days"
                        )

                    return result

            except Exception as e:
                if ctx:
                    await ctx.error(f"Error getting schedule statistics: {str(e)}")
                raise

        @self.mcp.tool()
        async def optimize_schedule_ai(
            start_date: str,
            end_date: str,
            optimization_goals: Optional[List[str]] = None,
            ctx: Context = None,
        ) -> Dict[str, Any]:
            """Use AI to optimize an existing schedule.

            Args:
                start_date: Start date for optimization (YYYY-MM-DD)
                end_date: End date for optimization (YYYY-MM-DD)
                optimization_goals: List of optimization goals (e.g., ['balance_workload', 'minimize_conflicts'])

            Returns:
                AI optimization results and recommendations
            """
            try:
                if not optimization_goals:
                    optimization_goals = [
                        "balance_workload",
                        "ensure_keyholder_coverage",
                        "minimize_conflicts",
                    ]

                with self.flask_app.app_context():
                    # Instead of calling self.get_schedule, directly query the database
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    current_schedules = Schedule.query.filter(
                        Schedule.date >= start_dt, Schedule.date <= end_dt
                    ).all()

                    current_schedule = {
                        "schedules": [
                            {
                                "id": s.id,
                                "employee_id": s.employee_id,
                                "shift_template_id": s.shift_template_id,
                                "date": s.date.strftime("%Y-%m-%d"),
                                "status": s.status,
                            }
                            for s in current_schedules
                        ],
                        "summary": {
                            "total_schedules": len(current_schedules),
                            "period": {"start_date": start_date, "end_date": end_date},
                        },
                    }

                    # Get conflicts analysis
                    conflicts = await analyze_schedule_conflicts(
                        start_date, end_date, ctx
                    )

                    # Get statistics
                    statistics = await get_schedule_statistics(
                        start_date, end_date, ctx
                    )

                    # Use fallback rule-based optimization
                    optimization_result = {
                        "status": "rule_based_optimization",
                        "message": "Applied rule-based optimization recommendations",
                        "recommendations": [],
                    }

                    # Generate basic recommendations based on conflicts
                    if conflicts["conflicts"]:
                        for conflict in conflicts["conflicts"]:
                            if conflict["type"] == "double_booking":
                                optimization_result["recommendations"].append(
                                    {
                                        "type": "resolve_conflict",
                                        "priority": "high",
                                        "description": f"Resolve double booking for {conflict['employee_name']} on {conflict['date']}",
                                        "action": "reassign_shift",
                                    }
                                )

                    if conflicts["warnings"]:
                        for warning in conflicts["warnings"]:
                            if warning["type"] == "missing_keyholder":
                                optimization_result["recommendations"].append(
                                    {
                                        "type": "assign_keyholder",
                                        "priority": "medium",
                                        "description": f"Assign keyholder for {warning['date']}",
                                        "action": "add_keyholder_shift",
                                    }
                                )

                    result = {
                        "optimization_period": {
                            "start_date": start_date,
                            "end_date": end_date,
                        },
                        "optimization_goals": optimization_goals,
                        "current_analysis": {
                            "schedule": current_schedule,
                            "conflicts": conflicts["summary"],
                            "statistics": statistics["overall_statistics"],
                        },
                        "optimization_result": optimization_result,
                        "timestamp": datetime.now().isoformat(),
                    }

                    if ctx:
                        await ctx.info(
                            f"AI optimization completed with {len(optimization_result.get('recommendations', []))} recommendations"
                        )

                    return result

            except Exception as e:
                if ctx:
                    await ctx.error(f"Error optimizing schedule: {str(e)}")
                raise

    def _register_resources(self):
        """Register MCP resources."""

        @self.mcp.resource("config://system")
        def get_system_config() -> str:
            """Get system configuration information."""
            try:
                with self.flask_app.app_context():
                    settings = Settings.query.first()
                    if settings:
                        config = {
                            "max_weekly_hours": settings.max_weekly_hours,
                            "min_rest_hours": settings.min_rest_hours,
                            "auto_assign_keyholders": settings.auto_assign_keyholders,
                            "enable_overtime_warnings": settings.enable_overtime_warnings,
                        }
                    else:
                        config = {"status": "No settings configured"}

                    return json.dumps(config, indent=2)
            except Exception as e:
                return json.dumps({"error": str(e)}, indent=2)

        @self.mcp.resource("employees://{employee_id}")
        def get_employee_details(employee_id: int) -> str:
            """Get detailed information about a specific employee."""
            try:
                with self.flask_app.app_context():
                    employee = Employee.query.get(employee_id)
                    if not employee:
                        return json.dumps({"error": "Employee not found"})

                    # Get availability and absence data
                    availability = EmployeeAvailability.query.filter_by(
                        employee_id=employee_id
                    ).all()
                    absences = Absence.query.filter_by(employee_id=employee_id).all()

                    data = {
                        "id": employee.id,
                        "name": employee.name,
                        "email": employee.email,
                        "phone": employee.phone,
                        "is_active": employee.is_active,
                        "is_keyholder": employee.is_keyholder,
                        "gfb_status": employee.gfb_status,
                        "color": employee.color,
                        "notes": employee.notes,
                        "availability_records": len(availability),
                        "absence_records": len(absences),
                        "recent_absences": [
                            {
                                "start_date": abs_rec.start_date.strftime("%Y-%m-%d"),
                                "end_date": abs_rec.end_date.strftime("%Y-%m-%d"),
                                "reason": abs_rec.reason,
                            }
                            for abs_rec in absences[-5:]  # Last 5 absences
                        ],
                    }

                    return json.dumps(data, indent=2)
            except Exception as e:
                return json.dumps({"error": str(e)}, indent=2)

        @self.mcp.resource("schedules://{start_date}/{end_date}")
        def get_schedule_resource(start_date: str, end_date: str) -> str:
            """Get schedule data for a specific date range."""
            try:
                with self.flask_app.app_context():
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    schedules = Schedule.query.filter(
                        Schedule.date >= start_dt, Schedule.date <= end_dt
                    ).all()

                    result = {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "schedules": [],
                    }

                    for schedule in schedules:
                        employee = (
                            Employee.query.get(schedule.employee_id)
                            if schedule.employee_id
                            else None
                        )
                        shift_template = (
                            ShiftTemplate.query.get(schedule.shift_template_id)
                            if schedule.shift_template_id
                            else None
                        )

                        result["schedules"].append(
                            {
                                "id": schedule.id,
                                "employee_id": schedule.employee_id,
                                "employee_name": employee.name
                                if employee
                                else "Unassigned",
                                "shift_template_id": schedule.shift_template_id,
                                "shift_name": shift_template.name
                                if shift_template
                                else "No shift",
                                "date": schedule.date.strftime("%Y-%m-%d"),
                                "status": schedule.status,
                                "version": schedule.version,
                            }
                        )

                    return json.dumps(result, indent=2)
            except Exception as e:
                return json.dumps({"error": str(e)}, indent=2)

        @self.mcp.resource("shift-templates://all")
        def get_shift_templates_resource() -> str:
            """Get all shift templates."""
            try:
                with self.flask_app.app_context():
                    shift_templates = ShiftTemplate.query.all()

                    result = {
                        "shift_templates": [],
                        "summary": {"total_templates": len(shift_templates)},
                    }

                    for template in shift_templates:
                        result["shift_templates"].append(
                            {
                                "id": template.id,
                                "name": template.name,
                                "start_time": template.start_time,
                                "end_time": template.end_time,
                                "duration_hours": template.duration_hours,
                                "is_active": template.is_active,
                                "requires_keyholder": template.requires_keyholder,
                                "description": template.description,
                            }
                        )

                    return json.dumps(result, indent=2)
            except Exception as e:
                return json.dumps({"error": str(e)}, indent=2)

        @self.mcp.resource("coverage://{day_of_week}")
        def get_coverage_resource(day_of_week: int) -> str:
            """Get coverage requirements for a specific day of week (0=Monday, 6=Sunday)."""
            try:
                with self.flask_app.app_context():
                    coverage_requirements = Coverage.query.filter_by(
                        day_of_week=day_of_week
                    ).all()

                    day_names = [
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                    ]
                    day_name = (
                        day_names[day_of_week] if 0 <= day_of_week <= 6 else "Unknown"
                    )

                    result = {
                        "day_of_week": day_of_week,
                        "day_name": day_name,
                        "coverage_requirements": [],
                    }

                    for coverage in coverage_requirements:
                        result["coverage_requirements"].append(
                            {
                                "id": coverage.id,
                                "time_slot": coverage.time_slot,
                                "required_employees": coverage.required_employees,
                                "required_keyholders": coverage.required_keyholders,
                                "shift_template_id": coverage.shift_template_id,
                            }
                        )

                    return json.dumps(result, indent=2)
            except Exception as e:
                return json.dumps({"error": str(e)}, indent=2)

        @self.mcp.resource("availability://{employee_id}/{date}")
        def get_employee_availability_resource(employee_id: int, date: str) -> str:
            """Get availability for a specific employee on a specific date."""
            try:
                with self.flask_app.app_context():
                    date_obj = datetime.strptime(date, "%Y-%m-%d").date()
                    employee = Employee.query.get(employee_id)

                    if not employee:
                        return json.dumps({"error": "Employee not found"}, indent=2)

                    availability = EmployeeAvailability.query.filter_by(
                        employee_id=employee_id, date=date_obj
                    ).first()

                    result = {
                        "employee": {
                            "id": employee.id,
                            "name": employee.name,
                            "is_active": employee.is_active,
                            "is_keyholder": employee.is_keyholder,
                        },
                        "date": date,
                        "availability": None,
                    }

                    if availability:
                        result["availability"] = {
                            "available": availability.available,
                            "preferred_shift": availability.preferred_shift,
                            "notes": availability.notes,
                        }

                    return json.dumps(result, indent=2)
            except Exception as e:
                return json.dumps({"error": str(e)}, indent=2)

        @self.mcp.resource("conflicts://{start_date}/{end_date}")
        def get_conflicts_resource(start_date: str, end_date: str) -> str:
            """Get schedule conflicts for a date range."""
            try:
                with self.flask_app.app_context():
                    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    # Get schedules in date range
                    schedules = Schedule.query.filter(
                        Schedule.date >= start_dt, Schedule.date <= end_dt
                    ).all()

                    conflicts = []
                    warnings = []

                    # Check for double bookings
                    employee_schedules = {}
                    for schedule in schedules:
                        if schedule.employee_id:
                            if schedule.employee_id not in employee_schedules:
                                employee_schedules[schedule.employee_id] = []
                            employee_schedules[schedule.employee_id].append(schedule)

                    for emp_id, emp_schedules in employee_schedules.items():
                        employee = Employee.query.get(emp_id)
                        emp_name = employee.name if employee else f"Employee {emp_id}"

                        # Group by date
                        by_date = {}
                        for schedule in emp_schedules:
                            date_key = schedule.date.strftime("%Y-%m-%d")
                            if date_key not in by_date:
                                by_date[date_key] = []
                            by_date[date_key].append(schedule)

                        # Check for conflicts on same date
                        for date_key, day_schedules in by_date.items():
                            if len(day_schedules) > 1:
                                shift_details = []
                                for schedule in day_schedules:
                                    shift_template = ShiftTemplate.query.get(
                                        schedule.shift_template_id
                                    )
                                    shift_name = (
                                        shift_template.name
                                        if shift_template
                                        else f"Shift {schedule.shift_template_id}"
                                    )
                                    shift_details.append(shift_name)

                                conflicts.append(
                                    {
                                        "type": "double_booking",
                                        "employee_id": emp_id,
                                        "employee_name": emp_name,
                                        "date": date_key,
                                        "shifts": shift_details,
                                        "severity": "high",
                                    }
                                )

                    result = {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "conflicts": conflicts,
                        "warnings": warnings,
                        "summary": {
                            "total_conflicts": len(conflicts),
                            "total_warnings": len(warnings),
                        },
                    }

                    return json.dumps(result, indent=2)
            except Exception as e:
                return json.dumps({"error": str(e)}, indent=2)

    def _register_prompts(self):
        """Register MCP prompts."""

        @self.mcp.prompt()
        def schedule_analysis_prompt(schedule_data: str) -> str:
            """Generate a prompt for analyzing schedule data.

            Args:
                schedule_data: JSON string containing schedule information

            Returns:
                Analysis prompt for AI
            """
            return f"""
Please analyze the following shift schedule data and provide insights:

{schedule_data}

Please provide analysis on:
1. Schedule coverage and gaps
2. Employee workload distribution
3. Keyholder coverage adequacy
4. Potential conflicts or issues
5. Optimization suggestions

Format your response with clear sections and actionable recommendations.
"""

        @self.mcp.prompt()
        def employee_scheduling_prompt(employee_data: str, requirements: str) -> str:
            """Generate a prompt for employee scheduling decisions.

            Args:
                employee_data: JSON string containing employee information
                requirements: Scheduling requirements and constraints

            Returns:
                Scheduling prompt for AI
            """
            return f"""
Given the following employee data and scheduling requirements, help optimize shift assignments:

Employee Data:
{employee_data}

Requirements:
{requirements}

Please suggest:
1. Optimal shift assignments
2. Coverage strategies
3. Workload balancing approaches
4. Conflict resolution
5. Compliance with labor regulations

Provide specific recommendations with reasoning.
"""

        @self.mcp.prompt()
        def schedule_optimization_prompt(
            current_schedule: str, conflicts: str, goals: str
        ) -> str:
            """Generate a prompt for AI-powered schedule optimization.

            Args:
                current_schedule: JSON string containing current schedule data
                conflicts: JSON string containing identified conflicts
                goals: Optimization goals and constraints

            Returns:
                Optimization prompt for AI
            """
            return f"""
You are an AI schedule optimization assistant for a shift planning system. Your task is to analyze the current schedule and provide optimization recommendations.

Current Schedule Data:
{current_schedule}

Identified Conflicts:
{conflicts}

Optimization Goals:
{goals}

Please provide:

1. **Conflict Resolution**:
   - Identify all scheduling conflicts (double bookings, coverage gaps, etc.)
   - Provide specific solutions for each conflict
   - Prioritize conflicts by severity and business impact

2. **Coverage Optimization**:
   - Ensure adequate staff coverage for all time slots
   - Verify keyholder coverage requirements are met
   - Balance workload distribution across employees

3. **Employee Satisfaction**:
   - Consider employee availability preferences
   - Minimize excessive overtime or underscheduling
   - Respect work-life balance constraints

4. **Operational Efficiency**:
   - Optimize shift transitions and handovers
   - Minimize gaps in coverage
   - Consider skill requirements for specific shifts

5. **Compliance Checks**:
   - Verify labor law compliance (rest periods, maximum hours)
   - Check contracted hours requirements
   - Ensure proper break scheduling

Provide your recommendations in the following format:
- **Priority Level**: High/Medium/Low
- **Action Required**: Specific action to take
- **Affected Employees**: List of employee IDs/names
- **Timeline**: When this should be implemented
- **Expected Impact**: Benefit of implementing this change

Focus on actionable, specific recommendations that can be implemented immediately.
"""

        @self.mcp.prompt()
        def conflict_resolution_prompt(conflict_data: str, employee_data: str) -> str:
            """Generate a prompt for resolving specific scheduling conflicts.

            Args:
                conflict_data: JSON string containing conflict details
                employee_data: JSON string containing relevant employee information

            Returns:
                Conflict resolution prompt for AI
            """
            return f"""
You are a scheduling conflict resolution specialist. Your task is to resolve the following scheduling conflicts using available employee resources.

Conflict Details:
{conflict_data}

Available Employee Resources:
{employee_data}

For each conflict, provide:

1. **Root Cause Analysis**:
   - Why did this conflict occur?
   - What scheduling rules were violated?
   - Are there systemic issues causing recurring conflicts?

2. **Resolution Options**:
   - Option A: Immediate quick fix
   - Option B: Optimal long-term solution
   - Option C: Alternative approach if constraints limit options

3. **Implementation Steps**:
   - Step-by-step instructions for implementing the resolution
   - Who needs to be notified of changes
   - When changes should take effect

4. **Prevention Strategies**:
   - How to prevent similar conflicts in the future
   - Recommended scheduling rule adjustments
   - Process improvements

5. **Impact Assessment**:
   - Effect on employee satisfaction
   - Operational impact
   - Cost implications if any

Prioritize solutions that maintain compliance, ensure adequate coverage, and respect employee preferences whenever possible.
"""

        @self.mcp.prompt()
        def workforce_planning_prompt(
            employee_data: str, forecast_data: str, constraints: str
        ) -> str:
            """Generate a prompt for strategic workforce planning.

            Args:
                employee_data: JSON string containing employee information and capabilities
                forecast_data: JSON string containing demand forecasts and historical data
                constraints: JSON string containing business constraints and requirements

            Returns:
                Workforce planning prompt for AI
            """
            return f"""
You are a strategic workforce planning consultant for a shift-based operation. Your task is to provide recommendations for optimal staffing and scheduling strategies.

Current Workforce:
{employee_data}

Demand Forecast & Historical Data:
{forecast_data}

Business Constraints:
{constraints}

Please analyze and provide recommendations for:

1. **Staffing Levels**:
   - Optimal number of employees per shift type
   - Recommended full-time vs part-time mix
   - Keyholder requirements and distribution

2. **Skill Development**:
   - Training needs identification
   - Cross-training opportunities
   - Succession planning for key roles

3. **Scheduling Efficiency**:
   - Best practices for shift patterns
   - Optimal rotation schedules
   - Work-life balance considerations

4. **Capacity Planning**:
   - Peak demand management strategies
   - Flexible staffing approaches
   - Contingency planning for absences

5. **Performance Optimization**:
   - KPIs for schedule effectiveness
   - Employee satisfaction metrics
   - Operational efficiency indicators

6. **Cost Optimization**:
   - Labor cost reduction opportunities
   - Overtime minimization strategies
   - Productivity improvement recommendations

Provide actionable insights with:
- Specific numerical recommendations where applicable
- Implementation timelines
- Expected ROI or impact metrics
- Risk assessment and mitigation strategies

Focus on sustainable, long-term improvements that benefit both the business and employees.
"""

        @self.mcp.prompt()
        def compliance_audit_prompt(
            schedule_data: str, regulations: str, policies: str
        ) -> str:
            """Generate a prompt for compliance auditing of schedules.

            Args:
                schedule_data: JSON string containing schedule information
                regulations: JSON string containing applicable labor regulations
                policies: JSON string containing company policies

            Returns:
                Compliance audit prompt for AI
            """
            return f"""
You are a compliance auditor specializing in labor law and workplace regulations. Your task is to audit the provided schedule for compliance violations and provide corrective recommendations.

Schedule to Audit:
{schedule_data}

Applicable Regulations:
{regulations}

Company Policies:
{policies}

Please conduct a comprehensive compliance audit covering:

1. **Labor Law Compliance**:
   - Maximum working hours per day/week
   - Minimum rest periods between shifts
   - Break requirements during shifts
   - Overtime regulations and limits

2. **Contract Compliance**:
   - Contracted hours fulfillment
   - Part-time vs full-time designation accuracy
   - Minimum guaranteed hours

3. **Health & Safety Regulations**:
   - Maximum consecutive working days
   - Night shift limitations
   - Fatigue management protocols
   - Special requirements for specific roles

4. **Company Policy Adherence**:
   - Internal scheduling policies
   - Availability request handling
   - Shift change procedures
   - Holiday and vacation scheduling

5. **Documentation Requirements**:
   - Required record keeping
   - Approval workflows
   - Change logging and audit trails

For each potential violation found, provide:
- **Violation Type**: Specific regulation or policy violated
- **Severity Level**: Critical/High/Medium/Low
- **Affected Employees**: Who is impacted
- **Corrective Action**: Specific steps to resolve
- **Prevention Measures**: How to avoid future violations
- **Timeline**: When correction must be implemented

Also provide an overall compliance score and risk assessment for the current scheduling practices.
"""

    def get_mcp_server(self) -> FastMCP:
        """Get the FastMCP server instance."""
        return self.mcp

    async def run_stdio(self):
        """Run the MCP server in stdio mode."""
        try:
            await self.mcp.run(transport="stdio")
        except RuntimeError as e:
            if "Already running" in str(e) and "in this thread" in str(e):
                # Handle the case where asyncio is already running
                def run_in_new_thread():
                    # Create a new event loop in a separate thread
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        new_loop.run_until_complete(self.mcp.run(transport="stdio"))
                    finally:
                        new_loop.close()

                # Run in a separate thread to avoid the event loop conflict
                thread = threading.Thread(target=run_in_new_thread)
                thread.daemon = True
                thread.start()
                thread.join()
            else:
                raise

    async def run_sse(self, host: str = "127.0.0.1", port: int = 8001):
        """Run the MCP server in SSE mode."""
        try:
            await self.mcp.run(transport="sse", host=host, port=port)
        except RuntimeError as e:
            if "Already running" in str(e) and "in this thread" in str(e):
                # Handle the case where asyncio is already running
                def run_in_new_thread():
                    # Create a new event loop in a separate thread
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        new_loop.run_until_complete(
                            self.mcp.run(transport="sse", host=host, port=port)
                        )
                    finally:
                        new_loop.close()

                # Run in a separate thread to avoid the event loop conflict
                thread = threading.Thread(target=run_in_new_thread)
                thread.daemon = True
                thread.start()
                thread.join()
            else:
                raise

    async def run_streamable_http(self, host: str = "127.0.0.1", port: int = 8002):
        """Run the MCP server in streamable HTTP mode."""
        try:
            await self.mcp.run(transport="streamable-http", host=host, port=port)
        except RuntimeError as e:
            if "Already running" in str(e) and "in this thread" in str(e):
                # Handle the case where asyncio is already running
                def run_in_new_thread():
                    # Create a new event loop in a separate thread
                    new_loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(new_loop)
                    try:
                        new_loop.run_until_complete(
                            self.mcp.run(
                                transport="streamable-http", host=host, port=port
                            )
                        )
                    finally:
                        new_loop.close()

                # Run in a separate thread to avoid the event loop conflict
                thread = threading.Thread(target=run_in_new_thread)
                thread.daemon = True
                thread.start()
                thread.join()
            else:
                raise
