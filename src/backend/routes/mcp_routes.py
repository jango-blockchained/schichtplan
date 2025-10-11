"""
MCP Routes for Flask Integration

This module provides Flask routes for integrating FastMCP functionality
into the existing Schichtplan web application.
"""

import asyncio
import json
import logging

from flask import Blueprint, current_app, jsonify, request

from src.backend.services.mcp_service import SchichtplanMCPService

# Create blueprint for MCP routes
bp = Blueprint("mcp", __name__)
logger = logging.getLogger(__name__)

# Global MCP service instance
_mcp_service = None


def get_mcp_service() -> SchichtplanMCPService:
    """Get or create the global MCP service instance."""
    global _mcp_service
    if _mcp_service is None:
        _mcp_service = SchichtplanMCPService(current_app._get_current_object())
    return _mcp_service


@bp.route("/mcp/status", methods=["GET"])
def mcp_status():
    """Get MCP service status and available tools."""
    try:
        mcp_service = get_mcp_service()

        # Use async method to get comprehensive status
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            dashboard_data = loop.run_until_complete(
                mcp_service.get_mcp_status_dashboard()
            )
            return jsonify(dashboard_data)
        finally:
            loop.close()

    except Exception as e:
        logger.error(f"Error getting MCP status: {e}")
        return jsonify(
            {
                "status": "error",
                "error": str(e),
                "server_name": "Schichtplan-MCP-Service",
                "tools_count": 0,
                "resources_count": 0,
                "prompts_count": 0,
                "transports": ["stdio", "sse", "streamable-http"],
            }
        ), 500


@bp.route("/mcp/tools", methods=["GET"])
def list_mcp_tools():
    """List all available MCP tools with their descriptions."""
    try:
        mcp_service = get_mcp_service()

        # Use async method to get tool discovery
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            tools_data = loop.run_until_complete(mcp_service.get_mcp_tool_discovery())
            return jsonify(tools_data)
        finally:
            loop.close()

    except Exception as e:
        logger.error("Error listing MCP tools: %s", str(e))
        return jsonify(
            {
                "available_tools": [],
                "categories": {},
                "total_count": 0,
                "error": str(e),
            }
        ), 500


@bp.route("/mcp/resources", methods=["GET"])
def list_mcp_resources():
    """List all available MCP resources."""
    try:
        mcp_service = get_mcp_service()
        mcp_server = mcp_service.get_mcp_server()

        resources = []
        for resource_name, resource_func in mcp_server._resources.items():
            resource_info = {
                "uri": resource_name,
                "description": resource_func.__doc__ or "No description available",
            }
            resources.append(resource_info)

        return jsonify({"resources": resources, "count": len(resources)})

    except Exception as e:
        logger.error(f"Error listing MCP resources: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/mcp/prompts", methods=["GET"])
def list_mcp_prompts():
    """List all available MCP prompts."""
    try:
        mcp_service = get_mcp_service()
        mcp_server = mcp_service.get_mcp_server()

        prompts = []
        for prompt_name, prompt_func in mcp_server._prompts.items():
            prompt_info = {
                "name": prompt_name,
                "description": prompt_func.__doc__ or "No description available",
            }
            prompts.append(prompt_info)

        return jsonify({"prompts": prompts, "count": len(prompts)})

    except Exception as e:
        logger.error(f"Error listing MCP prompts: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/mcp/test-tool", methods=["POST"])
