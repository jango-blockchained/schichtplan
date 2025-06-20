import asyncio

from flask import Blueprint, jsonify, request
from flask_cors import CORS

from src.backend.services.ai_agents.agent_registry import AgentRegistry
from src.backend.services.ai_agents.workflow_coordinator import WorkflowCoordinator
from src.backend.services.conversational_mcp_service import SchichtplanMCPService
from src.backend.utils.logger import logger

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")
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
        mcp_service = SchichtplanMCPService(app)
        agent_registry = AgentRegistry()
        workflow_coordinator = WorkflowCoordinator()


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
        if not agent_registry:
            return jsonify({"error": "Agent registry not available"}), 503

        agents = agent_registry.list_agents()
        agent_info = []

        for agent in agents:
            agent_info.append(
                {
                    "id": agent.agent_id,
                    "name": agent.__class__.__name__,
                    "capabilities": agent.capabilities,
                    "status": "active",  # Could be expanded with real status
                    "performance": {
                        "total_requests": 0,  # Could track real metrics
                        "success_rate": 95.0,
                        "avg_response_time": 2.1,
                    },
                }
            )

        return jsonify({"agents": agent_info, "total_count": len(agent_info)})

    except Exception as e:
        logger.app_logger.error(f"Get agents error: {str(e)}")
        return jsonify({"error": f"Failed to get agents: {str(e)}"}), 500


@ai_bp.route("/agents/<agent_id>/execute", methods=["POST"])
def execute_agent(agent_id):
    """
    Execute a specific agent with given parameters
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        request_text = data.get("request", "")
        context = data.get("context", {})

        if not request_text:
            return jsonify({"error": "Request text is required"}), 400

        if not agent_registry:
            return jsonify({"error": "Agent registry not available"}), 503

        # Handle async agent execution
        async def handle_agent():
            agent = agent_registry.get_agent(agent_id)
            if not agent:
                return {
                    "error": f"Agent {agent_id} not found",
                    "available_agents": [
                        a.agent_id for a in agent_registry.list_agents()
                    ],
                }

            result = await agent.handle_request(request_text, context)
            return {"result": result, "agent_id": agent_id, "status": "completed"}

        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            response = loop.run_until_complete(handle_agent())
        finally:
            loop.close()

        return jsonify(response)

    except Exception as e:
        logger.app_logger.error(f"Agent execution error: {str(e)}")
        return jsonify({"error": f"Failed to execute agent: {str(e)}"}), 500


@ai_bp.route("/workflows", methods=["GET"])
def get_workflows():
    """
    Get available workflow templates
    """
    try:
        if not workflow_coordinator:
            return jsonify({"error": "Workflow coordinator not available"}), 503

        # Return mock workflow templates for now
        workflows = [
            {
                "id": "comprehensive_optimization",
                "name": "Comprehensive Schedule Optimization",
                "description": "Complete end-to-end schedule optimization",
                "category": "optimization",
                "estimated_duration": 480,
                "complexity": "high",
                "steps": [
                    {
                        "id": "analyze_current",
                        "name": "Analyze Current Schedule",
                        "agent": "ScheduleOptimizerAgent",
                        "estimated_duration": 120,
                    },
                    {
                        "id": "employee_analysis",
                        "name": "Employee Availability Analysis",
                        "agent": "EmployeeManagerAgent",
                        "estimated_duration": 90,
                    },
                    {
                        "id": "optimization",
                        "name": "Schedule Optimization",
                        "agent": "ScheduleOptimizerAgent",
                        "estimated_duration": 180,
                    },
                ],
            },
            {
                "id": "quick_conflict_resolution",
                "name": "Quick Conflict Resolution",
                "description": "Rapidly identify and resolve scheduling conflicts",
                "category": "optimization",
                "estimated_duration": 180,
                "complexity": "medium",
                "steps": [
                    {
                        "id": "detect_conflicts",
                        "name": "Detect Conflicts",
                        "agent": "ScheduleOptimizerAgent",
                        "estimated_duration": 60,
                    },
                    {
                        "id": "resolve_conflicts",
                        "name": "Resolve Conflicts",
                        "agent": "ScheduleOptimizerAgent",
                        "estimated_duration": 120,
                    },
                ],
            },
        ]

        return jsonify({"workflows": workflows, "total_count": len(workflows)})

    except Exception as e:
        logger.app_logger.error(f"Get workflows error: {str(e)}")
        return jsonify({"error": f"Failed to get workflows: {str(e)}"}), 500


@ai_bp.route("/workflows/<workflow_id>/execute", methods=["POST"])
def execute_workflow(workflow_id):
    """
    Execute a workflow with given parameters
    """
    try:
        data = request.get_json()
        parameters = data.get("parameters", {}) if data else {}

        if not workflow_coordinator:
            return jsonify({"error": "Workflow coordinator not available"}), 503

        # Handle async workflow execution
        async def handle_workflow():
            # Mock workflow execution for now
            execution_id = f"exec_{workflow_id}_{int(asyncio.get_event_loop().time())}"

            return {
                "execution_id": execution_id,
                "workflow_id": workflow_id,
                "status": "started",
                "parameters": parameters,
                "estimated_completion": "2025-06-20T15:30:00Z",
            }

        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            response = loop.run_until_complete(handle_workflow())
        finally:
            loop.close()

        return jsonify(response)

    except Exception as e:
        logger.app_logger.error(f"Workflow execution error: {str(e)}")
        return jsonify({"error": f"Failed to execute workflow: {str(e)}"}), 500


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


@ai_bp.route("/mcp/tools", methods=["GET"])
def get_mcp_tools():
    """
    Get available MCP tools
    """
    try:
        if not mcp_service:
            return jsonify({"error": "MCP service not available"}), 503

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
                        "type": "date",
                        "required": True,
                        "description": "Start date for conflict analysis",
                    },
                    {
                        "name": "end_date",
                        "type": "date",
                        "required": True,
                        "description": "End date for conflict analysis",
                    },
                ],
                "status": "available",
                "usage_count": 156,
                "avg_response_time": 2.3,
            },
            {
                "id": "get_employee_availability",
                "name": "Get Employee Availability",
                "description": "Retrieve employee availability information for scheduling",
                "category": "employee",
                "parameters": [
                    {
                        "name": "employee_id",
                        "type": "number",
                        "required": False,
                        "description": "Specific employee ID (optional)",
                    },
                    {
                        "name": "start_date",
                        "type": "date",
                        "required": True,
                        "description": "Start date for availability query",
                    },
                ],
                "status": "available",
                "usage_count": 203,
                "avg_response_time": 1.2,
            },
        ]

        return jsonify({"tools": tools, "total_count": len(tools)})

    except Exception as e:
        logger.app_logger.error(f"Get MCP tools error: {str(e)}")
        return jsonify({"error": f"Failed to get MCP tools: {str(e)}"}), 500


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
            "timestamp": "2025-06-20T12:00:00Z",
        }

        return jsonify(health_status)

    except Exception as e:
        logger.app_logger.error(f"AI health check error: {str(e)}")
        return jsonify({"error": f"Health check failed: {str(e)}"}), 500
