"""
FastMCP Service for Schichtplan Application

This service exposes core scheduling functionality through the Model Context Protocol,
enabling AI applications to interact with the shift planning system.
"""

import logging
from typing import Any, Dict, Optional

from fastmcp import FastMCP
from flask import Flask

from src.backend.services.ai_agents import AgentRegistry, WorkflowCoordinator
from src.backend.services.ai_integration import create_ai_orchestrator
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

        # Initialize AI agent system asynchronously later
        self.ai_orchestrator = None
        self.agent_registry = None
        self.workflow_coordinator = None

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

    async def init_ai_agent_system(self):
        """Initialize the AI agent system asynchronously."""
        if not self.ai_orchestrator:
            self.ai_orchestrator = await create_ai_orchestrator()

        if not self.agent_registry:
            self.agent_registry = AgentRegistry(self.ai_orchestrator, self.logger)

        if not self.workflow_coordinator:
            self.workflow_coordinator = WorkflowCoordinator(
                self.agent_registry, self.ai_orchestrator, self.logger
            )

    async def handle_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle an incoming MCP request, managing conversation state."""
        # Initialize conversation manager if not already done
        await self.init_conversation_manager()
        await self.init_ai_agent_system()

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

        # Extract user request
        user_request = request_data.get("user_input", request_data.get("request", ""))

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

        try:
            # Analyze request complexity to determine if workflow coordination is needed
            complexity_analysis = (
                await self.workflow_coordinator.analyze_request_complexity(
                    user_request, conversation
                )
            )

            if complexity_analysis.get("requires_workflow", False):
                # Use workflow coordination for complex requests
                workflow_result = await self._handle_complex_request_with_workflow(
                    user_request, conversation, complexity_analysis
                )
                response = {
                    "status": "success",
                    "conversation_id": conv_id,
                    "response": workflow_result.get("summary", "Workflow completed"),
                    "workflow_used": True,
                    "complexity_analysis": complexity_analysis,
                    "workflow_details": workflow_result,
                    "context_updates": {},
                }
            else:
                # Use agent registry for simpler requests
                agent_result = await self.agent_registry.process_request(
                    user_request, conversation
                )
                response = {
                    "status": "success",
                    "conversation_id": conv_id,
                    "response": self._format_agent_response(agent_result),
                    "workflow_used": False,
                    "agent_used": agent_result.get("agent_name", "Unknown"),
                    "agent_details": agent_result,
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

    async def _handle_complex_request_with_workflow(
        self, user_request: str, conversation, complexity_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle complex requests using workflow coordination."""
        try:
            # Determine workflow type from analysis
            workflow_type_str = complexity_analysis.get(
                "recommended_workflow_type", "comprehensive_optimization"
            )

            # Map string to WorkflowType enum
            from src.backend.services.ai_agents.workflow_coordinator import WorkflowType

            workflow_type_map = {
                "comprehensive_optimization": WorkflowType.COMPREHENSIVE_OPTIMIZATION,
                "multi_constraint_solving": WorkflowType.MULTI_CONSTRAINT_SOLVING,
                "employee_schedule_integration": WorkflowType.EMPLOYEE_SCHEDULE_INTEGRATION,
                "scenario_planning": WorkflowType.SCENARIO_PLANNING,
                "continuous_improvement": WorkflowType.CONTINUOUS_IMPROVEMENT,
            }

            workflow_type = workflow_type_map.get(
                workflow_type_str, WorkflowType.COMPREHENSIVE_OPTIMIZATION
            )

            # Create workflow
            workflow_plan = await self.workflow_coordinator.create_workflow(
                workflow_type, user_request, conversation
            )

            # Execute workflow
            execution_result = await self.workflow_coordinator.execute_workflow(
                workflow_plan.id, conversation
            )

            # Generate summary
            summary = self._generate_workflow_summary(workflow_plan, execution_result)

            return {
                "workflow_id": workflow_plan.id,
                "workflow_type": workflow_type.value,
                "execution_result": execution_result,
                "summary": summary,
            }

        except (RuntimeError, ValueError, AttributeError) as e:
            self.logger.error(f"Workflow execution failed: {e}")
            return {
                "error": f"Workflow execution failed: {str(e)}",
                "fallback_to_agent": True,
            }

    def _generate_workflow_summary(
        self, workflow_plan, execution_result: Dict[str, Any]
    ) -> str:
        """Generate a human-readable summary of workflow execution."""
        status = execution_result.get("status", "unknown")
        completed_steps = execution_result.get("completed_steps", 0)
        total_steps = execution_result.get("total_steps", 0)
        execution_time = execution_result.get("execution_time", 0)

        if status == "completed":
            summary = f"✅ Successfully completed {workflow_plan.workflow_type.value} workflow!\n"
            summary += f"📊 Executed {completed_steps}/{total_steps} steps in {execution_time:.1f}s\n"

            # Add success evaluation if available
            success_eval = execution_result.get("success_evaluation", {})
            if success_eval.get("overall_success"):
                summary += f"🎯 Achieved {success_eval.get('success_rate', 0):.1%} success rate\n"

            # Add recommendations if available
            recommendations = success_eval.get("recommendations", [])
            if recommendations:
                summary += f"💡 Recommendations: {', '.join(recommendations[:2])}"

        elif status == "failed":
            summary = f"❌ Workflow {workflow_plan.workflow_type.value} failed\n"
            summary += (
                f"📊 Completed {completed_steps}/{total_steps} steps before failure\n"
            )
            error = execution_result.get("error", "Unknown error")
            summary += f"🔍 Error: {error}"

        else:
            summary = (
                f"⚠️ Workflow {workflow_plan.workflow_type.value} status: {status}\n"
            )
            summary += f"📊 Progress: {completed_steps}/{total_steps} steps"

        return summary

    def _format_agent_response(self, agent_result: Dict[str, Any]) -> str:
        """Format agent execution result into human-readable response."""
        status = agent_result.get("status", "unknown")
        agent_name = agent_result.get("agent_name", "Unknown Agent")

        if status == "success":
            response = f"✅ {agent_name} successfully processed your request!\n"

            # Add execution details if available
            execution_time = agent_result.get("execution_time", 0)
            if execution_time > 0:
                response += f"⏱️ Completed in {execution_time:.1f}s\n"

            # Add specific results if available
            result = agent_result.get("result", {})
            if isinstance(result, dict):
                plan_id = result.get("plan_id")
                if plan_id:
                    response += f"📋 Executed plan: {plan_id}\n"

                completed_actions = result.get("completed_actions", 0)
                total_actions = result.get("total_actions", 0)
                if total_actions > 0:
                    response += (
                        f"🎯 Completed {completed_actions}/{total_actions} actions"
                    )

        elif status == "error":
            response = f"❌ {agent_name} encountered an error\n"
            error = agent_result.get("error", "Unknown error")
            response += f"🔍 Details: {error}"

        else:
            response = f"ℹ️ {agent_name} status: {status}"

        # Add routing information
        routing_confidence = agent_result.get("routing_confidence", 0)
        if routing_confidence > 0:
            response += f"\n🤖 Selected with {routing_confidence:.1%} confidence"

        return response

    def get_ai_agent_status(self) -> Dict[str, Any]:
        """Get status of the AI agent system."""
        status = {
            "ai_orchestrator_initialized": self.ai_orchestrator is not None,
            "agent_registry_initialized": self.agent_registry is not None,
            "workflow_coordinator_initialized": self.workflow_coordinator is not None,
        }

        if self.agent_registry:
            status["agent_registry_status"] = self.agent_registry.get_registry_status()

        if self.workflow_coordinator:
            status["active_workflows"] = len(self.workflow_coordinator.active_workflows)

        return status

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