def test_mcp_tool():
    """Test an MCP tool with provided parameters."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        tool_name = data.get("tool_name")
        parameters = data.get("parameters", {})

        if not tool_name:
            return jsonify({"error": "tool_name is required"}), 400

        mcp_service = get_mcp_service()
        mcp_server = mcp_service.get_mcp_server()

        if tool_name not in mcp_server._tools:
            return jsonify({"error": f'Tool "{tool_name}" not found'}), 404

        # Create a test execution - this is simplified for web usage
        # In a real scenario, you'd use the full MCP client/server protocol
        tool_func = mcp_server._tools[tool_name]

        # Create a mock context for testing
        class MockContext:
            def __init__(self):
                self.logs = []

            async def info(self, message: str):
                self.logs.append(f"INFO: {message}")

            async def error(self, message: str):
                self.logs.append(f"ERROR: {message}")

            async def warning(self, message: str):
                self.logs.append(f"WARNING: {message}")

        # Run the tool function
        mock_ctx = MockContext()
        if "ctx" in tool_func.__code__.co_varnames:
            parameters["ctx"] = mock_ctx

        # Execute the tool
        if asyncio.iscoroutinefunction(tool_func):
            result = asyncio.run(tool_func(**parameters))
        else:
            result = tool_func(**parameters)

        return jsonify(
            {
                "status": "success",
                "tool_name": tool_name,
                "result": result,
                "logs": mock_ctx.logs,
            }
        )

    except Exception as e:
        logger.error(f"Error testing MCP tool: {str(e)}")
        return jsonify({"status": "error", "error": str(e)}), 500


@bp.route("/mcp/execute-tool", methods=["POST"])
def execute_mcp_tool():
    """Execute an MCP tool with provided parameters (general endpoint)."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        tool_name = data.get("tool") or data.get("tool_name")
        parameters = data.get("parameters", {})
        conversation_id = data.get("conversation_id")
        # user_id and session_id reserved for future use
        # user_id = data.get("user_id")
        # session_id = data.get("session_id")

        if not tool_name:
            return jsonify({"error": "tool or tool_name is required"}), 400

        mcp_service = get_mcp_service()
        mcp_server = mcp_service.get_mcp_server()

        if tool_name not in mcp_server._tools:
            return jsonify(
                {
                    "status": "error",
                    "error": f'Tool "{tool_name}" not found',
                    "available_tools": list(mcp_server._tools.keys()),
                }
            ), 404

        # Create execution context
        class ExecutionContext:
            def __init__(self):
                self.logs = []
                self.warnings = []
                self.errors = []

            async def info(self, message: str):
                self.logs.append({"level": "info", "message": message})

            async def error(self, message: str):
                self.errors.append(message)
                self.logs.append({"level": "error", "message": message})

            async def warning(self, message: str):
                self.warnings.append(message)
                self.logs.append({"level": "warning", "message": message})

        # Get tool function
        tool_func = mcp_server._tools[tool_name]
        exec_ctx = ExecutionContext()

        # Prepare parameters with context
        exec_params = parameters.copy()
        if "ctx" in tool_func.__code__.co_varnames:
            exec_params["ctx"] = exec_ctx

        # Execute the tool
        try:
            if asyncio.iscoroutinefunction(tool_func):
                result = asyncio.run(tool_func(**exec_params))
            else:
                result = tool_func(**exec_params)

            return jsonify(
                {
                    "status": "success",
                    "tool_name": tool_name,
                    "result": result,
                    "logs": exec_ctx.logs,
                    "warnings": exec_ctx.warnings,
                    "errors": exec_ctx.errors,
                    "conversation_id": conversation_id,
                }
            )

        except Exception as tool_error:
            logger.error(f"Tool execution error for {tool_name}: {tool_error}")
            return jsonify(
                {
                    "status": "error",
                    "tool_name": tool_name,
                    "error": str(tool_error),
                    "logs": exec_ctx.logs,
                    "warnings": exec_ctx.warnings,
                    "errors": exec_ctx.errors,
                }
            ), 500

    except Exception as e:
        logger.error(f"Error executing MCP tool: {str(e)}")
        return jsonify({"status": "error", "error": str(e)}), 500


@bp.route("/mcp/config", methods=["GET"])
def get_mcp_config():
    """Get MCP server configuration for client connections."""
    try:
        # This provides configuration information for MCP clients
        config = {
            "server_name": "Schichtplan MCP Server",
            "version": "1.0.0",
            "endpoints": {
                "stdio": {
                    "description": "Run via command line",
                    "command": "python",
                    "args": ["src/backend/mcp_server.py"],
                    "example": "python src/backend/mcp_server.py",
                },
                "sse": {
                    "description": "Server-Sent Events endpoint",
                    "url_template": "http://{host}:{port}/sse",
                    "default_port": 8001,
                    "example": "http://localhost:8001/sse",
                },
                "streamable_http": {
                    "description": "Streamable HTTP endpoint",
                    "url_template": "http://{host}:{port}/mcp",
                    "default_port": 8002,
                    "example": "http://localhost:8002/mcp",
                },
            },
            "capabilities": {
                "tools": True,
                "resources": True,
                "prompts": True,
                "logging": True,
            },
        }

        return jsonify(config)

    except Exception as e:
        logger.error(f"Error getting MCP config: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/mcp/health", methods=["GET"])
def mcp_health():
    """Health check endpoint for MCP service."""
    try:
        # Initialize MCP service to ensure it's available
        get_mcp_service()

        # Test database connectivity through a simple query
        from src.backend.models import Employee

        employee_count = Employee.query.count()

        return jsonify(
            {
                "status": "healthy",
                "timestamp": json.dumps(None, default=str),
                "database": "connected",
                "employees_count": employee_count,
                "mcp_service": "active",
            }
        )

    except Exception as e:
        logger.error("MCP health check failed: %s", str(e))
        return jsonify({"status": "unhealthy", "error": str(e)}), 500
