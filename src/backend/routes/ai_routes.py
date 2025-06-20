import asyncio
import traceback
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_cors import CORS

from src.backend.models import MessageType
from src.backend.services.ai_agents import AgentRegistry, WorkflowCoordinator
from src.backend.services.ai_integration import create_ai_orchestrator

# Import AI services
from src.backend.services.mcp_service import SchichtplanMCPService
from src.backend.services.simple_conversation_manager import SimpleConversationManager
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
conversation_manager = None


def get_blueprint_info():
    """
    Safely get blueprint information for debugging.
    This avoids the 'url_map' AttributeError when accessing Blueprint directly.
    """
    try:
        blueprint_info = {
            "name": ai_bp.name,
            "url_prefix": ai_bp.url_prefix,
            "import_name": ai_bp.import_name,
            "routes": [],
        }

        # If we have access to current_app, we can get registered routes
        if current_app:
            for rule in current_app.url_map.iter_rules():
                if rule.endpoint.startswith(ai_bp.name + "."):
                    blueprint_info["routes"].append(
                        {
                            "endpoint": rule.endpoint,
                            "rule": rule.rule,
                            "methods": list(rule.methods),
                        }
                    )
        else:
            # Fallback: manually list known routes
            blueprint_info["routes"] = [
                {"endpoint": "ai.chat", "rule": "/chat", "methods": ["POST"]},
                {"endpoint": "ai.get_agents", "rule": "/agents", "methods": ["GET"]},
                {
                    "endpoint": "ai.toggle_agent",
                    "rule": "/agents/<agent_id>/toggle",
                    "methods": ["POST"],
                },
                {
                    "endpoint": "ai.get_workflow_templates",
                    "rule": "/workflows/templates",
                    "methods": ["GET"],
                },
                {
                    "endpoint": "ai.execute_workflow",
                    "rule": "/workflows/execute",
                    "methods": ["POST"],
                },
                {
                    "endpoint": "ai.get_workflow_executions",
                    "rule": "/workflows/executions",
                    "methods": ["GET"],
                },
                {
                    "endpoint": "ai.get_analytics",
                    "rule": "/analytics",
                    "methods": ["GET"],
                },
                {"endpoint": "ai.get_mcp_tools", "rule": "/tools", "methods": ["GET"]},
                {
                    "endpoint": "ai.execute_mcp_tool",
                    "rule": "/tools/execute",
                    "methods": ["POST"],
                },
                {
                    "endpoint": "ai.get_ai_settings",
                    "rule": "/settings",
                    "methods": ["GET"],
                },
                {
                    "endpoint": "ai.update_ai_settings",
                    "rule": "/settings",
                    "methods": ["POST"],
                },
                {"endpoint": "ai.health_check", "rule": "/health", "methods": ["GET"]},
                {
                    "endpoint": "ai.get_services_status",
                    "rule": "/services/status",
                    "methods": ["GET"],
                },
                {
                    "endpoint": "ai.get_chat_history",
                    "rule": "/chat/history/<conversation_id>",
                    "methods": ["GET"],
                },
                {
                    "endpoint": "ai.get_conversations",
                    "rule": "/chat/conversations",
                    "methods": ["GET"],
                },
                {
                    "endpoint": "ai.get_agent_details",
                    "rule": "/agents/<agent_id>",
                    "methods": ["GET"],
                },
                {"endpoint": "ai.test_route", "rule": "/test", "methods": ["GET"]},
                {
                    "endpoint": "ai.debug_info",
                    "rule": "/debug/info",
                    "methods": ["GET"],
                },
            ]

        return blueprint_info
    except Exception as e:
        return {
            "error": f"Failed to get blueprint info: {str(e)}",
            "name": ai_bp.name,
            "url_prefix": ai_bp.url_prefix,
        }


