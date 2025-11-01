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
        registered_resources = mcp_service.get_registered_resources()

        resources = []
        for resource_uri, resource_info in registered_resources.items():
            resources.append({
                "uri": resource_uri,
                "description": resource_info.get("description", "No description available"),
            })

        return jsonify({"resources": resources, "count": len(resources)})

    except Exception as e:
        logger.error(f"Error listing MCP resources: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/mcp/prompts", methods=["GET"])
def list_mcp_prompts():
    """List all available MCP prompts."""
    try:
        mcp_service = get_mcp_service()
        registered_prompts = mcp_service.get_registered_prompts()

        prompts = []
        for prompt_name, prompt_info in registered_prompts.items():
            prompts.append({
                "name": prompt_name,
                "description": prompt_info.get("description", "No description available"),
            })

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
        registered_tools = mcp_service.get_registered_tools()

        if tool_name not in registered_tools:
            return jsonify({
                "error": f'Tool "{tool_name}" not found',
                "available_tools": list(registered_tools.keys())
            }), 404

        tool_info = registered_tools[tool_name]

        # Return tool info and validation result
        # Note: Direct tool execution requires using the MCP protocol (stdio/SSE/HTTP)
        # For actual execution, use the MCP client or /mcp/execute-tool endpoint
        return jsonify(
            {
                "status": "validated",
                "tool_name": tool_name,
                "tool_info": tool_info,
                "parameters_provided": parameters,
                "message": "Tool found and validated. For execution, use MCP protocol or /mcp/execute-tool endpoint.",
            }
        )

    except Exception as e:
        logger.error(f"Error testing MCP tool: {str(e)}", exc_info=True)
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
        registered_tools = mcp_service.get_registered_tools()

        if tool_name not in registered_tools:
            return jsonify(
                {
                    "status": "error",
                    "error": f'Tool "{tool_name}" not found',
                    "available_tools": list(registered_tools.keys()),
                }
            ), 404

        # Get tool info and category
        tool_info = registered_tools[tool_name]
        category = tool_info.get("category")

        # Get the tool instance using the category mapping
        tool_instance = mcp_service.get_tool_instance_by_category(category)

        if not tool_instance:
            return jsonify(
                {
                    "status": "error",
                    "error": f"Tool category '{category}' not found",
                    "message": "For full tool execution, use the MCP protocol (stdio/SSE/HTTP) with an MCP client"
                }
            ), 500

        # Note: Direct execution is limited. For full MCP protocol support,
        # clients should use stdio/SSE/HTTP transports with the MCP server
        return jsonify(
            {
                "status": "info",
                "tool_name": tool_name,
                "tool_info": tool_info,
                "parameters_provided": parameters,
                "conversation_id": conversation_id,
                "message": "Tool found. For execution, use the MCP server via stdio/SSE/HTTP transports with an MCP client, or use the AI conversation endpoints.",
                "alternative_endpoints": {
                    "ai_conversation": "/api/v2/ai-conversation/chat",
                    "mcp_stdio": "python src/backend/mcp_server.py",
                    "mcp_sse": "http://localhost:8001/sse",
                }
            }
        )

    except Exception as e:
        logger.error(f"Error executing MCP tool: {str(e)}", exc_info=True)
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
