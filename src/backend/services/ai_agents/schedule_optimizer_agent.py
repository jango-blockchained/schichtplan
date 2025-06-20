"""
Schedule Optimizer Agent

This agent specializes in optimizing schedules through conversational interactions.
It can handle complex scheduling scenarios, resolve conflicts, and suggest improvements.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ..ai_integration import AIOrchestrator
from ..conversation_manager import ConversationContext
from .base_agent import AgentAction, AgentCapability, AgentPlan, BaseAgent


class ScheduleOptimizerAgent(BaseAgent):
    """Specialized agent for schedule optimization tasks."""

    def __init__(
        self, ai_orchestrator: AIOrchestrator, logger: Optional[logging.Logger] = None
    ):
        super().__init__(
            agent_id="schedule_optimizer",
            name="Schedule Optimization Specialist",
            description="Expert in analyzing, optimizing, and improving work schedules with focus on conflict resolution, workload balancing, and coverage optimization.",
            capabilities=[
                AgentCapability.SCHEDULE_OPTIMIZATION,
                AgentCapability.CONSTRAINT_SOLVING,
                AgentCapability.DATA_ANALYSIS,
                AgentCapability.MULTI_STEP_PLANNING,
            ],
            ai_orchestrator=ai_orchestrator,
            logger=logger,
        )

        # Specialized knowledge for schedule optimization
        self.optimization_strategies = {
            "conflict_resolution": self._resolve_conflicts_strategy,
            "workload_balancing": self._balance_workload_strategy,
            "coverage_optimization": self._optimize_coverage_strategy,
            "fairness_improvement": self._improve_fairness_strategy,
        }

    async def can_handle(
        self, request: str, context: ConversationContext
    ) -> Tuple[bool, float]:
        """Check if this agent can handle schedule optimization requests."""
        optimization_keywords = [
            "optimize",
            "schedule",
            "conflict",
            "balance",
            "coverage",
            "improve",
            "fairness",
            "workload",
            "shift",
            "assignment",
            "distribute",
            "minimize",
            "maximize",
            "efficient",
        ]

        request_lower = request.lower()
        keyword_matches = sum(
            1 for keyword in optimization_keywords if keyword in request_lower
        )

        # High confidence if multiple optimization keywords present
        if keyword_matches >= 3:
            confidence = 0.9
        elif keyword_matches >= 2:
            confidence = 0.7
        elif keyword_matches >= 1:
            confidence = 0.5
        else:
            confidence = 0.1

        # Boost confidence if we have relevant context
        if any(
            "schedule" in item.content.lower()
            if isinstance(item.content, str)
            else False
            for item in context.context_items[-5:]
        ):
            confidence = min(confidence + 0.2, 1.0)

        can_handle = confidence >= 0.5
        return can_handle, confidence

    async def create_plan(
        self, request: str, context: ConversationContext
    ) -> AgentPlan:
        """Create an optimization plan based on the request."""

        # Use AI to analyze the request and create a detailed plan
        analysis_prompt = f"""
Analyze this schedule optimization request and create a detailed plan:

Request: {request}

Available optimization strategies:
1. Conflict Resolution - Identify and resolve scheduling conflicts
2. Workload Balancing - Ensure fair distribution of work
3. Coverage Optimization - Optimize shift coverage and minimize gaps
4. Fairness Improvement - Improve fairness in assignments

Create a step-by-step plan with:
- Specific actions to take
- Dependencies between actions
- Expected outcomes
- Tools to use

