import asyncio
from datetime import datetime

from flask import Blueprint, jsonify, request
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


def init_ai_services(app):
    """Initialize AI services with app context"""
    global mcp_service, agent_registry, workflow_coordinator, conversation_manager
    with app.app_context():
        try:
            # Initialize conversation manager
            conversation_manager = SimpleConversationManager(logger)

            # Initialize AI orchestrator
            ai_orchestrator = create_ai_orchestrator(app)

            # Initialize MCP service
            mcp_service = SchichtplanMCPService(app, logger)

            # Initialize agent registry with AI orchestrator
            agent_registry = AgentRegistry(ai_orchestrator, logger)

            # Initialize workflow coordinator
            workflow_coordinator = WorkflowCoordinator(ai_orchestrator, logger)

            logger.app_logger.info("AI services initialized successfully")
        except Exception as e:
            logger.app_logger.error(f"Failed to initialize AI services: {str(e)}")
            # Set services to None to indicate they're not available
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

        logger.app_logger.info(f"AI chat request: {message[:100]}...")

        # Handle async MCP service call
        async def handle_chat():
            if mcp_service and conversation_manager:
                # Get or create conversation
                conversation = conversation_manager.get_conversation(conversation_id)
                if not conversation:
                    conversation = conversation_manager.create_conversation(
                        user_id="web_user",  # TODO: Get from session
                        session_id=conversation_id,
                        title=f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                    )

                # Save user message
                conversation_manager.add_message(
                    conversation.id, message, MessageType.USER.value
                )

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
                    ai_response = response.get("response", "No response generated")

                    # Save AI response
                    conversation_manager.add_message(
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
                        },
                    }
                except Exception as e:
                    logger.app_logger.error(f"MCP service error: {str(e)}")
                    error_response = f"Error processing request: {str(e)}"

                    # Save error message
                    conversation_manager.add_message(
                        conversation.id,
                        error_response,
                        MessageType.SYSTEM.value,
                        {"error": str(e)},
                    )

                    return {
                        "response": error_response,
                        "conversation_id": conversation.id,
                        "metadata": {"agent": "system", "status": "error"},
                    }
            else:
                return {
                    "response": "AI service not available. Please check system configuration.",
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

        if mcp_service is None:
            return jsonify({"error": "MCP service not available"}), 503

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
                    },
                    "execution_time": execution_time,
                }

        # Run async function in event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(execute_tool())
        finally:
            loop.close()

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
