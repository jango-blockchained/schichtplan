"""
FastMCP Service for Schichtplan Application

This service exposes core scheduling functionality through the Model Context Protocol,
enabling AI applications to interact with the shift planning system.
"""

import logging
from typing import Any, Dict, Optional

from fastmcp import FastMCP
from flask import Flask

from src.backend.services.mcp_tools.ai_schedule_generation import (
    AIScheduleGenerationTools,
)
from src.backend.services.mcp_tools.coverage_optimization import (
    CoverageOptimizationTools,
)
from src.backend.services.mcp_tools.employee_management import (
    EmployeeManagementTools,
)
from src.backend.services.mcp_tools.ml_optimization import MLOptimizationTools
from src.backend.services.mcp_tools.schedule_analysis import ScheduleAnalysisTools
from src.backend.services.mcp_tools.schedule_scenario import ScheduleScenarioTools


class SchichtplanMCPService:
    """FastMCP service for the Schichtplan application."""

    def __init__(
        self,
        flask_app: Optional[Flask] = None,
        logger: Optional[logging.Logger] = None,
    ):
        self.flask_app = flask_app
        self.logger = logger or logging.getLogger(__name__)
        self.mcp = FastMCP(
            "Schichtplan-Assistent",
            "Ein KI-Assistent zur Verwaltung und Optimierung von Schichtplänen.",
        )
        self.schedule_analysis_tools = ScheduleAnalysisTools(
            self.flask_app, self.logger
        )
        self.employee_management_tools = EmployeeManagementTools(
            self.flask_app, self.logger
        )
        self.coverage_optimization_tools = CoverageOptimizationTools(
            self.flask_app, self.logger
        )
        self.ai_schedule_generation_tools = AIScheduleGenerationTools(
            self.flask_app, self.logger
        )
        self.ml_optimization_tools = MLOptimizationTools(self.flask_app, self.logger)
        self.schedule_scenario_tools = ScheduleScenarioTools(
            self.flask_app, self.logger
        )
        # Initialize conversation manager asynchronously later
        self.conversation_manager = None
        self._register_tools()

    def _register_tools(self):
        """Register all tools with the MCP service."""
        self.schedule_analysis_tools.register_tools(self.mcp)
        self.employee_management_tools.register_tools(self.mcp)
        self.coverage_optimization_tools.register_tools(self.mcp)
        self.ai_schedule_generation_tools.register_tools(self.mcp)
        self.ml_optimization_tools.register_tools(self.mcp)
        self.schedule_scenario_tools.register_tools(self.mcp)

    async def init_conversation_manager(self):
        """Initialize the conversation manager asynchronously."""
        if not self.conversation_manager:
            from src.backend.services.conversation_manager import (
                create_conversation_manager,
            )

            self.conversation_manager = await create_conversation_manager()

    async def handle_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle an incoming MCP request, managing conversation state."""
        # Initialize conversation manager if not already done
        await self.init_conversation_manager()

        conv_id = request_data.get("conv_id")
        if not conv_id:
            # Create a new conversation
            conversation = await self.conversation_manager.create_conversation(
                user_id=request_data.get("user_id"),
                session_id=request_data.get("session_id"),
            )
            conv_id = conversation.conversation_id

        conversation = await self.conversation_manager.get_conversation(conv_id)
        if not conversation:
            return {"error": "Conversation not found"}

        # Add conversation context to the request
        request_data["context"] = {
            "conversation_id": conv_id,
            "user_id": conversation.user_id,
            "session_id": conversation.session_id,
            "state": conversation.state.value,
            "goals": [goal.description for goal in conversation.goals],
            "tools_used": conversation.tools_used,
            "context_items": [
                item.content for item in conversation.context_items[-10:]
            ],  # Last 10 items
        }

        # Process the request using FastMCP
        # Note: FastMCP doesn't have a direct handle method, we need to route to specific tools
        try:
            # For now, return a basic response structure
            # This would need to be expanded based on the specific request type and routing logic
            response = {
                "status": "success",
                "conversation_id": conv_id,
                "response": "Request processed successfully",
                "context_updates": {},
            }

            # Update conversation with the interaction
            if conversation:
                # This is a simplified update - in practice you'd add more context
                await self.conversation_manager.update_conversation(conversation)

            return response

        except (ValueError, KeyError, AttributeError) as e:
            self.logger.error(f"Error processing request: {e}")
            return {
                "error": f"Failed to process request: {str(e)}",
                "conversation_id": conv_id,
            }

    def get_open_api_spec(self) -> Dict[str, Any]:
        """Get the OpenAPI specification for the MCP service."""
        # FastMCP doesn't provide a get_openapi_spec method
        # Return a basic spec structure instead
        return {
            "openapi": "3.0.0",
            "info": {
                "title": "Schichtplan MCP Service",
                "description": "Ein KI-Assistent zur Verwaltung und Optimierung von Schichtplänen.",
                "version": "1.0.0",
            },
            "paths": {},
            "components": {},
        }
