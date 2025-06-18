"""
FastMCP Service for Schichtplan Application

This service exposes core scheduling functionality through the Model Context Protocol,
enabling AI applications to interact with the shift planning system.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Any, Union
import json
import traceback

from fastmcp import FastMCP, Context, Image
from flask import Flask

# Import Schichtplan models and services
from src.backend.models import (
    db, Employee, ShiftTemplate, Schedule, 
    Coverage, EmployeeAvailability, Absence, Settings
)
from src.backend.services.schedule_generator import ScheduleGenerator
from src.backend.services.ai_scheduler_service import AISchedulerService
from src.backend.services.demo_data_generator import DemoDataGenerator
from src.backend.services.pdf_generator import PDFGenerator


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
                    'name': 'Schichtplan MCP Server',
                    'version': '1.0.0',
                    'description': 'Model Context Protocol server for Schichtplan shift scheduling application',
                    'author': 'Schichtplan Development Team',
                    'protocol_version': '2024-11-05',
                    'server_capabilities': {
                        'tools': True,
                        'resources': True,
                        'prompts': True,
                        'logging': True
                    },
                    'supported_transports': ['stdio', 'sse', 'streamable-http'],
                    'endpoints': {
                        'stdio': 'Direct stdin/stdout communication',
                        'sse': 'Server-Sent Events on configurable port (default: 8001)',
                        'http': 'Streamable HTTP on configurable port (default: 8002)'
                    },
                    'features': [
                        'Employee management',
                        'Shift template management', 
                        'Schedule generation (AI and traditional)',
                        'System status monitoring',
                        'Demo data generation',
                        'Schedule analysis and optimization'
                    ],
                    'system_requirements': {
                        'python': '>=3.8',
                        'database': 'SQLite/PostgreSQL',
                        'dependencies': ['FastMCP', 'Flask', 'SQLAlchemy']
                    }
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
                    'tools': {
                        'get_server_info': {
                            'description': 'Get server information and metadata',
                            'parameters': {},
                            'returns': 'Server information object'
                        },
                        'get_capabilities': {
                            'description': 'Get detailed server capabilities',
                            'parameters': {},
                            'returns': 'Capabilities object'
                        },
                        'get_employees': {
                            'description': 'Retrieve employee information',
                            'parameters': {
                                'active_only': 'boolean - Filter for active employees only',
                                'include_details': 'boolean - Include detailed employee information'
                            },
                            'returns': 'List of employee objects'
                        },
                        'get_shift_templates': {
                            'description': 'Retrieve shift template definitions',
                            'parameters': {
                                'active_only': 'boolean - Filter for active shift templates only'
                            },
                            'returns': 'List of shift template objects'
                        },
                        'generate_schedule': {
                            'description': 'Generate new schedule for date range',
                            'parameters': {
                                'start_date': 'string - Start date (YYYY-MM-DD)',
                                'end_date': 'string - End date (YYYY-MM-DD)',
                                'use_ai': 'boolean - Use AI-powered scheduling',
                                'version': 'integer - Schedule version number'
                            },
                            'returns': 'Schedule generation result'
                        },
                        'get_schedule': {
                            'description': 'Retrieve existing schedule',
                            'parameters': {
                                'start_date': 'string - Start date (YYYY-MM-DD)',
                                'end_date': 'string - End date (YYYY-MM-DD)',
                                'version': 'integer - Schedule version number'
                            },
                            'returns': 'Schedule data with assignments'
                        },
                        'generate_demo_data': {
                            'description': 'Generate demo data for testing',
                            'parameters': {
                                'employee_count': 'integer - Number of employees to create',
                                'shift_count': 'integer - Number of shift templates',
                                'coverage_blocks': 'integer - Number of coverage requirements'
                            },
                            'returns': 'Demo data generation result'
                        },
                        'get_system_status': {
                            'description': 'Get system status and statistics',
                            'parameters': {},
                            'returns': 'System status information'
                        }
                    },
                    'resources': {
                        'config://system': {
                            'description': 'System configuration information',
                            'content_type': 'application/json'
                        },
                        'employees://{employee_id}': {
                            'description': 'Detailed employee information by ID',
                            'content_type': 'application/json',
                            'parameters': {
                                'employee_id': 'integer - Employee ID'
                            }
                        }
                    },
                    'prompts': {
                        'schedule_analysis_prompt': {
                            'description': 'Generate AI prompt for schedule analysis',
                            'parameters': {
                                'schedule_data': 'string - JSON schedule data'
                            }
                        },
                        'employee_scheduling_prompt': {
                            'description': 'Generate AI prompt for employee scheduling',
                            'parameters': {
                                'employee_data': 'string - JSON employee data',
                                'requirements': 'string - Scheduling requirements'
                            }
                        }
                    },
                    'protocols': {
                        'mcp_version': '2024-11-05',
                        'implementation': 'FastMCP',
                        'transports': ['stdio', 'sse', 'streamable-http']
                    },
                    'ai_integration': {
                        'supported': True,
                        'models': 'Compatible with OpenAI, Anthropic, and other MCP-supporting AI systems',
                        'use_cases': [
                            'Schedule optimization',
                            'Conflict resolution',
                            'Workload analysis',
                            'Compliance checking',
                            'Resource planning'
                        ]
                    }
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
                health_status = {
                    'status': 'healthy',
                    'timestamp': datetime.now().isoformat(),
                    'server_name': 'Schichtplan MCP Server',
                    'version': '1.0.0',
                    'uptime': 'Available',
                    'connectivity': {
                        'database': 'connected',
                        'flask_app': 'available'
                    }
                }
                
                # Test database connectivity
                try:
                    with self.flask_app.app_context():
                        Employee.query.first()
                        health_status['connectivity']['database'] = 'connected'
                except Exception as db_error:
                    health_status['connectivity']['database'] = f'error: {str(db_error)}'
                    health_status['status'] = 'degraded'
                
                if ctx:
                    await ctx.info("Health check completed")
                
                return health_status
                
            except Exception as e:
                error_status = {
                    'status': 'unhealthy',
                    'timestamp': datetime.now().isoformat(),
                    'error': str(e)
                }
                
                if ctx:
                    await ctx.error(f"Health check failed: {str(e)}")
                
                return error_status
        
        @self.mcp.tool()
        async def get_employees(
            active_only: bool = True,
            include_details: bool = False,
            ctx: Context = None
        ) -> List[Dict[str, Any]]:
            """Get list of employees with optional filtering.
            
            Args:
                active_only: Only return active employees
                include_details: Include detailed employee information
                
            Returns:
                List of employee data
            """
            try:
                with self.flask_app.app_context():
                    query = Employee.query
                    if active_only:
                        query = query.filter_by(is_active=True)
                    
                    employees = query.all()
                    
                    result = []
                    for emp in employees:
                        emp_data = {
                            'id': emp.id,
                            'name': emp.name,
                            'is_active': emp.is_active,
                            'is_keyholder': emp.is_keyholder
                        }
                        
                        if include_details:
                            emp_data.update({
                                'email': emp.email,
                                'phone': emp.phone,
                                'gfb_status': emp.gfb_status,
                                'notes': emp.notes,
                                'color': emp.color
                            })
                        
                        result.append(emp_data)
                    
                    await ctx.info(f"Retrieved {len(result)} employees")
                    return result
                    
            except Exception as e:
                await ctx.error(f"Error fetching employees: {str(e)}")
                raise
        
        @self.mcp.tool()
        async def get_shift_templates(
            active_only: bool = True,
            ctx: Context = None
        ) -> List[Dict[str, Any]]:
            """Get list of shift templates.
            
            Args:
                active_only: Only return active shift templates
                
            Returns:
                List of shift template data
            """
            try:
                with self.flask_app.app_context():
                    query = ShiftTemplate.query
                    if active_only:
                        query = query.filter_by(is_active=True)
                    
                    shifts = query.all()
                    
                    result = []
                    for shift in shifts:
                        result.append({
                            'id': shift.id,
                            'name': shift.name,
                            'start_time': shift.start_time.strftime('%H:%M') if shift.start_time else None,
                            'end_time': shift.end_time.strftime('%H:%M') if shift.end_time else None,
                            'duration_hours': shift.duration_hours,
                            'color': shift.color,
                            'requires_keyholder': shift.requires_keyholder,
                            'max_employees': shift.max_employees,
                            'is_active': shift.is_active
                        })
                    
                    await ctx.info(f"Retrieved {len(result)} shift templates")
                    return result
                    
            except Exception as e:
                await ctx.error(f"Error fetching shift templates: {str(e)}")
                raise
        
        @self.mcp.tool()
        async def generate_schedule(
            start_date: str,
            end_date: str,
            use_ai: bool = False,
            version: Optional[int] = None,
            ctx: Context = None
        ) -> Dict[str, Any]:
            """Generate a new schedule for the specified date range.
            
            Args:
                start_date: Start date in YYYY-MM-DD format
                end_date: End date in YYYY-MM-DD format
                use_ai: Whether to use AI-powered scheduling
                version: Optional version number for the schedule
                
            Returns:
                Schedule generation result with status and details
            """
            try:
                # Parse dates
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                
                await ctx.info(f"Generating schedule from {start_date} to {end_date} (AI: {use_ai})")
                
                with self.flask_app.app_context():
                    if use_ai:
                        # Use AI scheduler service
                        ai_scheduler = AISchedulerService()
                        result = ai_scheduler.generate_schedule_via_ai(
                            start_date_str=start_date,
                            end_date_str=end_date,
                            version_id=version,
                            ai_model_params=None
                        )
                        await ctx.info("AI schedule generation completed")
                        return result
                    else:
                        # Use traditional scheduler
                        generator = ScheduleGenerator()
                        result = generator.generate(
                            start_date=start,
                            end_date=end,
                            version=version or 1
                        )
                        
                        schedule_data = {
                            'status': 'success',
                            'schedule_id': result.id if result else None,
                            'message': f'Schedule generated for {start_date} to {end_date}',
                            'assignments_count': len(result.assignments) if result else 0
                        }
                        
                        await ctx.info("Traditional schedule generation completed")
                        return schedule_data
                        
            except Exception as e:
                error_msg = f"Error generating schedule: {str(e)}"
                await ctx.error(error_msg)
                return {
                    'status': 'error',
                    'message': error_msg,
                    'traceback': traceback.format_exc()
                }
        
        @self.mcp.tool()
        async def get_schedule(
            start_date: str,
            end_date: str,
            version: Optional[int] = None,
            ctx: Context = None
        ) -> Dict[str, Any]:
            """Retrieve existing schedule for the specified date range.
            
            Args:
                start_date: Start date in YYYY-MM-DD format
                end_date: End date in YYYY-MM-DD format
                version: Optional version number
                
            Returns:
                Schedule data with assignments
            """
            try:
                start = datetime.strptime(start_date, '%Y-%m-%d').date()
                end = datetime.strptime(end_date, '%Y-%m-%d').date()
                
                with self.flask_app.app_context():
                    query = Schedule.query.filter(
                        Schedule.start_date <= end,
                        Schedule.end_date >= start
                    )
                    
                    if version:
                        query = query.filter_by(version=version)
                    
                    schedules = query.all()
                    
                    result = {
                        'schedules': [],
                        'total_assignments': 0
                    }
                    
                    for schedule in schedules:
                        assignments = []
                        for assignment in schedule.assignments:
                            assignments.append({
                                'id': assignment.id,
                                'date': assignment.date.strftime('%Y-%m-%d'),
                                'employee_id': assignment.employee_id,
                                'employee_name': assignment.employee.name if assignment.employee else None,
                                'shift_template_id': assignment.shift_template_id,
                                'shift_name': assignment.shift_template.name if assignment.shift_template else None,
                                'start_time': assignment.shift_template.start_time.strftime('%H:%M') if assignment.shift_template and assignment.shift_template.start_time else None,
                                'end_time': assignment.shift_template.end_time.strftime('%H:%M') if assignment.shift_template and assignment.shift_template.end_time else None
                            })
                        
                        result['schedules'].append({
                            'id': schedule.id,
                            'start_date': schedule.start_date.strftime('%Y-%m-%d'),
                            'end_date': schedule.end_date.strftime('%Y-%m-%d'),
                            'version': schedule.version,
                            'created_at': schedule.created_at.isoformat() if schedule.created_at else None,
                            'assignments': assignments
                        })
                        
                        result['total_assignments'] += len(assignments)
                    
                    await ctx.info(f"Retrieved {len(schedules)} schedules with {result['total_assignments']} assignments")
                    return result
                    
            except Exception as e:
                await ctx.error(f"Error fetching schedule: {str(e)}")
                raise
        
        @self.mcp.tool()
        async def generate_demo_data(
            employee_count: int = 15,
            shift_count: int = 8,
            coverage_blocks: int = 5,
            ctx: Context = None
        ) -> Dict[str, Any]:
            """Generate demo data for testing and development.
            
            Args:
                employee_count: Number of employees to create
                shift_count: Number of shift templates to create
                coverage_blocks: Number of coverage requirements to create
                
            Returns:
                Result of demo data generation
            """
            try:
                await ctx.info(f"Generating demo data: {employee_count} employees, {shift_count} shifts, {coverage_blocks} coverage blocks")
                
                with self.flask_app.app_context():
                    generator = DemoDataGenerator()
                    result = generator.generate_demo_data(
                        employee_count=employee_count,
                        shift_count=shift_count,
                        coverage_blocks=coverage_blocks
                    )
                    
                    await ctx.info("Demo data generation completed")
                    return {
                        'status': 'success',
                        'message': f'Generated {employee_count} employees, {shift_count} shifts, {coverage_blocks} coverage blocks',
                        'details': result
                    }
                    
            except Exception as e:
                error_msg = f"Error generating demo data: {str(e)}"
                await ctx.error(error_msg)
                return {
                    'status': 'error',
                    'message': error_msg
                }
        
        @self.mcp.tool()
        async def get_system_status(ctx: Context = None) -> Dict[str, Any]:
            """Get system status and database statistics.
            
            Returns:
                System status information
            """
            try:
                with self.flask_app.app_context():
                    status = {
                        'database': 'connected',
                        'employees': {
                            'total': Employee.query.count(),
                            'active': Employee.query.filter_by(is_active=True).count(),
                            'keyholders': Employee.query.filter_by(is_keyholder=True).count()
                        },
                        'shift_templates': {
                            'total': ShiftTemplate.query.count(),
                            'active': ShiftTemplate.query.filter_by(is_active=True).count()
                        },
                        'schedules': {
                            'total': Schedule.query.count()
                        },
                        'coverage_requirements': Coverage.query.count(),
                        'availability_records': EmployeeAvailability.query.count(),
                        'absence_records': Absence.query.count()
                    }
                    
                    await ctx.info("System status retrieved successfully")
                    return status
                    
            except Exception as e:
                await ctx.error(f"Error getting system status: {str(e)}")
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
                            'max_weekly_hours': settings.max_weekly_hours,
                            'min_rest_hours': settings.min_rest_hours,
                            'auto_assign_keyholders': settings.auto_assign_keyholders,
                            'enable_overtime_warnings': settings.enable_overtime_warnings
                        }
                    else:
                        config = {'status': 'No settings configured'}
                    
                    return json.dumps(config, indent=2)
            except Exception as e:
                return json.dumps({'error': str(e)}, indent=2)
        
        @self.mcp.resource("employees://{employee_id}")
        def get_employee_details(employee_id: int) -> str:
            """Get detailed information about a specific employee."""
            try:
                with self.flask_app.app_context():
                    employee = Employee.query.get(employee_id)
                    if not employee:
                        return json.dumps({'error': 'Employee not found'})
                    
                    # Get availability and absence data
                    availability = EmployeeAvailability.query.filter_by(employee_id=employee_id).all()
                    absences = Absence.query.filter_by(employee_id=employee_id).all()
                    
                    data = {
                        'id': employee.id,
                        'name': employee.name,
                        'email': employee.email,
                        'phone': employee.phone,
                        'is_active': employee.is_active,
                        'is_keyholder': employee.is_keyholder,
                        'gfb_status': employee.gfb_status,
                        'color': employee.color,
                        'notes': employee.notes,
                        'availability_records': len(availability),
                        'absence_records': len(absences),
                        'recent_absences': [
                            {
                                'start_date': abs_rec.start_date.strftime('%Y-%m-%d'),
                                'end_date': abs_rec.end_date.strftime('%Y-%m-%d'),
                                'reason': abs_rec.reason
                            }
                            for abs_rec in absences[-5:]  # Last 5 absences
                        ]
                    }
                    
                    return json.dumps(data, indent=2)
            except Exception as e:
                return json.dumps({'error': str(e)}, indent=2)
    
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
    
    def get_mcp_server(self) -> FastMCP:
        """Get the FastMCP server instance."""
        return self.mcp
    
    async def run_stdio(self):
        """Run the MCP server in stdio mode."""
        await self.mcp.run(transport="stdio")
    
    async def run_sse(self, host: str = "127.0.0.1", port: int = 8001):
        """Run the MCP server in SSE mode."""
        await self.mcp.run(transport="sse", host=host, port=port)
    
    async def run_streamable_http(self, host: str = "127.0.0.1", port: int = 8002):
        """Run the MCP server in streamable HTTP mode."""
        await self.mcp.run(transport="streamable-http", host=host, port=port)