def init_ai_services(app):
    """Initialize AI services with app context"""
    global mcp_service, agent_registry, workflow_coordinator, conversation_manager

    # Service initialization status tracking
    service_status = {
        "conversation_manager": False,
        "ai_orchestrator": False,
        "mcp_service": False,
        "agent_registry": False,
        "workflow_coordinator": False,
    }

    with app.app_context():
        try:
            logger.app_logger.info("Starting AI services initialization...")

            # Initialize conversation manager (most basic service)
            try:
                logger.app_logger.info("Initializing conversation manager...")
                conversation_manager = SimpleConversationManager(logger)
                service_status["conversation_manager"] = True
                logger.app_logger.info("Conversation manager initialized successfully")
            except Exception as e:
                logger.app_logger.warning(
                    f"Failed to initialize conversation manager: {str(e)}"
                )
                conversation_manager = None

            # Initialize AI orchestrator
            ai_orchestrator = None
            try:
                logger.app_logger.info("Initializing AI orchestrator...")
                ai_orchestrator = create_ai_orchestrator(app)
                service_status["ai_orchestrator"] = True
                logger.app_logger.info("AI orchestrator initialized successfully")
            except Exception as e:
                logger.app_logger.warning(
                    f"Failed to initialize AI orchestrator: {str(e)}"
                )
                ai_orchestrator = None

            # Initialize MCP service
            try:
                logger.app_logger.info("Initializing MCP service...")
                mcp_service = SchichtplanMCPService(app, logger)
                service_status["mcp_service"] = True
                logger.app_logger.info("MCP service initialized successfully")
            except Exception as e:
                logger.app_logger.warning(f"Failed to initialize MCP service: {str(e)}")
                mcp_service = None

            # Initialize agent registry with AI orchestrator (only if orchestrator is available)
            if ai_orchestrator:
                try:
                    logger.app_logger.info("Initializing agent registry...")
                    agent_registry = AgentRegistry(ai_orchestrator, logger)
                    service_status["agent_registry"] = True
                    logger.app_logger.info("Agent registry initialized successfully")
                except Exception as e:
                    logger.app_logger.warning(
                        f"Failed to initialize agent registry: {str(e)}"
                    )
                    agent_registry = None
            else:
                logger.app_logger.warning(
                    "Skipping agent registry initialization - AI orchestrator not available"
                )
                agent_registry = None

            # Initialize workflow coordinator (only if orchestrator is available)
            if ai_orchestrator:
                try:
                    logger.app_logger.info("Initializing workflow coordinator...")
                    workflow_coordinator = WorkflowCoordinator(ai_orchestrator, logger)
                    service_status["workflow_coordinator"] = True
                    logger.app_logger.info(
                        "Workflow coordinator initialized successfully"
                    )
                except Exception as e:
                    logger.app_logger.warning(
                        f"Failed to initialize workflow coordinator: {str(e)}"
                    )
                    workflow_coordinator = None
            else:
                logger.app_logger.warning(
                    "Skipping workflow coordinator initialization - AI orchestrator not available"
                )
                workflow_coordinator = None

            # Log final service status
            successful_services = sum(service_status.values())
            total_services = len(service_status)

            logger.app_logger.info(
                f"AI services initialization completed: {successful_services}/{total_services} services available"
            )
            for service, status in service_status.items():
                status_text = "✓" if status else "✗"
                logger.app_logger.info(f"  {status_text} {service}")

            if successful_services == 0:
                logger.app_logger.error("No AI services were successfully initialized")
            elif successful_services < total_services:
                logger.app_logger.warning(
                    "Some AI services failed to initialize - system will run with degraded functionality"
                )
            else:
                logger.app_logger.info("All AI services initialized successfully")

        except Exception as e:
            logger.app_logger.error(
                f"Critical error during AI services initialization: {str(e)}"
            )
            logger.app_logger.error(f"Error traceback: {traceback.format_exc()}")
            # Set all services to None on critical failure
            mcp_service = None
            agent_registry = None
            workflow_coordinator = None
            conversation_manager = None


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

        # Validate message length
        if len(message) > 10000:  # 10KB limit
            return jsonify({"error": "Message too long (max 10,000 characters)"}), 400

        logger.app_logger.info(f"AI chat request: {message[:100]}...")

        # Check service availability before processing
        if not conversation_manager:
            return jsonify(
                {
                    "response": "Chat service temporarily unavailable. Please try again later.",
                    "conversation_id": conversation_id,
                    "metadata": {
                        "agent": "system",
                        "status": "service_unavailable",
                        "error": "Conversation manager not initialized",
                    },
                }
            ), 503

        # Handle async MCP service call
        async def handle_chat():
            try:
                # Get or create conversation
                conversation = conversation_manager.get_conversation(conversation_id)
                if not conversation:
                    conversation = conversation_manager.create_conversation(
                        user_id="web_user",  # TODO: Get from session
                        session_id=conversation_id,
                        title=f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                    )

                # Save user message
                user_message = conversation_manager.add_message(
                    conversation.id, message, MessageType.USER.value
                )

                if not user_message:
                    raise Exception("Failed to save user message")

                # Process with MCP service if available
                if mcp_service:
                    # Format request for MCP service
                    request_data = {
                        "conv_id": conversation.id,
                        "user_id": "web_user",  # TODO: Get from session
                        "session_id": conversation_id,
                        "request": message,
                        "request_type": "chat",
                    }

                    try:
                        response = await mcp_service.handle_request(request_data)
                        ai_response = response.get(
                            "response",
                            "I apologize, but I couldn't generate a proper response.",
                        )

                        # Save AI response
                        ai_message = conversation_manager.add_message(
                            conversation.id,
                            ai_response,
                            MessageType.AI.value,
                            {
                                "agent": response.get("agent", "system"),
                                "tools_used": response.get("tools_used", []),
                                "processing_time": response.get("processing_time", 0),
                            },
                        )

                        return {
                            "response": ai_response,
                            "conversation_id": conversation.id,
                            "metadata": {
                                "agent": response.get("agent", "system"),
                                "status": "success",
                                "tools_used": response.get("tools_used", []),
                                "processing_time": response.get("processing_time", 0),
                                "message_id": ai_message.id if ai_message else None,
                            },
                        }
                    except Exception as e:
                        logger.app_logger.error(f"MCP service error: {str(e)}")
                        error_response = "I encountered an error while processing your request. Please try again."

                        # Save error message
                        conversation_manager.add_message(
                            conversation.id,
                            error_response,
                            MessageType.SYSTEM.value,
                            {"error": str(e), "error_type": "mcp_service_error"},
                        )

                        return {
                            "response": error_response,
                            "conversation_id": conversation.id,
                            "metadata": {
                                "agent": "system",
                                "status": "error",
                                "error_type": "processing_error",
                            },
                        }
                else:
                    # Fallback response when MCP service is not available
                    fallback_response = "I'm currently operating in limited mode. Some advanced features may not be available. How can I help you with basic scheduling questions?"

                    # Save fallback response
                    ai_message = conversation_manager.add_message(
                        conversation.id,
                        fallback_response,
                        MessageType.AI.value,
                        {"agent": "fallback", "mode": "limited"},
                    )

                    return {
                        "response": fallback_response,
                        "conversation_id": conversation.id,
                        "metadata": {
                            "agent": "fallback",
                            "status": "limited_mode",
                            "message_id": ai_message.id if ai_message else None,
                        },
                    }

            except Exception as e:
                logger.app_logger.error(f"Chat handling error: {str(e)}")
                error_response = "I'm sorry, but I encountered an unexpected error. Please try again."

                # Try to save error message if conversation manager is available
                try:
                    if conversation_manager and "conversation" in locals():
                        conversation_manager.add_message(
                            conversation.id,
                            error_response,
                            MessageType.SYSTEM.value,
                            {"error": str(e), "error_type": "chat_handling_error"},
                        )
                except Exception:
                    pass  # Don't fail completely if we can't save error message

                return {
                    "response": error_response,
                    "conversation_id": conversation_id,
                    "metadata": {
                        "agent": "system",
                        "status": "error",
                        "error_type": "internal_error",
                    },
                }

        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            response = loop.run_until_complete(handle_chat())
            return jsonify(response)
        except Exception as e:
            logger.app_logger.error(f"Event loop error: {str(e)}")
            return jsonify(
                {
                    "response": "A system error occurred. Please try again.",
                    "conversation_id": conversation_id,
                    "metadata": {
                        "agent": "system",
                        "status": "error",
                        "error_type": "event_loop_error",
                    },
                }
            ), 500
        finally:
            loop.close()

    except Exception as e:
        logger.app_logger.error(f"AI chat error: {str(e)}")
        return jsonify(
            {
                "error": f"Failed to process chat request: {str(e)}",
                "conversation_id": conversation_id
                if "conversation_id" in locals()
                else "unknown",
                "metadata": {
                    "agent": "system",
                    "status": "error",
                    "error_type": "request_error",
                },
            }
        ), 500


