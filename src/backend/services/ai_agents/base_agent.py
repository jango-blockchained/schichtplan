"""
Base Agent Architecture for Conversational AI

This module defines the base agent class and common functionality for specialized
AI agents in the scheduling system.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from ..ai_integration import AIOrchestrator, AIRequest, AIResponse
from ..conversation_manager import ConversationContext


class AgentCapability(Enum):
    """Capabilities that agents can have."""

    SCHEDULE_OPTIMIZATION = "schedule_optimization"
    EMPLOYEE_MANAGEMENT = "employee_management"
    CONSTRAINT_SOLVING = "constraint_solving"
    DATA_ANALYSIS = "data_analysis"
    WORKFLOW_COORDINATION = "workflow_coordination"
    MULTI_STEP_PLANNING = "multi_step_planning"
    LEARNING_ADAPTATION = "learning_adaptation"


class AgentStatus(Enum):
    """Agent execution status."""

    IDLE = "idle"
    THINKING = "thinking"
    EXECUTING = "executing"
    WAITING_FOR_INPUT = "waiting_for_input"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class AgentAction:
    """Represents an action taken by an agent."""

    id: str
    agent_id: str
    action_type: str
    parameters: Dict[str, Any]
    reasoning: str
    confidence_score: float
    timestamp: datetime = field(default_factory=datetime.now)
    status: AgentStatus = AgentStatus.IDLE
    result: Optional[Any] = None
    error: Optional[str] = None


@dataclass
class AgentPlan:
    """Multi-step plan created by an agent."""

    id: str
    agent_id: str
    goal: str
    steps: List[AgentAction]
    dependencies: Dict[str, List[str]] = field(default_factory=dict)
    estimated_duration: Optional[int] = None
    confidence_score: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    status: AgentStatus = AgentStatus.IDLE


class BaseAgent(ABC):
    """Base class for all specialized AI agents."""

    def __init__(
        self,
        agent_id: str,
        name: str,
        description: str,
        capabilities: List[AgentCapability],
        ai_orchestrator: AIOrchestrator,
        logger: Optional[logging.Logger] = None,
    ):
        self.agent_id = agent_id
        self.name = name
        self.description = description
        self.capabilities = capabilities
        self.ai_orchestrator = ai_orchestrator
        self.logger = logger or logging.getLogger(f"{__name__}.{agent_id}")

        # Agent state
        self.status = AgentStatus.IDLE
        self.current_plan: Optional[AgentPlan] = None
        self.action_history: List[AgentAction] = []
        self.knowledge_base: Dict[str, Any] = {}

        # Performance metrics
        self.success_rate = 0.0
        self.average_execution_time = 0.0
        self.total_actions = 0

    @abstractmethod
    async def can_handle(
        self, request: str, context: ConversationContext
    ) -> Tuple[bool, float]:
        """
        Check if this agent can handle the given request.

        Args:
            request: The user request or task description
            context: Current conversation context

        Returns:
            Tuple of (can_handle: bool, confidence_score: float)
        """
        pass

    @abstractmethod
    async def create_plan(
        self, request: str, context: ConversationContext
    ) -> AgentPlan:
        """
        Create a plan to handle the given request.

        Args:
            request: The user request or task description
            context: Current conversation context

        Returns:
            AgentPlan with steps to accomplish the task
        """
        pass

    @abstractmethod
    async def execute_action(
        self, action: AgentAction, context: ConversationContext
    ) -> Any:
        """
        Execute a single action from a plan.

        Args:
            action: The action to execute
            context: Current conversation context

        Returns:
            Result of the action execution
        """
        pass

    async def execute_plan(
        self, plan: AgentPlan, context: ConversationContext
    ) -> Dict[str, Any]:
        """
        Execute a complete plan with dependency management.

        Args:
            plan: The plan to execute
            context: Current conversation context

        Returns:
            Overall execution result with step-by-step outputs
        """
        self.current_plan = plan
        self.status = AgentStatus.EXECUTING

        results = {}
        pending_actions = {step.id: step for step in plan.steps}
        completed_actions = set()

        try:
            while pending_actions:
                # Find actions that can be executed (dependencies satisfied)
                ready_actions = []
                for action_id, action in pending_actions.items():
                    dependencies = plan.dependencies.get(action_id, [])
                    if all(dep in completed_actions for dep in dependencies):
                        ready_actions.append((action_id, action))

                if not ready_actions:
                    raise RuntimeError("Circular dependency detected in plan")

                # Execute ready actions in parallel
                tasks = []
                for action_id, action in ready_actions:
                    tasks.append(self._execute_single_action(action, context))

                action_results = await asyncio.gather(*tasks, return_exceptions=True)

                # Process results
                for i, (action_id, action) in enumerate(ready_actions):
                    result = action_results[i]

                    if isinstance(result, Exception):
                        action.status = AgentStatus.ERROR
                        action.error = str(result)
                        self.logger.error(f"Action {action_id} failed: {result}")
                    else:
                        action.status = AgentStatus.COMPLETED
                        action.result = result
                        results[action_id] = result
                        completed_actions.add(action_id)

                    # Remove from pending
                    pending_actions.pop(action_id)
                    self.action_history.append(action)

            self.status = AgentStatus.COMPLETED
            plan.status = AgentStatus.COMPLETED

            return {
                "plan_id": plan.id,
                "status": "completed",
                "results": results,
                "completed_actions": len(completed_actions),
                "total_actions": len(plan.steps),
            }

        except Exception as e:
            self.status = AgentStatus.ERROR
            plan.status = AgentStatus.ERROR
            self.logger.error(f"Plan execution failed: {e}")

            return {
                "plan_id": plan.id,
                "status": "error",
                "error": str(e),
                "results": results,
                "completed_actions": len(completed_actions),
                "total_actions": len(plan.steps),
            }

    async def _execute_single_action(
        self, action: AgentAction, context: ConversationContext
    ) -> Any:
        """Execute a single action with error handling and logging."""
        action.status = AgentStatus.EXECUTING
        start_time = datetime.now()

        try:
            self.logger.info(f"Executing action {action.id}: {action.action_type}")
            result = await self.execute_action(action, context)

            execution_time = (datetime.now() - start_time).total_seconds()
            self.logger.info(f"Action {action.id} completed in {execution_time:.2f}s")

            # Update performance metrics
            self.total_actions += 1
            self.average_execution_time = (
                self.average_execution_time * (self.total_actions - 1) + execution_time
            ) / self.total_actions

            return result

        except Exception as e:
            self.logger.error(f"Action {action.id} failed: {e}")
            raise

    async def think(self, prompt: str, context: ConversationContext) -> AIResponse:
        """
        Use AI to think about a problem or generate insights.

        Args:
            prompt: The thinking prompt
            context: Current conversation context

        Returns:
            AI response with thoughts and reasoning
        """
        self.status = AgentStatus.THINKING

        # Prepare specialized prompt for this agent
        specialized_prompt = self._prepare_thinking_prompt(prompt, context)

        ai_request = AIRequest(
            conversation_id=context.conversation_id,
            prompt=specialized_prompt,
            context=self._extract_relevant_context(context),
            model_preferences=self._get_preferred_models(),
            temperature=0.7,
        )

        response = await self.ai_orchestrator.process_request(ai_request)
        self.status = AgentStatus.IDLE

        return response

    def _prepare_thinking_prompt(
        self, prompt: str, context: ConversationContext
    ) -> str:
        """Prepare a specialized thinking prompt for this agent."""
        agent_info = f"""
