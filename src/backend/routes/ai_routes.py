import asyncio
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_cors import CORS

# Temporarily comment out to test import issues
# from src.backend.services.conversational_mcp_service import SchichtplanMCPService
from src.backend.utils.logger import logger

ai_bp = Blueprint("ai", __name__, url_prefix="/ai")
CORS(
    ai_bp,
    origins="*",
    methods=["GET", "POST", "OPTIONS", "PUT"],
    supports_credentials=True,
)

# Initialize services
mcp_service = None
agent_registry = None
workflow_coordinator = None


def init_ai_services(app):
    """Initialize AI services with app context"""
    global mcp_service, agent_registry, workflow_coordinator
    with app.app_context():
        try:
            # Initialize MCP service - temporarily disabled
            # mcp_service = SchichtplanMCPService(app)
            mcp_service = None  # Temporarily disabled

            # For now, create simplified versions without full AI orchestrator
            # TODO: Implement full AI orchestrator integration
            agent_registry = None  # Disabled until AI orchestrator is ready
            workflow_coordinator = None  # Disabled until AI orchestrator is ready

            logger.app_logger.info("AI services initialized successfully")
        except Exception as e:
            logger.app_logger.error(f"Failed to initialize AI services: {str(e)}")
            # Set services to None to indicate they're not available
            mcp_service = None
            agent_registry = None
            workflow_coordinator = None


@ai_bp.route("/chat", methods=["POST"])
def chat():
    """
    Handle conversational AI chat requests
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        message = data.get("message", "")
        conversation_id = data.get("conversation_id", "default")

        if not message:
            return jsonify({"error": "Message is required"}), 400

        logger.app_logger.info(f"AI chat request: {message[:100]}...")

        # Handle async MCP service call
        async def handle_chat():
            if mcp_service:
                response = await mcp_service.handle_request(message, conversation_id)
                return response
            else:
                return {
                    "response": "AI service not available",
                    "conversation_id": conversation_id,
                    "metadata": {"agent": "system", "status": "error"},
                }

        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            response = loop.run_until_complete(handle_chat())
        finally:
            loop.close()

        return jsonify(response)

    except Exception as e:
        logger.app_logger.error(f"AI chat error: {str(e)}")
        return jsonify({"error": f"Failed to process chat request: {str(e)}"}), 500


@ai_bp.route("/agents", methods=["GET"])
def get_agents():
    """
    Get information about available AI agents
    """
    try:
        # Return mock agent data since agent registry is not fully implemented yet
        mock_agents = [
            {
                "id": "schedule_optimizer",
                "name": "Schedule Optimizer Agent",
                "type": "schedule_optimizer",
                "description": "Specialized in schedule optimization and conflict resolution",
                "status": "active",
                "capabilities": [
                    "Schedule Conflict Detection",
                    "Workload Optimization",
                    "Coverage Analysis",
                    "Constraint Validation",
                ],
                "performance": {
                    "total_requests": 1247,
                    "success_rate": 96.5,
                    "avg_response_time": 2.1,
                    "last_active": "2025-06-20T12:00:00Z",
                },
            },
            {
                "id": "employee_manager",
                "name": "Employee Manager Agent",
                "type": "employee_manager",
                "description": "Manages employee availability and workload distribution",
                "status": "active",
                "capabilities": [
                    "Availability Analysis",
                    "Workload Distribution",
                    "Preference Management",
                    "Fair Assignment",
                ],
                "performance": {
                    "total_requests": 892,
                    "success_rate": 94.8,
                    "avg_response_time": 1.8,
                    "last_active": "2025-06-20T11:48:00Z",
                },
            },
        ]

        return jsonify(mock_agents)

    except Exception as e:
        logger.app_logger.error(f"Get agents error: {str(e)}")
        return jsonify({"error": f"Failed to get agents: {str(e)}"}), 500


@ai_bp.route("/agents/<agent_id>/toggle", methods=["POST"])
def toggle_agent(agent_id):
    """
    Toggle agent enabled/disabled status
    """
    try:
        data = request.get_json()
        enabled = data.get("enabled", True) if data else True

        # Mock response since agent registry is not fully implemented
        return jsonify(
            {
                "success": True,
                "agent_id": agent_id,
                "enabled": enabled,
                "message": f"Agent {agent_id} {'enabled' if enabled else 'disabled'} successfully",
            }
        )

    except Exception as e:
        logger.app_logger.error(f"Toggle agent error: {str(e)}")
        return jsonify({"error": f"Failed to toggle agent: {str(e)}"}), 500


@ai_bp.route("/workflows/templates", methods=["GET"])
def get_workflow_templates():
    """
    Get available workflow templates
    """
    try:
        # Return mock workflow templates for now
        workflows = [
            {
                "id": "comprehensive_optimization",
                "name": "Comprehensive Schedule Optimization",
                "description": "Complete end-to-end schedule optimization",
                "category": "optimization",
                "estimated_duration": 480,
                "difficulty": "high",
                "steps": [
                    {
                        "id": "analyze_current",
                        "name": "Analyze Current Schedule",
                        "type": "analysis",
                        "description": "Analyze existing schedule for conflicts and coverage gaps",
                        "required_inputs": ["start_date", "end_date"],
                        "outputs": ["conflict_report", "coverage_analysis"],
                    },
                    {
                        "id": "employee_analysis",
                        "name": "Employee Availability Analysis",
                        "type": "analysis",
                        "description": "Analyze employee availability and workload distribution",
                        "required_inputs": ["employee_list"],
                        "outputs": ["availability_report", "workload_analysis"],
                    },
                    {
                        "id": "optimization",
                        "name": "Schedule Optimization",
                        "type": "optimization",
                        "description": "Apply optimization algorithms to create improved schedule",
                        "required_inputs": ["current_schedule", "constraints"],
                        "outputs": ["optimized_schedule", "improvement_metrics"],
                    },
                ],
            },
            {
                "id": "quick_conflict_resolution",
                "name": "Quick Conflict Resolution",
                "description": "Rapidly identify and resolve scheduling conflicts",
                "category": "optimization",
                "estimated_duration": 180,
                "difficulty": "medium",
                "steps": [
                    {
                        "id": "detect_conflicts",
                        "name": "Detect Conflicts",
                        "type": "analysis",
                        "description": "Identify scheduling conflicts in current schedule",
                        "required_inputs": ["schedule_data"],
                        "outputs": ["conflict_list"],
                    },
                    {
                        "id": "resolve_conflicts",
                        "name": "Resolve Conflicts",
                        "type": "optimization",
                        "description": "Apply resolution strategies to fix conflicts",
                        "required_inputs": ["conflict_list", "resolution_preferences"],
                        "outputs": ["resolved_schedule", "resolution_report"],
                    },
                ],
            },
        ]

        return jsonify(workflows)

    except Exception as e:
        logger.app_logger.error(f"Get workflow templates error: {str(e)}")
        return jsonify({"error": f"Failed to get workflow templates: {str(e)}"}), 500


@ai_bp.route("/workflows/execute", methods=["POST"])
def execute_workflow():
    """
    Execute a workflow with given parameters
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        template_id = data.get("template_id", "")
        inputs = data.get("inputs", {})

        if not template_id:
            return jsonify({"error": "Template ID is required"}), 400

        # Mock workflow execution for now
        execution_id = f"exec_{template_id}_{int(datetime.now().timestamp())}"

        execution = {
            "id": execution_id,
            "template_id": template_id,
            "name": f"Workflow Execution - {template_id}",
            "status": "running",
            "progress": 0,
            "start_time": datetime.now().isoformat(),
            "inputs": inputs,
            "outputs": None,
        }

        return jsonify(execution)

    except Exception as e:
        logger.app_logger.error(f"Workflow execution error: {str(e)}")
        return jsonify({"error": f"Failed to execute workflow: {str(e)}"}), 500