@ai_bp.route("/agents", methods=["GET"])
def get_agents():
    """
    Get information about available AI agents
    """
    try:
        if agent_registry is None:
            logger.app_logger.warning(
                "Agent registry not available, returning mock data"
            )
            # Return minimal mock data when service unavailable
            mock_agents = [
                {
                    "id": "schedule_optimizer",
                    "name": "Schedule Optimizer Agent",
                    "type": "schedule_optimizer",
                    "description": "Specialized in schedule optimization and conflict resolution",
                    "status": "inactive",
                    "capabilities": [
                        "Schedule Conflict Detection",
                        "Workload Optimization",
                    ],
                    "performance": {
                        "total_requests": 0,
                        "success_rate": 0,
                        "avg_response_time": 0,
                        "last_active": None,
                    },
                },
            ]
            return jsonify(mock_agents)

        # Get real agent data from registry
        registry_status = agent_registry.get_registry_status()
        agents_data = []

        for agent_info in registry_status["agents"]:
            agent_data = {
                "id": agent_info["agent_id"],
                "name": agent_info["name"],
                "type": agent_info["agent_id"],
                "description": f"AI agent with capabilities: {', '.join(agent_info['capabilities'])}",
                "status": "active" if agent_info["enabled"] else "inactive",
                "capabilities": agent_info["capabilities"],
                "performance": {
                    "total_requests": agent_info["total_requests"],
                    "success_rate": agent_info["success_rate"] * 100,
                    "avg_response_time": 0,  # TODO: Implement response time tracking
                    "last_active": agent_info["last_used"],
                },
            }
            agents_data.append(agent_data)

        return jsonify(agents_data)

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

        if agent_registry is None:
            logger.app_logger.warning("Agent registry not available")
            return jsonify({"error": "Agent registry not available"}), 503

        # Try to toggle agent in registry
        if enabled:
            success = agent_registry.enable_agent(agent_id)
        else:
            success = agent_registry.disable_agent(agent_id)

        if not success:
            return jsonify({"error": f"Agent '{agent_id}' not found"}), 404

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
        if mcp_service is None:
            logger.app_logger.warning("MCP service not available, returning mock data")
            # Return minimal mock data when service unavailable
            tools = [
                {
                    "id": "service_unavailable",
                    "name": "Service Unavailable",
                    "description": "MCP service not initialized",
                    "category": "system",
                    "parameters": [],
                    "status": "unavailable",
                    "usage_count": 0,
                    "last_used": None,
                }
            ]
            return jsonify(tools)

        # Get available tools from the MCP service
        # For now, return the known tools from the tool classes
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
                        "description": "Start date for analysis (YYYY-MM-DD)",
                    },
                    {
                        "name": "end_date",
                        "type": "string",
                        "required": True,
                        "description": "End date for analysis (YYYY-MM-DD)",
                    },
                ],
                "status": "available",
                "usage_count": 0,
                "last_used": None,
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
                    {
                        "name": "end_date",
                        "type": "string",
                        "required": True,
                        "description": "End date for availability query",
                    },
                ],
                "status": "available",
                "usage_count": 0,
                "last_used": None,
            },
            {
                "id": "optimize_schedule_ai",
                "name": "AI Schedule Optimization",
                "description": "Use AI to optimize schedule based on constraints and preferences",
                "category": "optimization",
                "parameters": [
                    {
                        "name": "start_date",
                        "type": "string",
                        "required": True,
                        "description": "Start date for optimization",
                    },
                    {
                        "name": "end_date",
                        "type": "string",
                        "required": True,
                        "description": "End date for optimization",
                    },
                    {
                        "name": "optimization_goals",
                        "type": "array",
                        "required": False,
                        "description": "List of optimization goals",
                    },
                ],
                "status": "available",
                "usage_count": 0,
                "last_used": None,
            },
            {
                "id": "get_coverage_requirements",
                "name": "Get Coverage Requirements",
                "description": "Get coverage requirements for scheduling",
                "category": "coverage",
                "parameters": [
                    {
                        "name": "query_date",
                        "type": "string",
                        "required": False,
                        "description": "Specific date for coverage query (YYYY-MM-DD)",
                    },
                ],
                "status": "available",
                "usage_count": 0,
                "last_used": None,
            },
            {
                "id": "get_schedule_statistics",
                "name": "Get Schedule Statistics",
                "description": "Get comprehensive schedule statistics for analysis",
                "category": "analytics",
                "parameters": [
                    {
                        "name": "start_date",
                        "type": "string",
                        "required": True,
                        "description": "Start date for statistics",
                    },
                    {
                        "name": "end_date",
                        "type": "string",
                        "required": True,
                        "description": "End date for statistics",
                    },
                ],
                "status": "available",
                "usage_count": 0,
                "last_used": None,
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

        # Validate tool_id format
        if not isinstance(tool_id, str) or len(tool_id) > 100:
            return jsonify({"error": "Invalid tool ID format"}), 400

        # Validate parameters
        if not isinstance(parameters, dict):
            return jsonify({"error": "Parameters must be a dictionary"}), 400

        if not mcp_service:
            return jsonify(
                {
                    "success": False,
                    "error": "MCP service not available",
                    "result": {
                        "tool_id": tool_id,
                        "parameters": parameters,
                        "output": "Tool execution service is currently unavailable",
                        "execution_time": 0,
                    },
                }
            ), 503

        # Execute tool through MCP service
        async def execute_tool():
            start_time = datetime.now()
            try:
                # Format the request for MCP service
                request_data = {
                    "conv_id": "tool_execution",
                    "user_id": "web_user",
                    "session_id": "tool_execution",
                    "request": f"Execute tool {tool_id} with parameters: {parameters}",
                    "request_type": "tool_execution",
                    "tool_id": tool_id,
                    "tool_parameters": parameters,
                }

                response = await mcp_service.handle_request(request_data)
                execution_time = (datetime.now() - start_time).total_seconds()

                return {
                    "success": True,
                    "result": {
                        "tool_id": tool_id,
                        "parameters": parameters,
                        "output": response.get("response", "No output"),
                        "execution_time": execution_time,
                        "metadata": response.get("metadata", {}),
                        "tools_used": response.get("tools_used", [tool_id]),
                        "status": "completed",
                    },
                    "execution_time": execution_time,
                }

            except Exception as e:
                execution_time = (datetime.now() - start_time).total_seconds()
                logger.app_logger.error(f"Tool execution error: {str(e)}")
                return {
                    "success": False,
                    "error": str(e),
                    "result": {
                        "tool_id": tool_id,
                        "parameters": parameters,
                        "output": f"Error executing tool: {str(e)}",
                        "execution_time": execution_time,
                        "status": "failed",
                        "error_type": "execution_error",
                    },
                    "execution_time": execution_time,
                }

        # Run async function in event loop with timeout
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            # Add timeout to prevent hanging
            result = loop.run_until_complete(
                asyncio.wait_for(execute_tool(), timeout=30.0)  # 30 second timeout
            )
            return jsonify(result)
        except asyncio.TimeoutError:
            logger.app_logger.error(f"Tool execution timeout for tool: {tool_id}")
            return jsonify(
                {
                    "success": False,
                    "error": "Tool execution timeout",
                    "result": {
                        "tool_id": tool_id,
                        "parameters": parameters,
                        "output": "Tool execution timed out after 30 seconds",
                        "execution_time": 30.0,
                        "status": "timeout",
                        "error_type": "timeout_error",
                    },
                }
            ), 408
        except Exception as e:
            logger.app_logger.error(f"Event loop error during tool execution: {str(e)}")
            return jsonify(
                {
                    "success": False,
                    "error": f"System error: {str(e)}",
                    "result": {
                        "tool_id": tool_id,
                        "parameters": parameters,
                        "output": f"System error during tool execution: {str(e)}",
                        "execution_time": 0,
                        "status": "system_error",
                        "error_type": "system_error",
                    },
                }
            ), 500
        finally:
            loop.close()

    except Exception as e:
        logger.app_logger.error(f"MCP tool execution error: {str(e)}")
        return jsonify(
            {
                "success": False,
                "error": f"Failed to execute MCP tool: {str(e)}",
                "result": {
                    "tool_id": tool_id if "tool_id" in locals() else "unknown",
                    "parameters": parameters if "parameters" in locals() else {},
                    "output": f"Request processing error: {str(e)}",
                    "execution_time": 0,
                    "status": "request_error",
                    "error_type": "request_processing_error",
                },
            }
        ), 500


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


@ai_bp.route("/chat/history/<conversation_id>", methods=["GET"])
def get_chat_history(conversation_id):
    """
    Get conversation history for a specific conversation
    """
    try:
        if conversation_manager is None:
            return jsonify({"error": "Conversation manager not available"}), 503

        # Get conversation history
        messages = conversation_manager.get_conversation_history(conversation_id)

        # Convert to frontend format
        history = []
        for message in messages:
            history.append(
                {
                    "id": message.id,
                    "content": message.content,
                    "role": "user"
                    if message.type == MessageType.USER.value
                    else "assistant",
                    "timestamp": message.timestamp,
                    "metadata": message.message_metadata or {},  # Use message_metadata
                }
            )

        return jsonify(history)

    except Exception as e:
        logger.app_logger.error(f"Get chat history error: {str(e)}")
        return jsonify({"error": f"Failed to get chat history: {str(e)}"}), 500


@ai_bp.route("/chat/conversations", methods=["GET"])
def get_conversations():
    """
    Get list of all conversations
    """
    try:
        if conversation_manager is None:
            return jsonify({"error": "Conversation manager not available"}), 503

        # Get conversations
        conversations = conversation_manager.get_conversations(limit=100)

        # Convert to frontend format
        conversations_list = []
        for conv in conversations:
            conversations_list.append(
                {
                    "id": conv.id,
                    "title": conv.title,
                    "created_at": conv.created_at.isoformat()
                    if conv.created_at
                    else None,
                    "last_message_at": conv.last_message_at.isoformat()
                    if conv.last_message_at
                    else None,
                    "message_count": conv.message_count,
                    "status": conv.status,
                }
            )

        return jsonify(conversations_list)

    except Exception as e:
        logger.app_logger.error(f"Get conversations error: {str(e)}")
        return jsonify({"error": f"Failed to get conversations: {str(e)}"}), 500


@ai_bp.route("/agents/<agent_id>", methods=["GET"])
def get_agent_details(agent_id):
    """
    Get specific agent details
    """
    try:
        if agent_registry is None:
            return jsonify({"error": "Agent registry not available"}), 503

        agent = agent_registry.get_agent_by_id(agent_id)
        if not agent:
            return jsonify({"error": f"Agent '{agent_id}' not found"}), 404

        # Get registry status to find this agent's info
        registry_status = agent_registry.get_registry_status()
        agent_info = None
        for agent_data in registry_status["agents"]:
            if agent_data["agent_id"] == agent_id:
                agent_info = agent_data
                break

        if not agent_info:
            return jsonify({"error": f"Agent '{agent_id}' not found in registry"}), 404

        detailed_info = {
            "id": agent_info["agent_id"],
            "name": agent_info["name"],
            "type": agent_info["agent_id"],
            "description": f"AI agent with capabilities: {', '.join(agent_info['capabilities'])}",
            "status": "active" if agent_info["enabled"] else "inactive",
            "capabilities": agent_info["capabilities"],
            "performance": {
                "total_requests": agent_info["total_requests"],
                "success_rate": agent_info["success_rate"] * 100,
                "avg_response_time": 0,  # TODO: Implement response time tracking
                "last_active": agent_info["last_used"],
            },
            "configuration": {
                "priority": agent_info["priority"],
                "enabled": agent_info["enabled"],
            },
        }

        return jsonify(detailed_info)

    except Exception as e:
        logger.app_logger.error(f"Get agent details error: {str(e)}")
        return jsonify({"error": f"Failed to get agent details: {str(e)}"}), 500


@ai_bp.route("/test", methods=["GET"])
def test_route():
    """Simple test route to verify AI blueprint is working"""
    return jsonify(
        {
            "message": "AI blueprint is working!",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "mcp_service": mcp_service is not None,
                "agent_registry": agent_registry is not None,
                "workflow_coordinator": workflow_coordinator is not None,
                "conversation_manager": conversation_manager is not None,
            },
        }
    )


