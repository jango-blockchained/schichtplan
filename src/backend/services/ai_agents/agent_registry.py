"""
Agent Registry

Central registry for managing AI agents, routing requests to appropriate agents,
and coordinating multi-agent workflows.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ..ai_integration import AIOrchestrator
from ..conversation_manager import ConversationContext
from .base_agent import AgentCapability, BaseAgent
from .employee_manager_agent import EmployeeManagerAgent
from .schedule_optimizer_agent import ScheduleOptimizerAgent


@dataclass
class AgentRegistration:
    """Registration information for an agent."""

    agent: BaseAgent
    priority: int = 50  # Lower number = higher priority
    enabled: bool = True
    last_used: Optional[datetime] = None
    success_rate: float = 0.0
    total_requests: int = 0
    successful_requests: int = 0


@dataclass
class RequestRoutingResult:
    """Result of routing a request to agents."""

    selected_agent: Optional[BaseAgent]
    confidence_score: float
    alternative_agents: List[Tuple[BaseAgent, float]] = field(default_factory=list)
    routing_reasoning: str = ""


class AgentRegistry:
    """Registry for managing and coordinating AI agents."""

    def __init__(
        self, ai_orchestrator: AIOrchestrator, logger: Optional[logging.Logger] = None
    ):
        self.ai_orchestrator = ai_orchestrator
        self.logger = logger or logging.getLogger(__name__)

        # Registry of available agents
        self.agents: Dict[str, AgentRegistration] = {}

        # Capability-based index for fast lookups
        self.capability_index: Dict[AgentCapability, List[str]] = {}

        # Request routing history for learning
        self.routing_history: List[Dict[str, Any]] = []

        # Auto-register default agents
        self._register_default_agents()

    def _register_default_agents(self):
        """Register the default set of agents."""
        # Schedule Optimizer Agent
        schedule_optimizer = ScheduleOptimizerAgent(self.ai_orchestrator, self.logger)
        self.register_agent(schedule_optimizer, priority=10)

        # Employee Manager Agent
        employee_manager = EmployeeManagerAgent(self.ai_orchestrator, self.logger)
        self.register_agent(employee_manager, priority=20)

        self.logger.info("Registered default agents")

    def register_agent(
        self, agent: BaseAgent, priority: int = 50, enabled: bool = True
    ) -> bool:
        """
        Register a new agent in the registry.

        Args:
            agent: The agent to register
            priority: Priority level (lower = higher priority)
            enabled: Whether the agent is enabled

        Returns:
            True if registration successful
        """
        try:
            registration = AgentRegistration(
                agent=agent, priority=priority, enabled=enabled
            )

            self.agents[agent.agent_id] = registration

            # Update capability index
            for capability in agent.capabilities:
                if capability not in self.capability_index:
                    self.capability_index[capability] = []
                self.capability_index[capability].append(agent.agent_id)

            self.logger.info(
                f"Registered agent {agent.agent_id} with priority {priority}"
            )
            return True

        except Exception as e:
            self.logger.error(f"Failed to register agent {agent.agent_id}: {e}")
            return False

    def unregister_agent(self, agent_id: str) -> bool:
        """
        Unregister an agent from the registry.

        Args:
            agent_id: ID of the agent to unregister

        Returns:
            True if unregistration successful
        """
        if agent_id not in self.agents:
            return False

        try:
            registration = self.agents[agent_id]
            agent = registration.agent

            # Remove from capability index
            for capability in agent.capabilities:
                if capability in self.capability_index:
                    self.capability_index[capability] = [
                        aid
                        for aid in self.capability_index[capability]
                        if aid != agent_id
                    ]

            # Remove from registry
            del self.agents[agent_id]

            self.logger.info(f"Unregistered agent {agent_id}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to unregister agent {agent_id}: {e}")
            return False

    def enable_agent(self, agent_id: str) -> bool:
        """Enable an agent."""
        if agent_id in self.agents:
            self.agents[agent_id].enabled = True
            self.logger.info(f"Enabled agent {agent_id}")
            return True
        return False

    def disable_agent(self, agent_id: str) -> bool:
        """Disable an agent."""
        if agent_id in self.agents:
            self.agents[agent_id].enabled = False
            self.logger.info(f"Disabled agent {agent_id}")
            return True
        return False

    async def route_request(
        self, request: str, context: ConversationContext
    ) -> RequestRoutingResult:
        """
        Route a request to the most appropriate agent.

        Args:
            request: The user request
            context: Current conversation context

        Returns:
            RequestRoutingResult with selected agent and alternatives
        """
        if not self.agents:
            return RequestRoutingResult(
                selected_agent=None,
                confidence_score=0.0,
                routing_reasoning="No agents available",
            )

        # Get enabled agents
        enabled_agents = [
            (agent_id, reg) for agent_id, reg in self.agents.items() if reg.enabled
        ]

        if not enabled_agents:
            return RequestRoutingResult(
                selected_agent=None,
                confidence_score=0.0,
                routing_reasoning="No enabled agents available",
            )

        # Evaluate each agent's capability to handle the request
        agent_scores = []

        for agent_id, registration in enabled_agents:
            try:
                can_handle, confidence = await registration.agent.can_handle(
                    request, context
                )

                if can_handle:
                    # Adjust confidence based on agent performance
                    adjusted_confidence = confidence * (
                        0.5 + 0.5 * registration.success_rate
                    )

                    # Apply priority boost (higher priority agents get slight boost)
                    priority_factor = 1.0 + (100 - registration.priority) / 1000
                    final_confidence = adjusted_confidence * priority_factor

                    agent_scores.append((registration.agent, final_confidence))

            except Exception as e:
                self.logger.error(f"Error evaluating agent {agent_id}: {e}")

        if not agent_scores:
            return RequestRoutingResult(
                selected_agent=None,
                confidence_score=0.0,
                routing_reasoning="No agents can handle this request",
            )

        # Sort by confidence score (highest first)
        agent_scores.sort(key=lambda x: x[1], reverse=True)

        selected_agent, best_confidence = agent_scores[0]
        alternatives = agent_scores[1:5]  # Top 4 alternatives

        # Update usage statistics
        if selected_agent.agent_id in self.agents:
            self.agents[selected_agent.agent_id].last_used = datetime.now()
            self.agents[selected_agent.agent_id].total_requests += 1

        # Record routing decision
        self.routing_history.append(
            {
                "timestamp": datetime.now().isoformat(),
                "request": request[:100],  # First 100 chars
                "selected_agent": selected_agent.agent_id,
                "confidence": best_confidence,
                "alternatives": [
                    (agent.agent_id, conf) for agent, conf in alternatives
                ],
            }
        )

        # Keep routing history manageable
        if len(self.routing_history) > 1000:
            self.routing_history = self.routing_history[-500:]

        reasoning = (
            f"Selected {selected_agent.name} with confidence {best_confidence:.2f}"
        )
        if alternatives:
            alt_names = [agent.name for agent, _ in alternatives[:2]]
            reasoning += f". Alternatives: {', '.join(alt_names)}"

        return RequestRoutingResult(
            selected_agent=selected_agent,
            confidence_score=best_confidence,
            alternative_agents=alternatives,
            routing_reasoning=reasoning,
        )

    async def execute_with_agent(
        self, agent: BaseAgent, request: str, context: ConversationContext
    ) -> Dict[str, Any]:
        """
        Execute a request with a specific agent.

        Args:
            agent: The agent to use
            request: The user request
            context: Current conversation context

        Returns:
            Execution result
        """
        start_time = datetime.now()

        try:
            # Create plan
            plan = await agent.create_plan(request, context)

            # Execute plan
            result = await agent.execute_plan(plan, context)

            # Update success statistics
            if agent.agent_id in self.agents:
                registration = self.agents[agent.agent_id]
                registration.successful_requests += 1
                registration.success_rate = (
                    registration.successful_requests / registration.total_requests
                )

            execution_time = (datetime.now() - start_time).total_seconds()

            return {
                "status": "success",
                "agent_id": agent.agent_id,
                "agent_name": agent.name,
                "execution_time": execution_time,
                "plan_id": plan.id,
                "result": result,
            }

        except Exception as e:
            self.logger.error(f"Agent {agent.agent_id} execution failed: {e}")

            execution_time = (datetime.now() - start_time).total_seconds()

            return {
                "status": "error",
                "agent_id": agent.agent_id,
                "agent_name": agent.name,
                "execution_time": execution_time,
                "error": str(e),
            }

    async def process_request(
        self, request: str, context: ConversationContext
    ) -> Dict[str, Any]:
        """
        Process a request by routing to appropriate agent and executing.

        Args:
            request: The user request
            context: Current conversation context

        Returns:
            Processing result with agent execution details
        """
        # Route request to appropriate agent
        routing_result = await self.route_request(request, context)

        if not routing_result.selected_agent:
            return {
                "status": "error",
                "error": "No suitable agent found",
                "routing_reasoning": routing_result.routing_reasoning,
            }

        # Execute with selected agent
        execution_result = await self.execute_with_agent(
            routing_result.selected_agent, request, context
        )

        # Combine routing and execution results
        return {
            **execution_result,
            "routing_confidence": routing_result.confidence_score,
            "routing_reasoning": routing_result.routing_reasoning,
            "alternatives": [
                {"agent_id": agent.agent_id, "confidence": conf}
                for agent, conf in routing_result.alternative_agents
            ],
        }

    def get_agent_by_id(self, agent_id: str) -> Optional[BaseAgent]:
        """Get an agent by ID."""
        if agent_id in self.agents:
            return self.agents[agent_id].agent
        return None

    def get_agents_by_capability(self, capability: AgentCapability) -> List[BaseAgent]:
        """Get all agents with a specific capability."""
        if capability not in self.capability_index:
            return []

        agents = []
        for agent_id in self.capability_index[capability]:
            if agent_id in self.agents and self.agents[agent_id].enabled:
                agents.append(self.agents[agent_id].agent)

        return agents

    def get_registry_status(self) -> Dict[str, Any]:
        """Get current status of the agent registry."""
        enabled_count = sum(1 for reg in self.agents.values() if reg.enabled)
        total_requests = sum(reg.total_requests for reg in self.agents.values())
        successful_requests = sum(
            reg.successful_requests for reg in self.agents.values()
        )

        agent_summaries = []
        for agent_id, registration in self.agents.items():
            agent_summaries.append(
                {
                    "agent_id": agent_id,
                    "name": registration.agent.name,
                    "enabled": registration.enabled,
                    "priority": registration.priority,
                    "capabilities": [
                        cap.value for cap in registration.agent.capabilities
                    ],
                    "success_rate": registration.success_rate,
                    "total_requests": registration.total_requests,
                    "last_used": registration.last_used.isoformat()
                    if registration.last_used
                    else None,
                }
            )

        return {
            "total_agents": len(self.agents),
            "enabled_agents": enabled_count,
            "total_requests": total_requests,
            "successful_requests": successful_requests,
            "overall_success_rate": successful_requests / max(total_requests, 1),
            "routing_history_size": len(self.routing_history),
            "agents": agent_summaries,
        }
