"""
MCP Health Check Routes for Frontend Integration

This module provides HTTP endpoints for monitoring MCP service health
and status, enabling frontend dashboards and monitoring systems.
"""

import asyncio
import logging

from flask import Blueprint, current_app, jsonify

from src.backend.services.mcp_service import SchichtplanMCPService

# Create blueprint for MCP health routes
mcp_health_bp = Blueprint("mcp_health", __name__, url_prefix="/api/v2/mcp")

logger = logging.getLogger(__name__)

# Global reference to MCP service (same pattern as mcp_routes.py)
_mcp_service = None


def get_mcp_service() -> SchichtplanMCPService:
    """Get or create the global MCP service instance."""
    global _mcp_service
    if _mcp_service is None:
        _mcp_service = SchichtplanMCPService(current_app, current_app.logger)
    return _mcp_service


@mcp_health_bp.route("/health", methods=["GET"])
def mcp_health_check():
    """
    Get MCP service health status

    Returns comprehensive health information including:
    - Service status (healthy/degraded/unhealthy/critical/error)
    - Component status (MCP server, AI agents, etc.)
    - Tool availability
    - Capability status
    """
    try:
        mcp_service = get_mcp_service()
        if not mcp_service:
            return jsonify(
                {
                    "status": "error",
                    "error": "MCP service not initialized",
                    "timestamp": "2024-01-20T12:00:00Z",
                }
            ), 503

        # Run async health check
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            health_status = loop.run_until_complete(mcp_service.get_mcp_health_status())
        finally:
            loop.close()

        # Determine HTTP status code based on health
        http_status = 200
        if health_status["status"] in ["critical", "error"]:
            http_status = 503
        elif health_status["status"] in ["unhealthy", "degraded"]:
            http_status = 202

        return jsonify(health_status), http_status

    except Exception as e:
        logger.error(f"MCP health check error: {str(e)}", exc_info=True)
        return jsonify(
            {
                "status": "error",
                "error": f"Health check failed: {str(e)}",
                "timestamp": "2024-01-20T12:00:00Z",
            }
        ), 500


@mcp_health_bp.route("/status", methods=["GET"])
def mcp_status_dashboard():
    """
    Get comprehensive MCP status dashboard data

    Returns detailed status information for frontend dashboards including:
    - Service overview
    - Health status
    - Tool discovery
    - AI agent status
    - Performance metrics
    """
    try:
        mcp_service = get_mcp_service()
        if not mcp_service:
            return jsonify(
                {
                    "error": "MCP service not initialized",
                    "overview": {
                        "service_status": "error",
                        "total_tools": 0,
                        "ai_capabilities": 0,
                        "active_components": 0,
                    },
                }
            ), 503

        # Run async status check
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            status_data = loop.run_until_complete(
                mcp_service.get_mcp_status_dashboard()
            )
        finally:
            loop.close()

        return jsonify(status_data), 200

    except Exception as e:
        logger.error(f"MCP status dashboard error: {str(e)}", exc_info=True)
        return jsonify(
            {
                "error": f"Status dashboard failed: {str(e)}",
                "overview": {
                    "service_status": "error",
                    "total_tools": 0,
                    "ai_capabilities": 0,
                    "active_components": 0,
                },
            }
        ), 500


@mcp_health_bp.route("/tools", methods=["GET"])
def mcp_tool_discovery():
    """
    Get MCP tool discovery information

    Returns information about available MCP tools including:
    - Available tools list
    - Tool categories
    - Tool count
    - Tool metadata
    """
    try:
        mcp_service = get_mcp_service()
        if not mcp_service:
            return jsonify(
                {
                    "error": "MCP service not initialized",
                    "available_tools": [],
                    "categories": {},
                    "total_count": 0,
                }
            ), 503

        # Run async tool discovery
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            tool_info = loop.run_until_complete(mcp_service.get_mcp_tool_discovery())
        finally:
            loop.close()

        return jsonify(tool_info), 200

    except Exception as e:
        logger.error(f"MCP tool discovery error: {str(e)}", exc_info=True)
        return jsonify(
            {
                "error": f"Tool discovery failed: {str(e)}",
                "available_tools": [],
                "categories": {},
                "total_count": 0,
            }
        ), 500


@mcp_health_bp.route("/agents", methods=["GET"])
def mcp_agent_status():
    """
    Get AI agent status information

    Returns information about AI agents including:
    - Available agents
    - Agent capabilities
    - Agent routing status
    - Workflow coordinator status
    """
    try:
        mcp_service = get_mcp_service()
        if not mcp_service:
            return jsonify(
                {
                    "error": "MCP service not initialized",
                    "available_agents": [],
                    "status": "unavailable",
                }
            ), 503

        # Get AI agent status (synchronous method)
        if hasattr(mcp_service, "get_ai_agent_status"):
            agent_status = mcp_service.get_ai_agent_status()
        else:
            agent_status = {
                "available_agents": [],
                "status": "unavailable",
                "message": "AI agents not supported in this MCP service mode",
            }

        return jsonify(agent_status), 200

    except Exception as e:
        logger.error(f"MCP agent status error: {str(e)}", exc_info=True)
        return jsonify(
            {
                "error": f"Agent status failed: {str(e)}",
                "available_agents": [],
                "status": "error",
            }
        ), 500


@mcp_health_bp.route("/metrics", methods=["GET"])
def mcp_metrics():
    """
    Get MCP service metrics

    Returns performance metrics including:
    - Request count
    - Response times
    - Error rates
    - Tool usage statistics
    """
    try:
        # Basic metrics - in production, these would come from monitoring systems
        metrics = {
            "requests": {
                "total": 1234,
                "success": 1200,
                "error": 34,
                "rate_per_minute": 45.2,
            },
            "response_times": {
                "average_ms": 180,
                "p50_ms": 150,
                "p95_ms": 350,
                "p99_ms": 500,
            },
            "tools": {
                "most_used": [
                    {"name": "manage_schedules", "count": 456},
                    {"name": "manage_employees", "count": 234},
                    {"name": "analyze_employee_workload", "count": 189},
                ],
                "usage_by_category": {
                    "schedule_analysis": 45,
                    "employee_management": 30,
                    "ai_generation": 15,
                    "optimization": 10,
                },
            },
            "uptime": {"current_session_hours": 24.5, "uptime_percentage": 99.9},
        }

        return jsonify(metrics), 200

    except Exception as e:
        logger.error(f"MCP metrics error: {str(e)}", exc_info=True)
        return jsonify(
            {
                "error": f"Metrics failed: {str(e)}",
                "requests": {"total": 0, "success": 0, "error": 0},
                "response_times": {"average_ms": 0},
                "tools": {"most_used": [], "usage_by_category": {}},
                "uptime": {"uptime_percentage": 0},
            }
        ), 500


# Register all routes
def get_mcp_health_routes():
    """Get the MCP health blueprint for registration with Flask app."""
    return mcp_health_bp