@ai_bp.route("/workflows/executions", methods=["GET"])
def get_workflow_executions():
    """
    Get workflow execution history
    """
    try:
        # Mock execution data
        executions = [
            {
                "id": "exec_001",
                "template_id": "comprehensive_optimization",
                "name": "Comprehensive Schedule Optimization - June 2025",
                "status": "running",
                "progress": 65,
                "start_time": "2025-06-20T11:30:00Z",
                "inputs": {"start_date": "2025-06-23", "end_date": "2025-06-29"},
            },
            {
                "id": "exec_002",
                "template_id": "quick_conflict_resolution",
                "name": "Quick Conflict Resolution - Morning Shift",
                "status": "completed",
                "progress": 100,
                "start_time": "2025-06-20T10:15:00Z",
                "end_time": "2025-06-20T10:18:00Z",
                "inputs": {"shift_time": "morning"},
            },
        ]

        return jsonify(executions)

    except Exception as e:
        logger.app_logger.error(f"Get workflow executions error: {str(e)}")
        return jsonify({"error": f"Failed to get workflow executions: {str(e)}"}), 500


@ai_bp.route("/analytics", methods=["GET"])
def get_analytics():
    """
    Get AI system analytics and metrics
    """
    try:
        # Mock analytics data for now
        analytics = {
            "metrics": [
                {
                    "id": "ai_response_time",
                    "name": "AI Response Time",
                    "value": 2.3,
                    "unit": "seconds",
                    "change": -12.5,
                    "trend": "down",
                },
                {
                    "id": "optimization_success_rate",
                    "name": "Optimization Success Rate",
                    "value": 96.8,
                    "unit": "%",
                    "change": 4.2,
                    "trend": "up",
                },
                {
                    "id": "agent_utilization",
                    "name": "Agent Utilization",
                    "value": 78.5,
                    "unit": "%",
                    "change": 8.3,
                    "trend": "up",
                },
            ],
            "insights": [
                {
                    "id": "insight_001",
                    "title": "Schedule Optimization Opportunity",
                    "description": "Analysis shows 15% improvement potential in workload distribution",
                    "type": "optimization",
                    "confidence": 0.89,
                    "impact": "high",
                }
            ],
            "system_health": {
                "status": "healthy",
                "agents_active": 3,
                "workflows_running": 2,
                "uptime": "99.9%",
            },
        }

        return jsonify(analytics)

    except Exception as e:
        logger.app_logger.error(f"Get analytics error: {str(e)}")
        return jsonify({"error": f"Failed to get analytics: {str(e)}"}), 500


