"""
Employee Manager Agent

This agent specializes in employee-related scheduling tasks including availability
management, skill-based assignments, and employee satisfaction optimization.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ..ai_integration import AIOrchestrator
from ..conversation_manager import ConversationContext
from .base_agent import AgentAction, AgentCapability, AgentPlan, BaseAgent


class EmployeeManagerAgent(BaseAgent):
    """Specialized agent for employee management tasks."""

    def __init__(
        self, ai_orchestrator: AIOrchestrator, logger: Optional[logging.Logger] = None
    ):
        super().__init__(
            agent_id="employee_manager",
            name="Employee Management Specialist",
            description="Expert in managing employee schedules, availability, skills, and satisfaction with focus on fair assignments and work-life balance.",
            capabilities=[
                AgentCapability.EMPLOYEE_MANAGEMENT,
                AgentCapability.DATA_ANALYSIS,
                AgentCapability.CONSTRAINT_SOLVING,
                AgentCapability.MULTI_STEP_PLANNING,
            ],
            ai_orchestrator=ai_orchestrator,
            logger=logger,
        )

        # Specialized knowledge for employee management
        self.management_strategies = {
            "availability_optimization": self._optimize_availability_strategy,
            "skill_based_assignment": self._skill_assignment_strategy,
            "satisfaction_improvement": self._satisfaction_strategy,
            "worklife_balance": self._worklife_balance_strategy,
        }

    async def can_handle(
        self, request: str, context: ConversationContext
    ) -> Tuple[bool, float]:
        """Check if this agent can handle employee management requests."""
        employee_keywords = [
            "employee",
            "staff",
            "worker",
            "availability",
            "skills",
            "assign",
            "assignment",
            "satisfaction",
            "workload",
            "fairness",
            "balance",
            "preference",
            "time off",
            "vacation",
            "overtime",
            "competency",
            "qualification",
            "experience",
        ]

        request_lower = request.lower()
        keyword_matches = sum(
            1 for keyword in employee_keywords if keyword in request_lower
        )

        # High confidence if multiple employee keywords present
        if keyword_matches >= 3:
            confidence = 0.9
        elif keyword_matches >= 2:
            confidence = 0.7
        elif keyword_matches >= 1:
            confidence = 0.5
        else:
            confidence = 0.1

        # Boost confidence if we have relevant employee context
        if any(
            any(
                term in item.content.lower() if isinstance(item.content, str) else False
                for term in ["employee", "staff", "worker"]
            )
            for item in context.context_items[-5:]
        ):
            confidence = min(confidence + 0.2, 1.0)

        can_handle = confidence >= 0.5
        return can_handle, confidence

    async def create_plan(
        self, request: str, context: ConversationContext
    ) -> AgentPlan:
        """Create an employee management plan based on the request."""

        analysis_prompt = f"""
Analyze this employee management request and create a detailed plan:

Request: {request}

Available management strategies:
1. Availability Optimization - Manage employee availability and time preferences
2. Skill-Based Assignment - Assign tasks based on employee skills and competencies  
3. Satisfaction Improvement - Optimize for employee satisfaction and engagement
4. Work-Life Balance - Ensure fair work distribution and proper rest

Create a step-by-step plan with:
- Specific actions to take
- Dependencies between actions
- Expected outcomes
- Tools to use

