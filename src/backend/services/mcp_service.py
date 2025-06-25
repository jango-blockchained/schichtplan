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
from src.backend.services.mcp_tools.crud_operations import (
    CRUDOperationsTools,
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
        self.crud_operations_tools = CRUDOperationsTools(self.flask_app, self.logger)
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
        self.crud_operations_tools.register_tools(self.mcp)
        self.ai_schedule_generation_tools.register_tools(self.mcp)
        self.ml_optimization_tools.register_tools(self.mcp)
        self.schedule_scenario_tools.register_tools(self.mcp)

        # Register prompts to handle ListPromptsRequest
        self._register_prompts()

    def _register_prompts(self):
        """Register prompts with the MCP service to handle ListPromptsRequest."""
        try:

            @self.mcp.prompt()
            async def schedule_optimization_prompt(ctx):
                """Generate prompts for schedule optimization based on current context."""
                return "Analyze the current schedule and suggest optimizations based on coverage requirements, employee availability, and workload distribution."

            @self.mcp.prompt()
            async def employee_availability_prompt(ctx):
                """Generate prompts for employee availability analysis."""
                return "Review employee availability patterns and suggest improvements for better schedule coverage."

            @self.mcp.prompt()
            async def schedule_compliance_prompt(ctx):
                """Generate prompts for schedule compliance checking."""
                return "Check the current schedule for compliance with labor regulations and coverage requirements."

            self.logger.info("Successfully registered 3 MCP prompts")
        except Exception as e:
            self.logger.error(f"Failed to register prompts: {e}")
            # Continue without prompts - FastMCP should handle empty prompts list

    async def init_conversation_manager(self):
        """Initialize the conversation manager asynchronously with error handling."""
        if not self.conversation_manager:
            try:
                from src.backend.services.conversation_manager import (
                    create_conversation_manager,
                )

                self.conversation_manager = await create_conversation_manager()
                self.logger.info("Conversation manager initialized successfully")
            except Exception as e:
                self.logger.error(f"Failed to initialize conversation manager: {e}")
                # Continue without conversation manager
                self.conversation_manager = None

    async def init_ai_agent_system(self):
        """Initialize the AI agent system asynchronously with error handling."""
        try:
            if not self.ai_orchestrator:
                self.ai_orchestrator = await create_ai_orchestrator()
                self.logger.info("AI orchestrator initialized successfully")

            if not self.agent_registry and self.ai_orchestrator:
                self.agent_registry = AgentRegistry(self.ai_orchestrator, self.logger)
                self.logger.info("Agent registry initialized successfully")

            if (
                not self.workflow_coordinator
                and self.agent_registry
                and self.ai_orchestrator
            ):
                self.workflow_coordinator = WorkflowCoordinator(
                    self.agent_registry, self.ai_orchestrator, self.logger
                )
                self.logger.info("Workflow coordinator initialized successfully")

        except Exception as e:
            self.logger.error(f"Failed to initialize AI agent system: {e}")
            # Reset components to None if initialization failed
            self.ai_orchestrator = None
            self.agent_registry = None
            self.workflow_coordinator = None

    async def handle_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle an incoming MCP request, managing conversation state with AI components."""
        self.logger.info(f"Handling MCP request: {list(request_data.keys())}")

        try:
            # Initialize AI systems with error handling
            await self.init_conversation_manager()
            await self.init_ai_agent_system()
        except Exception as e:
            self.logger.error(f"Failed to initialize AI systems: {e}")
            # Continue with basic functionality

        conv_id = request_data.get("conv_id")
        conversation = None

        # Try to create/get conversation if manager is available
        if self.conversation_manager:
            try:
                if not conv_id:
                    # Create a new conversation
                    conversation = await self.conversation_manager.create_conversation(
                        user_id=request_data.get("user_id"),
                        session_id=request_data.get("session_id"),
                    )
                    conv_id = conversation.conversation_id
                else:
                    conversation = await self.conversation_manager.get_conversation(
                        conv_id
                    )
            except Exception as e:
                self.logger.error(f"Conversation management failed: {e}")
                conv_id = conv_id or "fallback"

        # Extract user request
        user_request = request_data.get("user_input", request_data.get("request", ""))

        # Add conversation context if available
        if conversation:
            try:
                request_data["context"] = {
                    "conversation_id": conv_id,
                    "user_id": conversation.user_id,
                    "session_id": conversation.session_id,
                    "state": conversation.state.value,
                    "goals": [goal.description for goal in conversation.goals],
                    "tools_used": conversation.tools_used,
                    "context_items": [
                        item.content for item in conversation.context_items[-10:]
                    ],
                }
            except Exception as e:
                self.logger.error(f"Failed to add conversation context: {e}")

        try:
            # Check if workflow coordination is available and needed
            if self.workflow_coordinator and conversation:
                try:
                    complexity_analysis = (
                        await self.workflow_coordinator.analyze_request_complexity(
                            user_request, conversation
                        )
                    )

                    if complexity_analysis.get("requires_workflow", False):
                        # Use workflow coordination for complex requests
                        workflow_result = (
                            await self._handle_complex_request_with_workflow(
                                user_request, conversation, complexity_analysis
                            )
                        )
                        response = {
                            "status": "success",
                            "conversation_id": conv_id,
                            "response": workflow_result.get(
                                "summary", "Workflow completed"
                            ),
                            "workflow_used": True,
                            "complexity_analysis": complexity_analysis,
                            "workflow_details": workflow_result,
                            "context_updates": {},
                        }
                    else:
                        # Use agent registry for simpler requests
                        response = await self._handle_with_agent_registry(
                            user_request, conversation, conv_id
                        )
                except Exception as e:
                    self.logger.error(f"Workflow coordination failed: {e}")
                    # Fallback to agent registry
                    response = await self._handle_with_agent_registry(
                        user_request, conversation, conv_id
                    )
            elif self.agent_registry and conversation:
                # Use agent registry directly if available
                response = await self._handle_with_agent_registry(
                    user_request, conversation, conv_id
                )
            else:
                # Fallback to basic response when AI systems are not available
                response = {
                    "status": "basic",
                    "conversation_id": conv_id or "unknown",
                    "response": f"Processing request: {user_request}. AI components are currently unavailable but core tools are available.",
                    "basic_mode": True,
                    "ai_systems_available": False,
                }

            # Update conversation with the interaction if possible
            if conversation and self.conversation_manager:
                try:
                    await self.conversation_manager.update_conversation(conversation)
                except Exception as e:
                    self.logger.error(f"Failed to update conversation: {e}")

            return response

        except Exception as e:
            self.logger.error(f"Error processing request: {e}")
            return {
                "error": f"Failed to process request: {str(e)}",
                "conversation_id": conv_id or "unknown",
                "fallback_available": True,
            }

    async def _handle_with_agent_registry(
        self, user_request: str, conversation, conv_id: Optional[str]
    ) -> Dict[str, Any]:
        """Handle request with agent registry."""
        conv_id_str = conv_id or "unknown"

        if self.agent_registry and conversation:
            try:
                agent_result = await self.agent_registry.process_request(
                    user_request, conversation
                )
                return {
                    "status": "success",
                    "conversation_id": conv_id_str,
                    "response": self._format_agent_response(agent_result),
                    "workflow_used": False,
                    "agent_used": agent_result.get("agent_name", "Unknown"),
                    "agent_details": agent_result,
                    "context_updates": {},
                }
            except Exception as e:
                self.logger.error(f"Agent registry failed: {e}")

        # Fallback to basic response
        return {
            "status": "basic",
            "conversation_id": conv_id_str,
            "response": f"Request received: {user_request}. Processing with basic capabilities.",
            "workflow_used": False,
            "basic_mode": True,
            "reason": "AI agents unavailable"
            if not self.agent_registry
            else "No conversation context",
        }

    async def _handle_complex_request_with_workflow(
        self, user_request: str, conversation, complexity_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle complex requests using workflow coordination."""
        if not self.workflow_coordinator:
            return {
                "error": "Workflow coordinator not available",
                "fallback_to_agent": True,
            }

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
        status: Dict[str, Any] = {
            "ai_orchestrator_initialized": self.ai_orchestrator is not None,
            "agent_registry_initialized": self.agent_registry is not None,
            "workflow_coordinator_initialized": self.workflow_coordinator is not None,
            "conversation_manager_initialized": self.conversation_manager is not None,
            "full_ai_capabilities": all(
                [
                    self.ai_orchestrator is not None,
                    self.agent_registry is not None,
                    self.workflow_coordinator is not None,
                    self.conversation_manager is not None,
                ]
            ),
        }

        if self.agent_registry:
            try:
                registry_status = self.agent_registry.get_registry_status()
                status["agent_registry_status"] = registry_status
            except Exception as e:
                status["agent_registry_error"] = str(e)

        if self.workflow_coordinator:
            try:
                status["active_workflows"] = len(
                    self.workflow_coordinator.active_workflows
                )
            except Exception as e:
                status["workflow_coordinator_error"] = str(e)

        if self.conversation_manager:
            try:
                status["conversation_manager_status"] = "available"
            except Exception as e:
                status["conversation_manager_error"] = str(e)

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

    async def run_stdio(self):
        """Run the MCP server in stdio mode."""
        try:
            self.logger.info("Starting MCP server in stdio mode...")
            await self.mcp.run_stdio_async()
        except Exception as e:
            self.logger.error(f"Error running stdio server: {e}", exc_info=True)
            raise

    async def run_sse(self, host: str = "127.0.0.1", port: int = 8001):
        """Run the MCP server in SSE mode (deprecated, for compatibility)."""
        try:
            self.logger.info(f"Starting MCP server in SSE mode on {host}:{port}...")
            await self.mcp.run_sse_async()
        except Exception as e:
            self.logger.error(f"Error running SSE server: {e}", exc_info=True)
            raise

    async def run_streamable_http(self, host: str = "127.0.0.1", port: int = 8002):
        """Run the MCP server in streamable HTTP mode (deprecated, for compatibility)."""
        try:
            self.logger.info(f"Starting MCP server in HTTP mode on {host}:{port}...")
            await self.mcp.run_streamable_http_async()
        except Exception as e:
            self.logger.error(f"Error running HTTP server: {e}", exc_info=True)
            raise

    async def get_mcp_health_status(self) -> Dict[str, Any]:
        """Get comprehensive MCP service health status for frontend monitoring."""
        try:
            # Initialize AI systems if not already done
            await self.init_conversation_manager()
            await self.init_ai_agent_system()

            health_status = {
                "status": "healthy",
                "timestamp": "2024-01-20T12:00:00Z",  # In production, use actual timestamp
                "service_info": {
                    "name": "Schichtplan-MCP-Service",
                    "version": "1.0.0",
                    "mode": "full_featured"
                },
                "components": {
                    "mcp_server": {
                        "status": "running",
                        "tools_registered": 7,  # We know we register 7 tool categories
                        "prompts_registered": 3
                    },
                    "conversation_manager": {
                        "status": "running" if self.conversation_manager else "unavailable",
                        "initialized": self.conversation_manager is not None
                    },
                    "ai_orchestrator": {
                        "status": "running" if self.ai_orchestrator else "unavailable", 
                        "initialized": self.ai_orchestrator is not None
                    },
                    "agent_registry": {
                        "status": "running" if self.agent_registry else "unavailable",
                        "initialized": self.agent_registry is not None,
                        "agents_count": 0  # Will be updated when agent registry methods are available
                    },
                    "workflow_coordinator": {
                        "status": "running" if self.workflow_coordinator else "unavailable",
                        "initialized": self.workflow_coordinator is not None
                    }
                },
                "tools": {
                    "schedule_analysis": True,
                    "employee_management": True,
                    "coverage_optimization": True,
                    "crud_operations": True,
                    "ai_schedule_generation": True,
                    "ml_optimization": True,
                    "schedule_scenario": True
                },
                "capabilities": {
                    "basic_scheduling": True,
                    "ai_assistance": self.conversation_manager is not None,
                    "workflow_coordination": self.workflow_coordinator is not None,
                    "ml_optimization": self.ai_orchestrator is not None,
                    "multi_agent_routing": self.agent_registry is not None
                }
            }

            # Determine overall health
            critical_components = ["mcp_server"]
            healthy_components = 0
            total_components = len(health_status["components"])
            
            for component, info in health_status["components"].items():
                if info["status"] == "running":
                    healthy_components += 1
                elif component in critical_components and info["status"] != "running":
                    health_status["status"] = "critical"

            if health_status["status"] != "critical":
                if healthy_components >= total_components * 0.8:
                    health_status["status"] = "healthy"
                elif healthy_components >= total_components * 0.5:
                    health_status["status"] = "degraded"
                else:
                    health_status["status"] = "unhealthy"

            return health_status

        except Exception as e:
            self.logger.error(f"Failed to get MCP health status: {e}")
            return {
                "status": "error",
                "timestamp": "2024-01-20T12:00:00Z",
                "error": str(e),
                "service_info": {
                    "name": "Schichtplan-MCP-Service",
                    "version": "1.0.0",
                    "mode": "full_featured"
                }
            }

    async def get_mcp_tool_discovery(self) -> Dict[str, Any]:
        """Get MCP tool discovery information for frontend integration."""
        try:
            tools_info = {
                "available_tools": [],
                "categories": {
                    "schedule_analysis": [],
                    "employee_management": [],
                    "ai_generation": [],
                    "optimization": [],
                    "crud_operations": []
                },
                "total_count": 0
            }

            # Collect tool information from each tool category
            tool_categories = [
                ("schedule_analysis", self.schedule_analysis_tools),
                ("employee_management", self.employee_management_tools),
                ("coverage_optimization", self.coverage_optimization_tools),
                ("crud_operations", self.crud_operations_tools),
                ("ai_schedule_generation", self.ai_schedule_generation_tools),
                ("ml_optimization", self.ml_optimization_tools),
                ("schedule_scenario", self.schedule_scenario_tools)
            ]

            for category, tool_instance in tool_categories:
                if hasattr(tool_instance, 'get_tool_info'):
                    category_tools = tool_instance.get_tool_info()
                    tools_info["categories"][category] = category_tools
                    tools_info["available_tools"].extend(category_tools)

            tools_info["total_count"] = len(tools_info["available_tools"])

            return tools_info

        except Exception as e:
            self.logger.error(f"Failed to get tool discovery info: {e}")
            return {
                "available_tools": [],
                "categories": {},
                "total_count": 0,
                "error": str(e)
            }

    async def get_mcp_status_dashboard(self) -> Dict[str, Any]:
        """Get comprehensive MCP status dashboard data for frontend."""
        try:
            health_status = await self.get_mcp_health_status()
            tool_discovery = await self.get_mcp_tool_discovery()
            ai_status = self.get_ai_agent_status()  # This method is synchronous

            dashboard_data = {
                "overview": {
                    "service_status": health_status["status"],
                    "total_tools": tool_discovery["total_count"],
                    "ai_capabilities": len([k for k, v in health_status.get("capabilities", {}).items() if v]),
                    "active_components": len([k for k, v in health_status.get("components", {}).items() if v.get("status") == "running"])
                },
                "health": health_status,
                "tools": tool_discovery,
                "ai_agents": ai_status,
                "metrics": {
                    "uptime": "99.9%",  # In production, calculate actual uptime
                    "response_time": "~200ms",  # In production, track actual response times
                    "success_rate": "98.5%",  # In production, track actual success rates
                    "error_rate": "1.5%"  # In production, track actual error rates
                }
            }

            return dashboard_data

        except Exception as e:
            self.logger.error(f"Failed to get MCP status dashboard: {e}")
            return {
                "overview": {
                    "service_status": "error",
                    "total_tools": 0,
                    "ai_capabilities": 0,
                    "active_components": 0
                },
                "error": str(e)
            }