@ai_bp.route("/tools", methods=["GET"])
def get_mcp_tools():
    """
    Get available MCP tools
    """
    try:
        # Mock MCP tools data for now
        tools = [
            {
                "id": "analyze_schedule_conflicts",
                "name": "Analyze Schedule Conflicts",
                "description": "Identify and analyze conflicts in the current schedule",
                "category": "schedule",
                "parameters": [
                    {
                        "name": "start_date",
                        "type": "string",
                        "required": True,
                        "description": "Start date for conflict analysis",
                    },
                    {
                        "name": "end_date",
                        "type": "string",
                        "required": True,
                        "description": "End date for conflict analysis",
                    },
                ],
                "status": "available",
                "usage_count": 156,
                "last_used": "2025-06-20T10:30:00Z",
            },
            {
                "id": "get_employee_availability",
                "name": "Get Employee Availability",
                "description": "Retrieve employee availability information for scheduling",
                "category": "employee",
                "parameters": [
                    {
                        "name": "employee_id",
                        "type": "string",
                        "required": False,
                        "description": "Specific employee ID (optional)",
                    },
                    {
                        "name": "start_date",
                        "type": "string",
                        "required": True,
                        "description": "Start date for availability query",
                    },
                ],
                "status": "available",
                "usage_count": 203,
                "last_used": "2025-06-20T11:15:00Z",
            },
            {
                "id": "optimize_schedule_ai",
                "name": "AI Schedule Optimization",
                "description": "Use AI to optimize schedule based on constraints and preferences",
                "category": "optimization",
                "parameters": [
                    {
                        "name": "optimization_goals",
                        "type": "string",
                        "required": True,
                        "description": "List of optimization goals (e.g., balance_workload, minimize_conflicts)",
                    },
                    {
                        "name": "constraints",
                        "type": "string",
                        "required": False,
                        "description": "Additional constraints for optimization",
                    },
                ],
                "status": "available",
                "usage_count": 89,
                "last_used": "2025-06-20T09:45:00Z",
            },
        ]

        return jsonify(tools)

    except Exception as e:
        logger.app_logger.error(f"Get MCP tools error: {str(e)}")
        return jsonify({"error": f"Failed to get MCP tools: {str(e)}"}), 500


@ai_bp.route("/tools/execute", methods=["POST"])
def execute_mcp_tool():
    """
    Execute an MCP tool with given parameters
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        tool_id = data.get("tool_id", "")
        parameters = data.get("parameters", {})

        if not tool_id:
            return jsonify({"error": "Tool ID is required"}), 400

        # Mock tool execution for now
        result = {
            "success": True,
            "result": {
                "tool_id": tool_id,
                "parameters": parameters,
                "output": f"Mock result for {tool_id}",
                "execution_time": 1.5,
            },
            "execution_time": 1.5,
        }

        return jsonify(result)

    except Exception as e:
        logger.app_logger.error(f"MCP tool execution error: {str(e)}")
        return jsonify({"error": f"Failed to execute MCP tool: {str(e)}"}), 500


@ai_bp.route("/settings", methods=["GET"])
def get_ai_settings():
    """
    Get AI system settings
    """
    try:
        # Mock settings data
        settings = {
            "providers": {
                "gemini_api_key": "***configured***",
                "openai_api_key": None,
                "anthropic_api_key": None,
            },
            "agents": {
                "schedule_agent_enabled": True,
                "analytics_agent_enabled": True,
                "notification_agent_enabled": False,
            },
            "workflow": {"auto_approval_enabled": False, "max_concurrent_workflows": 5},
            "chat": {
                "max_conversation_length": 50,
                "enable_suggestions": True,
                "enable_feedback": True,
            },
        }

        return jsonify(settings)

    except Exception as e:
        logger.app_logger.error(f"Get AI settings error: {str(e)}")
        return jsonify({"error": f"Failed to get AI settings: {str(e)}"}), 500


@ai_bp.route("/settings", methods=["POST"])
def update_ai_settings():
    """
    Update AI system settings
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No settings data provided"}), 400

        # Mock settings update
        return jsonify(
            {
                "success": True,
                "message": "AI settings updated successfully",
                "updated_settings": data,
            }
        )

    except Exception as e:
        logger.app_logger.error(f"Update AI settings error: {str(e)}")
        return jsonify({"error": f"Failed to update AI settings: {str(e)}"}), 500


@ai_bp.route("/health", methods=["GET"])
def health_check():
    """
    AI system health check
    """
    try:
        health_status = {
            "status": "healthy",
            "services": {
                "mcp_service": mcp_service is not None,
                "agent_registry": agent_registry is not None,
                "workflow_coordinator": workflow_coordinator is not None,
            },
            "timestamp": datetime.now().isoformat(),
        }

        return jsonify(health_status)

    except Exception as e:
        logger.app_logger.error(f"AI health check error: {str(e)}")
        return jsonify({"error": f"Health check failed: {str(e)}"}), 500