Respond in JSON format:
{{
    "analysis": "Brief analysis of the request",
    "primary_strategy": "main optimization strategy",
    "steps": [
        {{
            "id": "step_1",
            "action_type": "analyze_current_state",
            "description": "Analyze current schedule state",
            "tools": ["analyze_schedule_conflicts"],
            "estimated_duration": 30,
            "confidence": 0.9
        }}
    ],
    "dependencies": {{
        "step_2": ["step_1"]
    }},
    "expected_outcome": "What we expect to achieve"
}}
        """

        ai_response = await self.think(analysis_prompt, context)

        try:
            plan_data = json.loads(ai_response.content)
        except json.JSONDecodeError:
            # Fallback to default plan if AI response isn't valid JSON
            plan_data = self._create_default_plan(request)

        # Convert plan data to AgentPlan
        actions = []
        for step in plan_data.get("steps", []):
            action = AgentAction(
                id=step["id"],
                agent_id=self.agent_id,
                action_type=step["action_type"],
                parameters={
                    "description": step["description"],
                    "tools": step.get("tools", []),
                    "estimated_duration": step.get("estimated_duration", 60),
                },
                reasoning=step.get("description", ""),
                confidence_score=step.get("confidence", 0.7),
            )
            actions.append(action)

        plan = AgentPlan(
            id=f"schedule_opt_{datetime.now().timestamp()}",
            agent_id=self.agent_id,
            goal=request,
            steps=actions,
            dependencies=plan_data.get("dependencies", {}),
            estimated_duration=sum(
                step.get("estimated_duration", 60)
                for step in plan_data.get("steps", [])
            ),
            confidence_score=plan_data.get("confidence", 0.7),
        )

        return plan

    async def execute_action(
        self, action: AgentAction, context: ConversationContext
    ) -> Any:
        """Execute a specific optimization action."""
        action_type = action.action_type

        if action_type == "analyze_current_state":
            return await self._analyze_current_state(action, context)
        elif action_type == "identify_conflicts":
            return await self._identify_conflicts(action, context)
        elif action_type == "resolve_conflicts":
            return await self._resolve_conflicts(action, context)
        elif action_type == "balance_workload":
            return await self._balance_workload(action, context)
        elif action_type == "optimize_coverage":
            return await self._optimize_coverage(action, context)
        elif action_type == "improve_fairness":
            return await self._improve_fairness(action, context)
        elif action_type == "validate_solution":
            return await self._validate_solution(action, context)
        elif action_type == "generate_recommendations":
            return await self._generate_recommendations(action, context)
        else:
            raise ValueError(f"Unknown action type: {action_type}")

    async def _analyze_current_state(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Analyze the current schedule state."""
        # This would typically call MCP tools to get current schedule data
        analysis_result = {
            "action": "analyze_current_state",
            "timestamp": datetime.now().isoformat(),
            "findings": {
                "total_employees": 0,
                "schedule_conflicts": 0,
                "coverage_gaps": 0,
                "workload_imbalance": 0.0,
            },
            "recommendations": [],
            "next_steps": ["identify_conflicts", "assess_coverage"],
        }

        # Add to agent knowledge
        self.update_knowledge("current_state_analysis", analysis_result)

        return analysis_result

    async def _identify_conflicts(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Identify scheduling conflicts."""
        conflicts_result = {
            "action": "identify_conflicts",
            "timestamp": datetime.now().isoformat(),
            "conflicts_found": [],
            "severity_levels": {"high": 0, "medium": 0, "low": 0},
            "resolution_strategies": [],
        }

        self.update_knowledge("conflicts_analysis", conflicts_result)
        return conflicts_result

    async def _resolve_conflicts(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Resolve identified conflicts."""
        resolution_result = {
            "action": "resolve_conflicts",
            "timestamp": datetime.now().isoformat(),
            "conflicts_resolved": 0,
            "strategies_used": [],
            "remaining_conflicts": 0,
            "success_rate": 0.0,
        }

        self.update_knowledge("conflict_resolution", resolution_result)
        return resolution_result

    async def _balance_workload(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Balance workload across employees."""
        balance_result = {
            "action": "balance_workload",
            "timestamp": datetime.now().isoformat(),
            "workload_distribution": {},
            "improvements_made": [],
            "fairness_score": 0.0,
        }

        self.update_knowledge("workload_balancing", balance_result)
        return balance_result

    async def _optimize_coverage(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Optimize shift coverage."""
        coverage_result = {
            "action": "optimize_coverage",
            "timestamp": datetime.now().isoformat(),
            "coverage_improvements": {},
            "gaps_filled": 0,
            "efficiency_gain": 0.0,
        }

        self.update_knowledge("coverage_optimization", coverage_result)
        return coverage_result

    async def _improve_fairness(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Improve fairness in schedule assignments."""
        fairness_result = {
            "action": "improve_fairness",
            "timestamp": datetime.now().isoformat(),
            "fairness_metrics": {},
            "adjustments_made": [],
            "satisfaction_score": 0.0,
        }

        self.update_knowledge("fairness_improvement", fairness_result)
        return fairness_result

    async def _validate_solution(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Validate the optimization solution."""
        validation_result = {
            "action": "validate_solution",
            "timestamp": datetime.now().isoformat(),
            "validation_passed": True,
            "compliance_check": {},
            "quality_metrics": {},
            "recommendations": [],
        }

        self.update_knowledge("solution_validation", validation_result)
        return validation_result

    async def _generate_recommendations(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Generate final recommendations."""
        recommendations_result = {
            "action": "generate_recommendations",
            "timestamp": datetime.now().isoformat(),
            "recommendations": [],
            "priority_levels": {"high": [], "medium": [], "low": []},
            "implementation_steps": [],
            "expected_benefits": {},
        }

        self.update_knowledge("final_recommendations", recommendations_result)
        return recommendations_result

    def _create_default_plan(self, request: str) -> Dict[str, Any]:
        """Create a default optimization plan when AI analysis fails."""
        return {
            "analysis": "Standard schedule optimization request",
            "primary_strategy": "comprehensive_optimization",
            "steps": [
                {
                    "id": "step_1",
                    "action_type": "analyze_current_state",
                    "description": "Analyze current schedule state and identify issues",
                    "tools": ["analyze_schedule_conflicts"],
                    "estimated_duration": 60,
                    "confidence": 0.8,
                },
                {
                    "id": "step_2",
                    "action_type": "identify_conflicts",
                    "description": "Identify scheduling conflicts and issues",
                    "tools": ["get_coverage_requirements"],
                    "estimated_duration": 45,
                    "confidence": 0.9,
                },
                {
                    "id": "step_3",
                    "action_type": "generate_recommendations",
                    "description": "Generate optimization recommendations",
                    "tools": ["optimize_schedule_ai"],
                    "estimated_duration": 90,
                    "confidence": 0.7,
                },
            ],
            "dependencies": {"step_2": ["step_1"], "step_3": ["step_1", "step_2"]},
            "expected_outcome": "Optimized schedule with resolved conflicts and improved coverage",
        }

    # Strategy methods for different optimization approaches
    async def _resolve_conflicts_strategy(
        self, context: ConversationContext
    ) -> Dict[str, Any]:
        """Strategy for resolving scheduling conflicts."""
        return {
            "strategy": "conflict_resolution",
            "steps": ["identify", "prioritize", "resolve"],
        }

    async def _balance_workload_strategy(
        self, context: ConversationContext
    ) -> Dict[str, Any]:
        """Strategy for balancing workload."""
        return {
            "strategy": "workload_balancing",
            "steps": ["analyze", "redistribute", "validate"],
        }

    async def _optimize_coverage_strategy(
        self, context: ConversationContext
    ) -> Dict[str, Any]:
        """Strategy for optimizing coverage."""
        return {
            "strategy": "coverage_optimization",
            "steps": ["assess_gaps", "fill_gaps", "optimize"],
        }

    async def _improve_fairness_strategy(
        self, context: ConversationContext
    ) -> Dict[str, Any]:
        """Strategy for improving fairness."""
        return {
            "strategy": "fairness_improvement",
            "steps": ["measure_fairness", "adjust_assignments", "verify"],
        }

    def _get_preferred_models(self) -> List[str]:
        """Get preferred AI models for optimization tasks."""
        # Prefer models good at analytical and logical reasoning
        return ["gpt-4o", "claude-3-5-sonnet-20241022", "o1-preview"]