@ai_bp.route("/debug/info", methods=["GET"])
def debug_info():
    """
    Debug route to get blueprint information safely
    """
    try:
        blueprint_info = get_blueprint_info()
        return jsonify(
            {
                "blueprint_info": blueprint_info,
                "services_status": {
                    "mcp_service": mcp_service is not None,
                    "agent_registry": agent_registry is not None,
                    "workflow_coordinator": workflow_coordinator is not None,
                    "conversation_manager": conversation_manager is not None,
                },
                "registration_status": "registered"
                if current_app
                else "not_registered",
            }
        )
    except Exception as e:
        logger.app_logger.error(f"Debug info error: {str(e)}")
        return jsonify({"error": f"Failed to get debug info: {str(e)}"}), 500


@ai_bp.route("/services/status", methods=["GET"])
def get_services_status():
    """
    Get detailed status of all AI services
    """
    try:
        status = {
            "overall_health": "healthy",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "conversation_manager": {
                    "available": conversation_manager is not None,
                    "status": "active"
                    if conversation_manager is not None
                    else "inactive",
                    "description": "Manages chat conversations and message history",
                },
                "mcp_service": {
                    "available": mcp_service is not None,
                    "status": "active" if mcp_service is not None else "inactive",
                    "description": "Model Context Protocol service for AI tool integration",
                },
                "agent_registry": {
                    "available": agent_registry is not None,
                    "status": "active" if agent_registry is not None else "inactive",
                    "description": "Registry for AI agents and their capabilities",
                },
                "workflow_coordinator": {
                    "available": workflow_coordinator is not None,
                    "status": "active"
                    if workflow_coordinator is not None
                    else "inactive",
                    "description": "Coordinates complex AI workflows and processes",
                },
            },
            "capabilities": [],
            "limitations": [],
        }

        # Count active services
        active_services = sum(
            1 for service in status["services"].values() if service["available"]
        )
        total_services = len(status["services"])

        # Determine overall health
        if active_services == 0:
            status["overall_health"] = "critical"
        elif active_services < total_services:
            status["overall_health"] = "degraded"
        else:
            status["overall_health"] = "healthy"

        # Add capabilities based on available services
        if conversation_manager:
            status["capabilities"].append("Chat conversations")
            status["capabilities"].append("Message history")

        if mcp_service:
            status["capabilities"].append("AI tool execution")
            status["capabilities"].append("Schedule analysis")
            status["capabilities"].append("Employee management")

        if agent_registry:
            status["capabilities"].append("AI agent management")
            status["capabilities"].append("Multi-agent coordination")

        if workflow_coordinator:
            status["capabilities"].append("Complex workflow execution")
            status["capabilities"].append("Multi-step automation")

        # Add limitations based on missing services
        if not conversation_manager:
            status["limitations"].append("No conversation persistence")

        if not mcp_service:
            status["limitations"].append("Limited AI tool integration")

        if not agent_registry:
            status["limitations"].append("No agent management")

        if not workflow_coordinator:
            status["limitations"].append("No complex workflow support")

        status["summary"] = f"{active_services}/{total_services} services active"

        return jsonify(status)

    except Exception as e:
        logger.app_logger.error(f"Services status error: {str(e)}")
        return jsonify(
            {
                "overall_health": "error",
                "error": f"Failed to get services status: {str(e)}",
                "timestamp": datetime.now().isoformat(),
            }
        ), 500


# Defensive fix for Blueprint url_map access
# Some debugging scripts try to access ai_bp.url_map.iter_rules() which doesn't exist
# This provides a safe fallback
def _safe_url_map_access():
    """
    Create a mock url_map object for Blueprint debugging.
    This prevents AttributeError when scripts try to access ai_bp.url_map
    """

    class MockUrlMap:
        def iter_rules(self):
            """Return empty iterator to prevent errors"""
            if current_app:
                # If we have app context, return actual rules for this blueprint
                for rule in current_app.url_map.iter_rules():
                    if rule.endpoint.startswith("ai."):
                        yield rule
            else:
                # Return empty iterator if no app context
                return iter([])

    return MockUrlMap()


# Add the mock url_map to the blueprint if it doesn't exist
if not hasattr(ai_bp, "url_map"):
    ai_bp.url_map = _safe_url_map_access()