You are {self.name}, a specialized AI agent for scheduling operations.

Your capabilities: {", ".join([cap.value for cap in self.capabilities])}
Your role: {self.description}

Current context:
- Conversation ID: {context.conversation_id}
- User: {context.user_id or "Unknown"}
- Goals: {[goal.description for goal in context.goals]}
- Context items: {len(context.context_items)}

Think about this request: {prompt}

Provide your thoughts, reasoning, and any recommendations. Be specific and actionable.
        """
        return agent_info.strip()

    def _extract_relevant_context(self, context: ConversationContext) -> Dict[str, Any]:
        """Extract context relevant to this agent's capabilities."""
        return {
            "conversation_id": context.conversation_id,
            "user_id": context.user_id,
            "goals": [goal.description for goal in context.goals],
            "recent_tools": context.tools_used[-5:] if context.tools_used else [],
            "agent_capabilities": [cap.value for cap in self.capabilities],
            "knowledge_base": self.knowledge_base,
        }

    def _get_preferred_models(self) -> List[str]:
        """Get preferred AI models for this agent."""
        # Base implementation - can be overridden by specific agents
        return ["gpt-4o", "claude-3-5-sonnet-20241022", "gemini-pro"]

    def update_knowledge(self, key: str, value: Any) -> None:
        """Update agent's knowledge base."""
        self.knowledge_base[key] = {
            "value": value,
            "updated_at": datetime.now(),
            "source": "learning",
        }

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get agent performance metrics."""
        successful_actions = sum(
            1
            for action in self.action_history
            if action.status == AgentStatus.COMPLETED
        )

        return {
            "agent_id": self.agent_id,
            "total_actions": self.total_actions,
            "successful_actions": successful_actions,
            "success_rate": successful_actions / max(self.total_actions, 1),
            "average_execution_time": self.average_execution_time,
            "capabilities": [cap.value for cap in self.capabilities],
            "knowledge_items": len(self.knowledge_base),
            "current_status": self.status.value,
        }
