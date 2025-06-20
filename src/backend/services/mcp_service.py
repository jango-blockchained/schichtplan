"""
FastMCP Service for Schichtplan Application

This service exposes core scheduling functionality through the Model Context Protocol,
enabling AI applications to interact with the shift planning system.
"""

import asyncio
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
                            "employees",
                            "schedules",
                            "shifts",
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
                                "employee_name": f"{employee.first_name} {employee.last_name}"
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
                        query = query.filter_by(day_index=weekday)

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
                                "day_of_week": coverage.day_index,
                                "day_name": [
                                    "Monday",
                                    "Tuesday",
                                    "Wednesday",
                                    "Thursday",
                                    "Friday",
                                    "Saturday",
                                    "Sunday",
                                ][coverage.day_index],
                                "time_slot": f"{coverage.start_time}-{coverage.end_time}",
                                "required_employees": coverage.min_employees,
                                "required_keyholders": 1
                                if coverage.requires_keyholder
                                else 0,
                                "shift_template_id": getattr(
                                    coverage, "shift_template_id", None
                                ),
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
                                "employee_name": f"{employee.first_name} {employee.last_name}",
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

        # Phase 2.1: Enhanced Schedule Analysis Tools

        @self.mcp.tool()
        async def analyze_partial_schedule(
            ctx: Context,
            start_date: str,
            end_date: str,
            completion_threshold: float = 0.8,
        ) -> Dict[str, Any]:
            """Analyze partially built schedule and suggest next steps for completion.

            Args:
                start_date: Start date for analysis (YYYY-MM-DD)
                end_date: End date for analysis (YYYY-MM-DD)
                completion_threshold: Minimum completion ratio to consider acceptable (0.0-1.0)

            Returns:
                Analysis of partial schedule with completion suggestions
            """
            try:
                with self.flask_app.app_context():
                    # Get current schedule
                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    # Get coverage requirements
                    coverage_reqs = Coverage.query.all()

                    # Analyze completion by date
                    completion_analysis = {}
                    current_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    while current_date <= end_dt:
                        date_str = current_date.strftime("%Y-%m-%d")
                        day_schedules = [s for s in schedules if s.date == current_date]

                        # Calculate completion ratio
                        required_shifts = len(coverage_reqs)  # Simplified
                        assigned_shifts = len(day_schedules)
                        completion_ratio = assigned_shifts / max(required_shifts, 1)

                        # Determine status
                        status = (
                            "complete"
                            if completion_ratio >= completion_threshold
                            else "incomplete"
                        )
                        if completion_ratio == 0:
                            status = "empty"
                        elif completion_ratio < 0.5:
                            status = "minimal"

                        completion_analysis[date_str] = {
                            "completion_ratio": round(completion_ratio, 2),
                            "required_shifts": required_shifts,
                            "assigned_shifts": assigned_shifts,
                            "missing_shifts": max(0, required_shifts - assigned_shifts),
                            "status": status,
                            "schedules": [
                                {
                                    "id": s.id,
                                    "employee_id": s.employee_id,
                                    "shift_template_id": s.shift_template_id,
                                    "status": s.status,
                                }
                                for s in day_schedules
                            ],
                        }
                        current_date += timedelta(days=1)

                    # Generate completion suggestions
                    suggestions = []
                    incomplete_days = [
                        date
                        for date, analysis in completion_analysis.items()
                        if analysis["completion_ratio"] < completion_threshold
                    ]

                    if incomplete_days:
                        suggestions.append(
                            {
                                "type": "prioritize_completion",
                                "priority": "high",
                                "description": f"Focus on completing {len(incomplete_days)} incomplete days",
                                "affected_dates": incomplete_days,
                                "action": "assign_missing_shifts",
                            }
                        )

                        # Suggest starting with most critical days
                        empty_days = [
                            date
                            for date, analysis in completion_analysis.items()
                            if analysis["status"] == "empty"
                        ]
                        if empty_days:
                            suggestions.append(
                                {
                                    "type": "fill_empty_days",
                                    "priority": "urgent",
                                    "description": f"Start with {len(empty_days)} completely empty days",
                                    "affected_dates": empty_days[
                                        :3
                                    ],  # Top 3 most urgent
                                    "action": "create_basic_coverage",
                                }
                            )

                    # Overall completion metrics
                    total_completion = sum(
                        analysis["completion_ratio"]
                        for analysis in completion_analysis.values()
                    ) / len(completion_analysis)

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "overall_completion": round(total_completion, 2),
                        "completion_threshold": completion_threshold,
                        "daily_analysis": completion_analysis,
                        "suggestions": suggestions,
                        "summary": {
                            "total_days": len(completion_analysis),
                            "complete_days": len(
                                [
                                    a
                                    for a in completion_analysis.values()
                                    if a["status"] == "complete"
                                ]
                            ),
                            "incomplete_days": len(incomplete_days),
                            "empty_days": len(
                                [
                                    a
                                    for a in completion_analysis.values()
                                    if a["status"] == "empty"
                                ]
                            ),
                        },
                        "next_steps": suggestions[:3]
                        if suggestions
                        else [
                            {
                                "type": "schedule_complete",
                                "priority": "info",
                                "description": "Schedule appears to be sufficiently complete",
                                "action": "review_and_finalize",
                            }
                        ],
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error analyzing partial schedule: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }

        @self.mcp.tool()
        async def suggest_schedule_improvements(
            ctx: Context,
            start_date: str,
            end_date: str,
            focus_areas: Optional[List[str]] = None,
            max_suggestions: int = 10,
        ) -> Dict[str, Any]:
            """Suggest improvements for existing schedule based on analysis.

            Args:
                start_date: Start date for analysis (YYYY-MM-DD)
                end_date: End date for analysis (YYYY-MM-DD)
                focus_areas: Specific areas to focus on ['workload', 'coverage', 'fairness', 'compliance']
                max_suggestions: Maximum number of suggestions to return

            Returns:
                Prioritized list of schedule improvement suggestions
            """
            try:
                with self.flask_app.app_context():
                    # Set default focus areas if not provided
                    if focus_areas is None:
                        focus_areas = ["workload", "coverage", "fairness", "compliance"]

                    suggestions = []

                    # Get current schedule and statistics
                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    employees = Employee.query.filter_by(is_active=True).all()

                    # Workload analysis
                    if "workload" in focus_areas:
                        employee_hours = {}
                        for schedule in schedules:
                            emp_id = schedule.employee_id
                            if emp_id not in employee_hours:
                                employee_hours[emp_id] = 0
                            # Simplified: assume 8 hours per shift
                            employee_hours[emp_id] += 8

                        if employee_hours:
                            hours_values = list(employee_hours.values())
                            avg_hours = sum(hours_values) / len(hours_values)
                            max_hours = max(hours_values)
                            min_hours = min(hours_values)

                            # Check for workload imbalance
                            if max_hours - min_hours > avg_hours * 0.3:  # 30% deviation
                                overworked = [
                                    emp_id
                                    for emp_id, hours in employee_hours.items()
                                    if hours > avg_hours * 1.2
                                ]
                                underworked = [
                                    emp_id
                                    for emp_id, hours in employee_hours.items()
                                    if hours < avg_hours * 0.8
                                ]

                                if overworked:
                                    suggestions.append(
                                        {
                                            "type": "balance_workload",
                                            "category": "workload",
                                            "priority": "high",
                                            "description": f"Redistribute shifts from {len(overworked)} overworked employees",
                                            "affected_employees": overworked,
                                            "impact": "Improve work-life balance and reduce burnout",
                                            "action": "redistribute_shifts",
                                            "estimated_effort": "medium",
                                        }
                                    )

                                if underworked and overworked:
                                    suggestions.append(
                                        {
                                            "type": "optimize_distribution",
                                            "category": "workload",
                                            "priority": "medium",
                                            "description": "Move shifts from overworked to underworked employees",
                                            "affected_employees": overworked
                                            + underworked,
                                            "impact": "Better workload distribution across team",
                                            "action": "transfer_shifts",
                                            "estimated_effort": "low",
                                        }
                                    )

                    # Coverage analysis
                    if "coverage" in focus_areas:
                        # Check for coverage gaps by analyzing shifts per day
                        daily_coverage = {}
                        for schedule in schedules:
                            date_str = schedule.date.strftime("%Y-%m-%d")
                            if date_str not in daily_coverage:
                                daily_coverage[date_str] = 0
                            daily_coverage[date_str] += 1

                        avg_coverage = (
                            sum(daily_coverage.values()) / len(daily_coverage)
                            if daily_coverage
                            else 0
                        )
                        low_coverage_days = [
                            date
                            for date, count in daily_coverage.items()
                            if count < avg_coverage * 0.7
                        ]

                        if low_coverage_days:
                            suggestions.append(
                                {
                                    "type": "improve_coverage",
                                    "category": "coverage",
                                    "priority": "high",
                                    "description": f"Increase coverage for {len(low_coverage_days)} under-staffed days",
                                    "affected_dates": low_coverage_days[
                                        :5
                                    ],  # Show first 5
                                    "impact": "Ensure adequate staffing levels",
                                    "action": "add_shifts",
                                    "estimated_effort": "medium",
                                }
                            )

                    # Fairness analysis
                    if "fairness" in focus_areas:
                        # Check weekend distribution
                        weekend_assignments = {}
                        for schedule in schedules:
                            if schedule.date.weekday() >= 5:  # Saturday = 5, Sunday = 6
                                emp_id = schedule.employee_id
                                weekend_assignments[emp_id] = (
                                    weekend_assignments.get(emp_id, 0) + 1
                                )

                        if weekend_assignments:
                            max_weekends = max(weekend_assignments.values())
                            min_weekends = min(weekend_assignments.values())

                            if max_weekends - min_weekends > 2:  # Unfair distribution
                                suggestions.append(
                                    {
                                        "type": "balance_weekends",
                                        "category": "fairness",
                                        "priority": "medium",
                                        "description": "Redistribute weekend shifts more fairly",
                                        "impact": "Improve fairness in weekend assignments",
                                        "action": "rebalance_weekends",
                                        "estimated_effort": "medium",
                                    }
                                )

                    # Compliance analysis
                    if "compliance" in focus_areas:
                        # Check for potential compliance issues
                        consecutive_days = {}
                        for employee in employees:
                            emp_schedules = [
                                s for s in schedules if s.employee_id == employee.id
                            ]
                            emp_schedules.sort(key=lambda x: x.date)

                            current_streak = 0
                            max_streak = 0
                            prev_date = None

                            for schedule in emp_schedules:
                                if prev_date and (schedule.date - prev_date).days == 1:
                                    current_streak += 1
                                else:
                                    current_streak = 1
                                max_streak = max(max_streak, current_streak)
                                prev_date = schedule.date

                            if max_streak > 6:  # More than 6 consecutive days
                                consecutive_days[employee.id] = max_streak

                        if consecutive_days:
                            suggestions.append(
                                {
                                    "type": "fix_compliance",
                                    "category": "compliance",
                                    "priority": "urgent",
                                    "description": f"Address excessive consecutive working days for {len(consecutive_days)} employees",
                                    "affected_employees": list(consecutive_days.keys()),
                                    "impact": "Ensure compliance with labor regulations",
                                    "action": "add_rest_days",
                                    "estimated_effort": "high",
                                }
                            )

                    # Sort suggestions by priority
                    priority_order = {
                        "urgent": 0,
                        "high": 1,
                        "medium": 2,
                        "low": 3,
                        "info": 4,
                    }
                    suggestions.sort(key=lambda x: priority_order.get(x["priority"], 3))

                    # Limit suggestions
                    suggestions = suggestions[:max_suggestions]

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "focus_areas": focus_areas,
                        "suggestions": suggestions,
                        "summary": {
                            "total_suggestions": len(suggestions),
                            "urgent": len(
                                [s for s in suggestions if s["priority"] == "urgent"]
                            ),
                            "high": len(
                                [s for s in suggestions if s["priority"] == "high"]
                            ),
                            "medium": len(
                                [s for s in suggestions if s["priority"] == "medium"]
                            ),
                            "low": len(
                                [s for s in suggestions if s["priority"] == "low"]
                            ),
                        },
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error generating schedule improvements: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }

        # Phase 2.1.2: Employee Management Tools

        @self.mcp.tool()
        async def analyze_employee_workload(
            ctx: Context,
            start_date: str,
            end_date: str,
            employee_id: Optional[int] = None,
            include_recommendations: bool = True,
        ) -> Dict[str, Any]:
            """Analyze employee workload distribution and provide recommendations.

            Args:
                start_date: Start date for analysis (YYYY-MM-DD)
                end_date: End date for analysis (YYYY-MM-DD)
                employee_id: Specific employee ID to analyze (optional, analyzes all if not provided)
                include_recommendations: Whether to include optimization recommendations

            Returns:
                Detailed workload analysis with recommendations
            """
            try:
                with self.flask_app.app_context():
                    # Get schedules for the period
                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    # Get employees
                    if employee_id:
                        employees = [Employee.query.get(employee_id)]
                        if not employees[0]:
                            return {"error": f"Employee {employee_id} not found"}
                    else:
                        employees = Employee.query.filter_by(is_active=True).all()

                    workload_analysis = {}
                    period_days = (
                        datetime.strptime(end_date, "%Y-%m-%d")
                        - datetime.strptime(start_date, "%Y-%m-%d")
                    ).days + 1

                    for employee in employees:
                        emp_schedules = [
                            s for s in schedules if s.employee_id == employee.id
                        ]

                        # Calculate basic metrics
                        total_shifts = len(emp_schedules)
                        estimated_hours = total_shifts * 8  # Assume 8 hours per shift
                        shifts_per_week = (
                            (total_shifts / period_days) * 7 if period_days > 0 else 0
                        )

                        # Analyze shift distribution
                        weekday_shifts = sum(
                            1 for s in emp_schedules if s.date.weekday() < 5
                        )
                        weekend_shifts = sum(
                            1 for s in emp_schedules if s.date.weekday() >= 5
                        )

                        # Check for consecutive work patterns
                        emp_schedules_sorted = sorted(
                            emp_schedules, key=lambda x: x.date
                        )
                        consecutive_streaks = []
                        current_streak = 0
                        prev_date = None

                        for schedule in emp_schedules_sorted:
                            if prev_date and (schedule.date - prev_date).days == 1:
                                current_streak += 1
                            else:
                                if current_streak > 0:
                                    consecutive_streaks.append(current_streak + 1)
                                current_streak = 0
                            prev_date = schedule.date

                        if current_streak > 0:
                            consecutive_streaks.append(current_streak + 1)

                        max_consecutive = (
                            max(consecutive_streaks) if consecutive_streaks else 0
                        )
                        avg_consecutive = (
                            sum(consecutive_streaks) / len(consecutive_streaks)
                            if consecutive_streaks
                            else 0
                        )

                        # Workload assessment
                        workload_level = "normal"
                        if shifts_per_week > 6:
                            workload_level = "high"
                        elif shifts_per_week > 4:
                            workload_level = "moderate"
                        elif shifts_per_week < 2:
                            workload_level = "low"

                        workload_analysis[employee.id] = {
                            "employee": {
                                "id": employee.id,
                                "name": f"{employee.first_name} {employee.last_name}",
                                "position": employee.position,
                                "is_active": employee.is_active,
                            },
                            "workload_metrics": {
                                "total_shifts": total_shifts,
                                "estimated_hours": estimated_hours,
                                "shifts_per_week": round(shifts_per_week, 1),
                                "weekday_shifts": weekday_shifts,
                                "weekend_shifts": weekend_shifts,
                                "weekend_ratio": round(
                                    weekend_shifts / max(total_shifts, 1), 2
                                ),
                            },
                            "work_patterns": {
                                "max_consecutive_days": max_consecutive,
                                "avg_consecutive_days": round(avg_consecutive, 1),
                                "total_streaks": len(consecutive_streaks),
                                "consecutive_streaks": consecutive_streaks,
                            },
                            "workload_assessment": {
                                "level": workload_level,
                                "utilization_ratio": round(
                                    shifts_per_week / 5, 2
                                ),  # Assuming 5-day work week as 100%
                                "balance_score": self._calculate_workload_balance_score(
                                    shifts_per_week,
                                    max_consecutive,
                                    weekend_shifts / max(total_shifts, 1),
                                ),
                            },
                        }

                    # Generate recommendations if requested
                    recommendations = []
                    if include_recommendations and workload_analysis:
                        # Find workload imbalances
                        workloads = [
                            data["workload_metrics"]["shifts_per_week"]
                            for data in workload_analysis.values()
                        ]
                        avg_workload = (
                            sum(workloads) / len(workloads) if workloads else 0
                        )

                        overloaded = [
                            emp_id
                            for emp_id, data in workload_analysis.items()
                            if data["workload_metrics"]["shifts_per_week"]
                            > avg_workload * 1.3
                        ]

                        underloaded = [
                            emp_id
                            for emp_id, data in workload_analysis.items()
                            if data["workload_metrics"]["shifts_per_week"]
                            < avg_workload * 0.7
                        ]

                        if overloaded:
                            recommendations.append(
                                {
                                    "type": "reduce_workload",
                                    "priority": "high",
                                    "description": f"Reduce workload for {len(overloaded)} overloaded employees",
                                    "affected_employees": overloaded,
                                    "action": "redistribute_shifts",
                                    "impact": "Prevent burnout and improve work-life balance",
                                }
                            )

                        if underloaded and overloaded:
                            recommendations.append(
                                {
                                    "type": "balance_distribution",
                                    "priority": "medium",
                                    "description": "Redistribute shifts from overloaded to underloaded employees",
                                    "affected_employees": overloaded + underloaded,
                                    "action": "transfer_shifts",
                                    "impact": "More equitable workload distribution",
                                }
                            )

                        # Check for compliance issues
                        compliance_issues = [
                            emp_id
                            for emp_id, data in workload_analysis.items()
                            if data["work_patterns"]["max_consecutive_days"] > 6
                        ]

                        if compliance_issues:
                            recommendations.append(
                                {
                                    "type": "fix_compliance",
                                    "priority": "urgent",
                                    "description": f"Address consecutive work day violations for {len(compliance_issues)} employees",
                                    "affected_employees": compliance_issues,
                                    "action": "add_rest_days",
                                    "impact": "Ensure labor law compliance",
                                }
                            )

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "analysis_scope": "single_employee"
                        if employee_id
                        else "all_employees",
                        "employee_count": len(workload_analysis),
                        "workload_analysis": workload_analysis,
                        "recommendations": recommendations,
                        "summary": {
                            "avg_shifts_per_week": round(
                                sum(
                                    data["workload_metrics"]["shifts_per_week"]
                                    for data in workload_analysis.values()
                                )
                                / len(workload_analysis),
                                1,
                            )
                            if workload_analysis
                            else 0,
                            "high_workload_employees": len(
                                [
                                    data
                                    for data in workload_analysis.values()
                                    if data["workload_assessment"]["level"] == "high"
                                ]
                            ),
                            "low_workload_employees": len(
                                [
                                    data
                                    for data in workload_analysis.values()
                                    if data["workload_assessment"]["level"] == "low"
                                ]
                            ),
                        },
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error analyzing employee workload: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }

        @self.mcp.tool()
        async def suggest_employee_assignments(
            ctx: Context,
            start_date: str,
            end_date: str,
            criteria: Optional[List[str]] = None,
            max_suggestions: int = 10,
        ) -> Dict[str, Any]:
            """Suggest optimal employee assignments for open shifts with reasoning.

            Args:
                start_date: Start date for suggestions (YYYY-MM-DD)
                end_date: End date for suggestions (YYYY-MM-DD)
                criteria: Assignment criteria ['availability', 'skills', 'fairness', 'cost']
                max_suggestions: Maximum number of suggestions to return

            Returns:
                Prioritized assignment suggestions with detailed reasoning
            """
            try:
                with self.flask_app.app_context():
                    if criteria is None:
                        criteria = ["availability", "skills", "fairness", "cost"]

                    # Get current schedules and available employees
                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    employees = Employee.query.filter_by(is_active=True).all()
                    coverage_reqs = Coverage.query.all()

                    suggestions = []

                    # Analyze gaps in coverage
                    current_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    while current_date <= end_dt and len(suggestions) < max_suggestions:
                        date_str = current_date.strftime("%Y-%m-%d")
                        day_schedules = [s for s in schedules if s.date == current_date]
                        assigned_employees = {s.employee_id for s in day_schedules}

                        # Find available employees for this date
                        available_employees = []
                        for employee in employees:
                            if employee.id not in assigned_employees:
                                # Check availability if criteria includes it
                                if "availability" in criteria:
                                    # Simplified availability check
                                    availability = EmployeeAvailability.query.filter_by(
                                        employee_id=employee.id,
                                        day_of_week=current_date.weekday(),
                                    ).first()

                                    if availability and availability.is_available:
                                        available_employees.append(employee)
                                else:
                                    available_employees.append(employee)

                        # If we have coverage requirements and available employees
                        if (
                            len(day_schedules) < len(coverage_reqs)
                            and available_employees
                        ):
                            # Score each available employee
                            employee_scores = []

                            for employee in available_employees:
                                score = 0
                                reasoning = []

                                # Availability scoring
                                if "availability" in criteria:
                                    availability = EmployeeAvailability.query.filter_by(
                                        employee_id=employee.id,
                                        day_of_week=current_date.weekday(),
                                    ).first()
                                    if availability and availability.is_available:
                                        score += 30
                                        reasoning.append(
                                            "Available on this day of week"
                                        )
                                    else:
                                        score += 10  # Still possible but not preferred
                                        reasoning.append(
                                            "Not typically available this day"
                                        )

                                # Fairness scoring (workload balance)
                                if "fairness" in criteria:
                                    emp_schedules_count = len(
                                        [
                                            s
                                            for s in schedules
                                            if s.employee_id == employee.id
                                        ]
                                    )
                                    avg_schedules = (
                                        len(schedules) / len(employees)
                                        if employees
                                        else 0
                                    )

                                    if emp_schedules_count < avg_schedules:
                                        score += 25
                                        reasoning.append(
                                            "Below average workload - good for fairness"
                                        )
                                    elif emp_schedules_count > avg_schedules * 1.2:
                                        score -= 15
                                        reasoning.append("Above average workload")
                                    else:
                                        score += 10
                                        reasoning.append("Balanced workload")

                                # Skills/position scoring
                                if "skills" in criteria:
                                    if employee.position:
                                        score += 15
                                        reasoning.append(
                                            f"Has defined position: {employee.position}"
                                        )
                                    else:
                                        score += 5
                                        reasoning.append("General position")

                                # Cost considerations
                                if "cost" in criteria:
                                    # Simplified cost model based on position/seniority
                                    if (
                                        employee.position
                                        and "senior" in employee.position.lower()
                                    ):
                                        score -= 5
                                        reasoning.append(
                                            "Higher cost (senior position)"
                                        )
                                    else:
                                        score += 10
                                        reasoning.append("Standard cost")

                                employee_scores.append(
                                    {
                                        "employee": employee,
                                        "score": score,
                                        "reasoning": reasoning,
                                    }
                                )

                            # Sort by score and create suggestions
                            employee_scores.sort(key=lambda x: x["score"], reverse=True)

                            for i, emp_data in enumerate(
                                employee_scores[:3]
                            ):  # Top 3 for each day
                                employee = emp_data["employee"]
                                suggestions.append(
                                    {
                                        "type": "assign_employee",
                                        "priority": "high" if i == 0 else "medium",
                                        "date": date_str,
                                        "employee": {
                                            "id": employee.id,
                                            "name": f"{employee.first_name} {employee.last_name}",
                                            "position": employee.position,
                                        },
                                        "score": emp_data["score"],
                                        "reasoning": emp_data["reasoning"],
                                        "impact": f"Fill coverage gap for {date_str}",
                                        "action": "create_schedule_assignment",
                                        "confidence": min(
                                            emp_data["score"] / 80, 1.0
                                        ),  # Normalize to 0-1
                                    }
                                )

                        current_date += timedelta(days=1)

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "criteria": criteria,
                        "suggestions": suggestions[:max_suggestions],
                        "summary": {
                            "total_suggestions": len(suggestions),
                            "high_priority": len(
                                [s for s in suggestions if s["priority"] == "high"]
                            ),
                            "medium_priority": len(
                                [s for s in suggestions if s["priority"] == "medium"]
                            ),
                            "low_priority": len(
                                [s for s in suggestions if s["priority"] == "low"]
                            ),
                            "avg_confidence": round(
                                sum(s["confidence"] for s in suggestions)
                                / len(suggestions),
                                2,
                            )
                            if suggestions
                            else 0,
                        },
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error suggesting employee assignments: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }

        # Phase 2.1.3: Coverage Optimization Tools

        @self.mcp.tool()
        async def suggest_coverage_improvements(
            ctx: Context,
            start_date: str,
            end_date: str,
            coverage_targets: Optional[Dict[str, int]] = None,
            optimization_focus: Optional[List[str]] = None,
        ) -> Dict[str, Any]:
            """Suggest improvements to schedule coverage based on requirements analysis.

            Args:
                start_date: Start date for analysis (YYYY-MM-DD)
                end_date: End date for analysis (YYYY-MM-DD)
                coverage_targets: Target coverage levels per day type {'weekday': 3, 'weekend': 2}
                optimization_focus: Focus areas ['minimum_coverage', 'peak_hours', 'skill_distribution']

            Returns:
                Coverage improvement suggestions with priority and impact analysis
            """
            try:
                with self.flask_app.app_context():
                    if coverage_targets is None:
                        coverage_targets = {"weekday": 3, "weekend": 2, "holiday": 4}

                    if optimization_focus is None:
                        optimization_focus = [
                            "minimum_coverage",
                            "peak_hours",
                            "skill_distribution",
                        ]

                    # Get current schedule data
                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    # Get shift templates for peak hour analysis
                    shift_templates = ShiftTemplate.query.all()

                    improvements = []
                    daily_analysis = {}

                    # Analyze each day in the period
                    current_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    while current_date <= end_dt:
                        date_str = current_date.strftime("%Y-%m-%d")
                        day_schedules = [s for s in schedules if s.date == current_date]

                        # Determine day type
                        is_weekend = current_date.weekday() >= 5
                        day_type = "weekend" if is_weekend else "weekday"
                        target_coverage = coverage_targets.get(day_type, 3)

                        current_coverage = len(day_schedules)
                        coverage_deficit = max(0, target_coverage - current_coverage)
                        coverage_surplus = max(0, current_coverage - target_coverage)

                        daily_analysis[date_str] = {
                            "day_type": day_type,
                            "target_coverage": target_coverage,
                            "current_coverage": current_coverage,
                            "coverage_deficit": coverage_deficit,
                            "coverage_surplus": coverage_surplus,
                            "coverage_ratio": current_coverage / target_coverage
                            if target_coverage > 0
                            else 1.0,
                            "shifts": [
                                {
                                    "id": s.id,
                                    "employee_id": s.employee_id,
                                    "shift_template_id": s.shift_template_id,
                                    "status": s.status,
                                }
                                for s in day_schedules
                            ],
                        }

                        # Generate improvement suggestions based on focus areas
                        if (
                            "minimum_coverage" in optimization_focus
                            and coverage_deficit > 0
                        ):
                            improvements.append(
                                {
                                    "type": "increase_coverage",
                                    "priority": "high"
                                    if coverage_deficit > 1
                                    else "medium",
                                    "date": date_str,
                                    "day_type": day_type,
                                    "description": f"Add {coverage_deficit} shift(s) to meet minimum coverage",
                                    "target_additions": coverage_deficit,
                                    "current_coverage": current_coverage,
                                    "target_coverage": target_coverage,
                                    "impact": f"Achieve {target_coverage}/{target_coverage} coverage ratio",
                                    "action": "schedule_additional_shifts",
                                    "estimated_effort": "low"
                                    if coverage_deficit == 1
                                    else "medium",
                                    "urgency": "high"
                                    if coverage_deficit > 2
                                    else "medium",
                                }
                            )

                        elif (
                            "minimum_coverage" in optimization_focus
                            and coverage_surplus > 1
                        ):
                            improvements.append(
                                {
                                    "type": "optimize_overstaffing",
                                    "priority": "low",
                                    "date": date_str,
                                    "day_type": day_type,
                                    "description": f"Consider reducing {coverage_surplus} shift(s) - overstaffed",
                                    "excess_coverage": coverage_surplus,
                                    "current_coverage": current_coverage,
                                    "target_coverage": target_coverage,
                                    "impact": f"Reduce costs while maintaining {target_coverage} minimum coverage",
                                    "action": "review_shift_necessity",
                                    "estimated_effort": "low",
                                    "cost_savings": "medium",
                                }
                            )

                        # Peak hours analysis
                        if "peak_hours" in optimization_focus and shift_templates:
                            peak_shifts = [
                                st
                                for st in shift_templates
                                if "peak" in st.name.lower()
                                or "busy" in st.name.lower()
                            ]
                            current_peak_coverage = len(
                                [
                                    s
                                    for s in day_schedules
                                    if s.shift_template
                                    and "peak" in s.shift_template.name.lower()
                                ]
                            )

                            if (
                                peak_shifts
                                and current_peak_coverage == 0
                                and is_weekend
                            ):
                                improvements.append(
                                    {
                                        "type": "improve_peak_coverage",
                                        "priority": "medium",
                                        "date": date_str,
                                        "day_type": day_type,
                                        "description": f"No peak hour coverage on {day_type}",
                                        "recommended_shifts": [
                                            {"name": st.name, "id": st.id}
                                            for st in peak_shifts[:2]
                                        ],
                                        "impact": "Better service during high-demand periods",
                                        "action": "schedule_peak_shifts",
                                        "estimated_effort": "medium",
                                    }
                                )

                        # Skill distribution analysis
                        if "skill_distribution" in optimization_focus:
                            # Check for keyholder coverage
                            keyholder_schedules = [
                                s
                                for s in day_schedules
                                if s.employee and s.employee.is_keyholder
                            ]

                            if len(keyholder_schedules) == 0 and day_schedules:
                                improvements.append(
                                    {
                                        "type": "ensure_keyholder_coverage",
                                        "priority": "high",
                                        "date": date_str,
                                        "day_type": day_type,
                                        "description": "No keyholder assigned for this day",
                                        "current_keyholders": 0,
                                        "recommended_keyholders": 1,
                                        "impact": "Ensure responsible person available for emergencies",
                                        "action": "assign_keyholder",
                                        "estimated_effort": "low",
                                        "compliance": "required",
                                    }
                                )

                        current_date += timedelta(days=1)

                    # Calculate summary statistics
                    total_days = len(daily_analysis)
                    under_covered_days = len(
                        [
                            d
                            for d in daily_analysis.values()
                            if d["coverage_deficit"] > 0
                        ]
                    )
                    over_covered_days = len(
                        [
                            d
                            for d in daily_analysis.values()
                            if d["coverage_surplus"] > 1
                        ]
                    )
                    optimal_days = total_days - under_covered_days - over_covered_days

                    avg_coverage_ratio = (
                        sum(d["coverage_ratio"] for d in daily_analysis.values())
                        / total_days
                        if total_days > 0
                        else 0
                    )

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "coverage_targets": coverage_targets,
                        "optimization_focus": optimization_focus,
                        "daily_analysis": daily_analysis,
                        "improvements": improvements,
                        "summary": {
                            "total_days_analyzed": total_days,
                            "under_covered_days": under_covered_days,
                            "over_covered_days": over_covered_days,
                            "optimally_covered_days": optimal_days,
                            "avg_coverage_ratio": round(avg_coverage_ratio, 2),
                            "total_improvements": len(improvements),
                            "high_priority": len(
                                [i for i in improvements if i["priority"] == "high"]
                            ),
                            "medium_priority": len(
                                [i for i in improvements if i["priority"] == "medium"]
                            ),
                            "low_priority": len(
                                [i for i in improvements if i["priority"] == "low"]
                            ),
                        },
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error suggesting coverage improvements: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }

        @self.mcp.tool()
        async def validate_coverage_compliance(
            ctx: Context,
            start_date: str,
            end_date: str,
            compliance_rules: Optional[Dict[str, Any]] = None,
        ) -> Dict[str, Any]:
            """Validate schedule compliance with coverage requirements and regulations.

            Args:
                start_date: Start date for validation (YYYY-MM-DD)
                end_date: End date for validation (YYYY-MM-DD)
                compliance_rules: Custom compliance rules to check

            Returns:
                Detailed compliance analysis with violations and recommendations
            """
            try:
                with self.flask_app.app_context():
                    if compliance_rules is None:
                        # Default compliance rules
                        compliance_rules = {
                            "minimum_daily_coverage": 2,
                            "keyholder_required": True,
                            "max_consecutive_days": 6,
                            "min_rest_hours": 11,
                            "weekend_coverage_ratio": 0.8,  # 80% of weekday coverage
                            "holiday_coverage_multiplier": 1.5,
                        }

                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    employees = Employee.query.filter_by(is_active=True).all()

                    violations = []
                    compliance_score = 100.0  # Start with perfect score
                    daily_compliance = {}

                    # Analyze each day for compliance
                    current_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    while current_date <= end_dt:
                        date_str = current_date.strftime("%Y-%m-%d")
                        day_schedules = [s for s in schedules if s.date == current_date]

                        day_violations = []
                        day_score = 100.0

                        # Check minimum daily coverage
                        if (
                            len(day_schedules)
                            < compliance_rules["minimum_daily_coverage"]
                        ):
                            violation = {
                                "type": "insufficient_coverage",
                                "severity": "high",
                                "description": f"Only {len(day_schedules)} staff scheduled, minimum {compliance_rules['minimum_daily_coverage']} required",
                                "impact": 15,  # Points deducted
                                "resolution": "Schedule additional staff members",
                            }
                            day_violations.append(violation)
                            violations.append({**violation, "date": date_str})
                            day_score -= violation["impact"]
                            compliance_score -= (
                                violation["impact"] / 7
                            )  # Spread impact over week

                        # Check keyholder requirement
                        if compliance_rules["keyholder_required"]:
                            keyholders_scheduled = [
                                s
                                for s in day_schedules
                                if s.employee and s.employee.is_keyholder
                            ]
                            if len(keyholders_scheduled) == 0 and day_schedules:
                                violation = {
                                    "type": "missing_keyholder",
                                    "severity": "high",
                                    "description": "No keyholder assigned",
                                    "impact": 20,
                                    "resolution": "Assign at least one keyholder",
                                }
                                day_violations.append(violation)
                                violations.append({**violation, "date": date_str})
                                day_score -= violation["impact"]
                                compliance_score -= violation["impact"] / 7

                        # Check weekend coverage ratio (if it's a weekend)
                        if current_date.weekday() >= 5:  # Weekend
                            weekday_avg = self._calculate_weekday_average_coverage(
                                schedules, start_date, end_date
                            )
                            min_weekend_coverage = (
                                weekday_avg * compliance_rules["weekend_coverage_ratio"]
                            )

                            if len(day_schedules) < min_weekend_coverage:
                                violation = {
                                    "type": "insufficient_weekend_coverage",
                                    "severity": "medium",
                                    "description": f"Weekend coverage ({len(day_schedules)}) below {compliance_rules['weekend_coverage_ratio'] * 100}% of weekday average ({weekday_avg:.1f})",
                                    "impact": 10,
                                    "resolution": "Increase weekend staffing levels",
                                }
                                day_violations.append(violation)
                                violations.append({**violation, "date": date_str})
                                day_score -= violation["impact"]
                                compliance_score -= (
                                    violation["impact"] / 14
                                )  # Less impact for weekends

                        daily_compliance[date_str] = {
                            "compliance_score": max(0, day_score),
                            "violations": day_violations,
                            "scheduled_staff": len(day_schedules),
                            "keyholders_assigned": len(
                                [
                                    s
                                    for s in day_schedules
                                    if s.employee and s.employee.is_keyholder
                                ]
                            ),
                        }

                        current_date += timedelta(days=1)

                    # Check employee-specific compliance (consecutive days, rest hours)
                    for employee in employees:
                        emp_schedules = [
                            s for s in schedules if s.employee_id == employee.id
                        ]
                        emp_schedules.sort(key=lambda x: x.date)

                        # Check consecutive days
                        consecutive_count = self._calculate_consecutive_days(
                            emp_schedules
                        )
                        if consecutive_count > compliance_rules["max_consecutive_days"]:
                            violation = {
                                "type": "excessive_consecutive_days",
                                "severity": "medium",
                                "employee_id": employee.id,
                                "employee_name": f"{employee.first_name} {employee.last_name}",
                                "description": f"{consecutive_count} consecutive days scheduled (max: {compliance_rules['max_consecutive_days']})",
                                "impact": 8,
                                "resolution": "Add rest days to break consecutive work periods",
                            }
                            violations.append(violation)
                            compliance_score -= violation["impact"]

                    # Calculate final compliance rating
                    compliance_score = max(0, compliance_score)

                    if compliance_score >= 95:
                        compliance_rating = "Excellent"
                    elif compliance_score >= 85:
                        compliance_rating = "Good"
                    elif compliance_score >= 70:
                        compliance_rating = "Needs Improvement"
                    else:
                        compliance_rating = "Poor"

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "compliance_rules": compliance_rules,
                        "compliance_score": round(compliance_score, 1),
                        "compliance_rating": compliance_rating,
                        "daily_compliance": daily_compliance,
                        "violations": violations,
                        "summary": {
                            "total_violations": len(violations),
                            "high_severity": len(
                                [v for v in violations if v["severity"] == "high"]
                            ),
                            "medium_severity": len(
                                [v for v in violations if v["severity"] == "medium"]
                            ),
                            "low_severity": len(
                                [v for v in violations if v["severity"] == "low"]
                            ),
                            "days_analyzed": len(daily_compliance),
                            "compliant_days": len(
                                [
                                    d
                                    for d in daily_compliance.values()
                                    if d["compliance_score"] >= 95
                                ]
                            ),
                        },
                        "recommendations": self._generate_compliance_recommendations(
                            violations
                        ),
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error validating coverage compliance: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }

        @self.mcp.tool()
        async def optimize_shift_distribution(
            ctx: Context,
            start_date: str,
            end_date: str,
            optimization_goals: Optional[List[str]] = None,
            constraints: Optional[Dict[str, Any]] = None,
        ) -> Dict[str, Any]:
            """Optimize shift distribution across time periods and employees.

            Args:
                start_date: Start date for optimization (YYYY-MM-DD)
                end_date: End date for optimization (YYYY-MM-DD)
                optimization_goals: Goals like ['balance_workload', 'minimize_gaps', 'cost_efficiency']
                constraints: Constraints like {'max_shifts_per_employee': 5, 'min_coverage': 2}

            Returns:
                Optimized shift distribution recommendations with impact analysis
            """
            try:
                with self.flask_app.app_context():
                    if optimization_goals is None:
                        optimization_goals = [
                            "balance_workload",
                            "minimize_gaps",
                            "ensure_coverage",
                        ]

                    if constraints is None:
                        constraints = {
                            "max_shifts_per_employee_per_week": 5,
                            "min_coverage_per_day": 2,
                            "max_consecutive_days": 5,
                            "preferred_weekend_coverage": 2,
                        }

                    schedules = Schedule.query.filter(
                        Schedule.date >= start_date, Schedule.date <= end_date
                    ).all()

                    employees = Employee.query.filter_by(is_active=True).all()

                    optimization_results = []

                    # Analyze current distribution
                    employee_workloads = {}
                    daily_coverage = {}

                    for employee in employees:
                        emp_schedules = [
                            s for s in schedules if s.employee_id == employee.id
                        ]
                        employee_workloads[employee.id] = {
                            "employee": {
                                "id": employee.id,
                                "name": f"{employee.first_name} {employee.last_name}",
                                "is_keyholder": employee.is_keyholder,
                            },
                            "total_shifts": len(emp_schedules),
                            "dates": [
                                s.date.strftime("%Y-%m-%d") for s in emp_schedules
                            ],
                            "consecutive_days": self._calculate_consecutive_days(
                                emp_schedules
                            ),
                        }

                    # Calculate daily coverage
                    current_date = datetime.strptime(start_date, "%Y-%m-%d").date()
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

                    while current_date <= end_dt:
                        date_str = current_date.strftime("%Y-%m-%d")
                        day_schedules = [s for s in schedules if s.date == current_date]

                        daily_coverage[date_str] = {
                            "coverage_count": len(day_schedules),
                            "is_weekend": current_date.weekday() >= 5,
                            "meets_minimum": len(day_schedules)
                            >= constraints["min_coverage_per_day"],
                            "employee_ids": [s.employee_id for s in day_schedules],
                        }

                        current_date += timedelta(days=1)

                    # Generate optimization recommendations based on goals

                    # 1. Balance workload optimization
                    if "balance_workload" in optimization_goals:
                        workload_values = [
                            data["total_shifts"] for data in employee_workloads.values()
                        ]
                        if workload_values:
                            avg_workload = sum(workload_values) / len(workload_values)
                            max_workload = max(workload_values)
                            min_workload = min(workload_values)

                            # Identify imbalanced employees
                            overworked = [
                                emp_id
                                for emp_id, data in employee_workloads.items()
                                if data["total_shifts"] > avg_workload * 1.3
                            ]
                            underworked = [
                                emp_id
                                for emp_id, data in employee_workloads.items()
                                if data["total_shifts"] < avg_workload * 0.7
                            ]

                            if overworked and underworked:
                                optimization_results.append(
                                    {
                                        "goal": "balance_workload",
                                        "type": "redistribute_shifts",
                                        "priority": "high",
                                        "description": f"Redistribute shifts between {len(overworked)} overworked and {len(underworked)} underworked employees",
                                        "overworked_employees": [
                                            employee_workloads[emp_id]["employee"]
                                            for emp_id in overworked
                                        ],
                                        "underworked_employees": [
                                            employee_workloads[emp_id]["employee"]
                                            for emp_id in underworked
                                        ],
                                        "current_imbalance": max_workload
                                        - min_workload,
                                        "target_balance": f"±{round(avg_workload * 0.2)} shifts from average",
                                        "impact": "Improved work-life balance and employee satisfaction",
                                        "estimated_effort": "medium",
                                        "implementation": "Move 1-2 shifts from overworked to underworked employees",
                                    }
                                )

                    # 2. Minimize coverage gaps
                    if "minimize_gaps" in optimization_goals:
                        under_covered_days = [
                            date
                            for date, data in daily_coverage.items()
                            if not data["meets_minimum"]
                        ]

                        if under_covered_days:
                            optimization_results.append(
                                {
                                    "goal": "minimize_gaps",
                                    "type": "fill_coverage_gaps",
                                    "priority": "high",
                                    "description": f"Fill coverage gaps on {len(under_covered_days)} days",
                                    "affected_dates": under_covered_days[
                                        :10
                                    ],  # Show first 10
                                    "current_gaps": len(under_covered_days),
                                    "target_coverage": constraints[
                                        "min_coverage_per_day"
                                    ],
                                    "impact": "Ensure minimum staffing levels every day",
                                    "estimated_effort": "high",
                                    "implementation": "Schedule additional employees on under-staffed days",
                                }
                            )

                    # 3. Ensure coverage optimization
                    if "ensure_coverage" in optimization_goals:
                        weekend_days = [
                            date
                            for date, data in daily_coverage.items()
                            if data["is_weekend"]
                        ]
                        under_covered_weekends = [
                            date
                            for date in weekend_days
                            if daily_coverage[date]["coverage_count"]
                            < constraints["preferred_weekend_coverage"]
                        ]

                        if under_covered_weekends:
                            optimization_results.append(
                                {
                                    "goal": "ensure_coverage",
                                    "type": "improve_weekend_coverage",
                                    "priority": "medium",
                                    "description": f"Improve coverage for {len(under_covered_weekends)} weekend days",
                                    "affected_dates": under_covered_weekends,
                                    "current_weekend_coverage": len(weekend_days)
                                    - len(under_covered_weekends),
                                    "target_weekend_coverage": len(weekend_days),
                                    "impact": "Better service quality during weekends",
                                    "estimated_effort": "medium",
                                    "implementation": "Add weekend shifts or redistribute existing shifts",
                                }
                            )

                    # 4. Cost efficiency (if included)
                    if "cost_efficiency" in optimization_goals:
                        # Look for overstaffed days
                        overstaffed_days = [
                            date
                            for date, data in daily_coverage.items()
                            if data["coverage_count"]
                            > constraints["min_coverage_per_day"] + 1
                        ]

                        if overstaffed_days:
                            optimization_results.append(
                                {
                                    "goal": "cost_efficiency",
                                    "type": "reduce_overstaffing",
                                    "priority": "low",
                                    "description": f"Optimize {len(overstaffed_days)} overstaffed days",
                                    "affected_dates": overstaffed_days[:5],
                                    "potential_savings": len(overstaffed_days),
                                    "impact": "Reduce labor costs while maintaining service quality",
                                    "estimated_effort": "low",
                                    "implementation": "Remove excess shifts on overstaffed days",
                                }
                            )

                    return {
                        "period": {"start_date": start_date, "end_date": end_date},
                        "optimization_goals": optimization_goals,
                        "constraints": constraints,
                        "current_analysis": {
                            "employee_workloads": employee_workloads,
                            "daily_coverage": daily_coverage,
                            "total_employees": len(employees),
                            "total_shifts": len(schedules),
                            "avg_shifts_per_employee": round(
                                len(schedules) / len(employees), 1
                            )
                            if employees
                            else 0,
                        },
                        "optimization_results": optimization_results,
                        "summary": {
                            "total_recommendations": len(optimization_results),
                            "high_priority": len(
                                [
                                    r
                                    for r in optimization_results
                                    if r["priority"] == "high"
                                ]
                            ),
                            "medium_priority": len(
                                [
                                    r
                                    for r in optimization_results
                                    if r["priority"] == "medium"
                                ]
                            ),
                            "low_priority": len(
                                [
                                    r
                                    for r in optimization_results
                                    if r["priority"] == "low"
                                ]
                            ),
                            "goals_addressed": len(
                                set(r["goal"] for r in optimization_results)
                            ),
                        },
                        "next_steps": [
                            "Review high-priority recommendations first",
                            "Implement workload balancing changes",
                            "Fill critical coverage gaps",
                            "Monitor impact of changes",
                        ],
                        "timestamp": datetime.now().isoformat(),
                    }

            except Exception as e:
                self.logger.error(f"Error optimizing shift distribution: {e}")
                return {
                    "error": str(e),
                    "period": {"start_date": start_date, "end_date": end_date},
                    "timestamp": datetime.now().isoformat(),
                }

    def _calculate_weekday_average_coverage(
        self, schedules: List, start_date: str, end_date: str
    ) -> float:
        """Calculate average weekday coverage for weekend comparison."""
        weekday_counts = []
        current_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()

        while current_date <= end_dt:
            if current_date.weekday() < 5:  # Weekday
                day_count = len([s for s in schedules if s.date == current_date])
                weekday_counts.append(day_count)
            current_date += timedelta(days=1)

        return sum(weekday_counts) / len(weekday_counts) if weekday_counts else 0

    def _calculate_consecutive_days(self, emp_schedules: List) -> int:
        """Calculate maximum consecutive working days for an employee."""
        if not emp_schedules:
            return 0

        dates = sorted([s.date for s in emp_schedules])
        max_consecutive = 1
        current_consecutive = 1

        for i in range(1, len(dates)):
            if (dates[i] - dates[i - 1]).days == 1:
                current_consecutive += 1
                max_consecutive = max(max_consecutive, current_consecutive)
            else:
                current_consecutive = 1

        return max_consecutive

    def _calculate_workload_balance_score(
        self, shifts_per_week: float, max_consecutive: int, weekend_ratio: float
    ) -> float:
        """Calculate a balance score for workload (0.0 to 1.0, higher is better)."""
        score = 1.0

        # Penalize extreme workloads
        if shifts_per_week > 6 or shifts_per_week < 1:
            score -= 0.3
        elif shifts_per_week > 5 or shifts_per_week < 2:
            score -= 0.1

        # Penalize excessive consecutive days
        if max_consecutive > 6:
            score -= 0.4
        elif max_consecutive > 4:
            score -= 0.2

        # Penalize unfair weekend distribution
        if weekend_ratio > 0.5:  # More than 50% weekends
            score -= 0.2
        elif weekend_ratio < 0.1:  # Less than 10% weekends
            score -= 0.1

        return max(0.0, score)

    def _register_resources(self):
        """Register MCP resources."""
        # Placeholder for future resource registration
        pass

    def _register_prompts(self):
        """Register MCP prompts."""
        # Placeholder for future prompt registration
        pass

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