Respond in JSON format:
{{
    "analysis": "Brief analysis of the request",
    "primary_strategy": "main management strategy",
    "steps": [
        {{
            "id": "step_1",
            "action_type": "analyze_employee_data",
            "description": "Analyze current employee information",
            "tools": ["get_employee_availability"],
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
            # Fallback to default plan
            plan_data = self._create_default_employee_plan(request)

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
            id=f"employee_mgmt_{datetime.now().timestamp()}",
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
        """Execute a specific employee management action."""
        action_type = action.action_type

        if action_type == "analyze_employee_data":
            return await self._analyze_employee_data(action, context)
        elif action_type == "check_availability":
            return await self._check_availability(action, context)
        elif action_type == "assess_skills":
            return await self._assess_skills(action, context)
        elif action_type == "analyze_workload":
            return await self._analyze_workload(action, context)
        elif action_type == "suggest_assignments":
            return await self._suggest_assignments(action, context)
        elif action_type == "optimize_satisfaction":
            return await self._optimize_satisfaction(action, context)
        elif action_type == "balance_worklife":
            return await self._balance_worklife(action, context)
        elif action_type == "generate_employee_recommendations":
            return await self._generate_employee_recommendations(action, context)
        else:
            raise ValueError(f"Unknown action type: {action_type}")

    async def _analyze_employee_data(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Analyze current employee data and metrics."""
        analysis_result = {
            "action": "analyze_employee_data",
            "timestamp": datetime.now().isoformat(),
            "employee_metrics": {
                "total_employees": 0,
                "average_workload": 0.0,
                "satisfaction_score": 0.0,
                "availability_rate": 0.0,
            },
            "findings": [],
            "areas_for_improvement": [],
            "next_steps": ["check_availability", "assess_skills"],
        }

        self.update_knowledge("employee_data_analysis", analysis_result)
        return analysis_result

    async def _check_availability(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Check employee availability and preferences."""
        availability_result = {
            "action": "check_availability",
            "timestamp": datetime.now().isoformat(),
            "availability_summary": {},
            "conflicts": [],
            "preferences": {},
            "recommendations": [],
        }

        self.update_knowledge("availability_analysis", availability_result)
        return availability_result

    async def _assess_skills(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Assess employee skills and competencies."""
        skills_result = {
            "action": "assess_skills",
            "timestamp": datetime.now().isoformat(),
            "skill_matrix": {},
            "competency_gaps": [],
            "training_recommendations": [],
            "assignment_capabilities": {},
        }

        self.update_knowledge("skills_assessment", skills_result)
        return skills_result

    async def _analyze_workload(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Analyze employee workload distribution."""
        workload_result = {
            "action": "analyze_workload",
            "timestamp": datetime.now().isoformat(),
            "workload_distribution": {},
            "imbalances": [],
            "stress_indicators": {},
            "recommendations": [],
        }

        self.update_knowledge("workload_analysis", workload_result)
        return workload_result

    async def _suggest_assignments(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Suggest optimal employee assignments."""
        assignment_result = {
            "action": "suggest_assignments",
            "timestamp": datetime.now().isoformat(),
            "suggested_assignments": {},
            "assignment_reasoning": {},
            "alternatives": {},
            "expected_outcomes": {},
        }

        self.update_knowledge("assignment_suggestions", assignment_result)
        return assignment_result

    async def _optimize_satisfaction(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Optimize employee satisfaction."""
        satisfaction_result = {
            "action": "optimize_satisfaction",
            "timestamp": datetime.now().isoformat(),
            "satisfaction_metrics": {},
            "improvement_strategies": [],
            "expected_impact": {},
            "monitoring_plan": {},
        }

        self.update_knowledge("satisfaction_optimization", satisfaction_result)
        return satisfaction_result

    async def _balance_worklife(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Balance work-life requirements."""
        balance_result = {
            "action": "balance_worklife",
            "timestamp": datetime.now().isoformat(),
            "balance_metrics": {},
            "adjustments_made": [],
            "wellness_indicators": {},
            "recommendations": [],
        }

        self.update_knowledge("worklife_balance", balance_result)
        return balance_result

    async def _generate_employee_recommendations(
        self, action: AgentAction, context: ConversationContext
    ) -> Dict[str, Any]:
        """Generate final employee management recommendations."""
        recommendations_result = {
            "action": "generate_employee_recommendations",
            "timestamp": datetime.now().isoformat(),
            "recommendations": [],
            "priority_actions": [],
            "implementation_timeline": {},
            "success_metrics": {},
        }

        self.update_knowledge("employee_recommendations", recommendations_result)
        return recommendations_result

    def _create_default_employee_plan(self, request: str) -> Dict[str, Any]:
        """Create a default employee management plan when AI analysis fails."""
        return {
            "analysis": "Standard employee management request",
            "primary_strategy": "comprehensive_employee_management",
            "steps": [
                {
                    "id": "step_1",
                    "action_type": "analyze_employee_data",
                    "description": "Analyze current employee data and metrics",
                    "tools": ["get_employee_availability"],
                    "estimated_duration": 45,
                    "confidence": 0.8,
                },
                {
                    "id": "step_2",
                    "action_type": "check_availability",
                    "description": "Check employee availability and preferences",
                    "tools": ["analyze_employee_workload"],
                    "estimated_duration": 30,
                    "confidence": 0.9,
                },
                {
                    "id": "step_3",
                    "action_type": "suggest_assignments",
                    "description": "Suggest optimal employee assignments",
                    "tools": ["suggest_employee_assignments"],
                    "estimated_duration": 60,
                    "confidence": 0.7,
                },
            ],
            "dependencies": {"step_2": ["step_1"], "step_3": ["step_1", "step_2"]},
            "expected_outcome": "Optimized employee assignments with improved satisfaction and balance",
        }

    # Strategy methods for different employee management approaches
    async def _optimize_availability_strategy(
        self, context: ConversationContext
    ) -> Dict[str, Any]:
        """Strategy for optimizing employee availability."""
        return {
            "strategy": "availability_optimization",
            "steps": ["collect", "analyze", "optimize"],
        }

    async def _skill_assignment_strategy(
        self, context: ConversationContext
    ) -> Dict[str, Any]:
        """Strategy for skill-based assignments."""
        return {
            "strategy": "skill_based_assignment",
            "steps": ["assess_skills", "match_requirements", "assign"],
        }

    async def _satisfaction_strategy(
        self, context: ConversationContext
    ) -> Dict[str, Any]:
        """Strategy for improving satisfaction."""
        return {
            "strategy": "satisfaction_improvement",
            "steps": ["measure", "identify_factors", "improve"],
        }

    async def _worklife_balance_strategy(
        self, context: ConversationContext
    ) -> Dict[str, Any]:
        """Strategy for work-life balance."""
        return {
            "strategy": "worklife_balance",
            "steps": ["assess_balance", "identify_issues", "adjust"],
        }

    def _get_preferred_models(self) -> List[str]:
        """Get preferred AI models for employee management tasks."""
        # Prefer models good at understanding human factors and empathy
        return ["claude-3-5-sonnet-20241022", "gpt-4o", "gemini-pro"]
