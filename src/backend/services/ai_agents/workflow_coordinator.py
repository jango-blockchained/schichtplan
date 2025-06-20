"""
Workflow Coordinator

Orchestrates complex workflows that require coordination between multiple agents
and sophisticated planning across different scheduling domains.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from ..ai_integration import AIOrchestrator, AIRequest
from ..conversation_manager import ConversationContext
from .agent_registry import AgentRegistry


class WorkflowType(Enum):
    """Types of workflows that can be coordinated."""

    COMPREHENSIVE_OPTIMIZATION = "comprehensive_optimization"
    MULTI_CONSTRAINT_SOLVING = "multi_constraint_solving"
    EMPLOYEE_SCHEDULE_INTEGRATION = "employee_schedule_integration"
    SCENARIO_PLANNING = "scenario_planning"
    CONTINUOUS_IMPROVEMENT = "continuous_improvement"


class WorkflowStatus(Enum):
    """Status of workflow execution."""

    PLANNING = "planning"
    EXECUTING = "executing"
    WAITING_FOR_INPUT = "waiting_for_input"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class WorkflowStep:
    """Individual step in a workflow."""

    id: str
    agent_id: str
    task_description: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)
    expected_duration: int = 60  # seconds
    parallel_execution: bool = False
    critical_path: bool = False
    retry_count: int = 0
    max_retries: int = 2


@dataclass
class WorkflowPlan:
    """Complete workflow execution plan."""

    id: str
    workflow_type: WorkflowType
    description: str
    steps: List[WorkflowStep]
    estimated_duration: int
    critical_path_steps: List[str] = field(default_factory=list)
    success_criteria: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    status: WorkflowStatus = WorkflowStatus.PLANNING


class WorkflowCoordinator:
    """Coordinates complex multi-agent workflows."""

    def __init__(
        self,
        agent_registry: AgentRegistry,
        ai_orchestrator: AIOrchestrator,
        logger: Optional[logging.Logger] = None,
    ):
        self.agent_registry = agent_registry
        self.ai_orchestrator = ai_orchestrator
        self.logger = logger or logging.getLogger(__name__)

        # Active workflows
        self.active_workflows: Dict[str, WorkflowPlan] = {}

        # Workflow templates
        self.workflow_templates = {
            WorkflowType.COMPREHENSIVE_OPTIMIZATION: self._create_comprehensive_optimization_workflow,
            WorkflowType.MULTI_CONSTRAINT_SOLVING: self._create_constraint_solving_workflow,
            WorkflowType.EMPLOYEE_SCHEDULE_INTEGRATION: self._create_employee_integration_workflow,
            WorkflowType.SCENARIO_PLANNING: self._create_scenario_planning_workflow,
            WorkflowType.CONTINUOUS_IMPROVEMENT: self._create_improvement_workflow,
        }

    async def analyze_request_complexity(
        self, request: str, context: ConversationContext
    ) -> Dict[str, Any]:
        """
        Analyze if a request requires complex workflow coordination.

        Args:
            request: User request
            context: Conversation context

        Returns:
            Analysis of request complexity and workflow recommendations
        """
        complexity_prompt = f"""
Analyze this scheduling request for complexity and determine if it requires multi-agent workflow coordination:

Request: {request}

Consider these factors:
1. Does it involve multiple scheduling domains (employees, schedules, constraints)?
2. Are there conflicting requirements that need resolution?
3. Does it require iterative optimization?
4. Are there dependencies between different optimization tasks?
5. Does it need scenario analysis or what-if planning?

Respond with JSON:
{{
    "complexity_level": "low|medium|high|very_high",
    "requires_workflow": true/false,
    "recommended_workflow_type": "workflow_type",
    "reasoning": "explanation",
    "required_capabilities": ["capability1", "capability2"],
    "estimated_steps": 3,
    "estimated_duration": 180
}}
        """

        ai_request = AIRequest(
            conversation_id=context.conversation_id,
            prompt=complexity_prompt,
            context={"request": request},
            temperature=0.3,
        )

        ai_response = await self.ai_orchestrator.process_request(ai_request)

        try:
            import json

            analysis = json.loads(ai_response.content)
        except (json.JSONDecodeError, AttributeError):
            # Fallback analysis
            analysis = {
                "complexity_level": "medium",
                "requires_workflow": True,
                "recommended_workflow_type": "comprehensive_optimization",
                "reasoning": "Default analysis due to parsing error",
                "required_capabilities": ["schedule_optimization"],
                "estimated_steps": 3,
                "estimated_duration": 180,
            }

        return analysis

    async def create_workflow(
        self,
        workflow_type: WorkflowType,
        request: str,
        context: ConversationContext,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> WorkflowPlan:
        """
        Create a workflow plan for the given request.

        Args:
            workflow_type: Type of workflow to create
            request: User request
            context: Conversation context
            parameters: Additional parameters

        Returns:
            WorkflowPlan ready for execution
        """
        if workflow_type not in self.workflow_templates:
            raise ValueError(f"Unknown workflow type: {workflow_type}")

        # Create workflow using template
        workflow_creator = self.workflow_templates[workflow_type]
        workflow_plan = await workflow_creator(request, context, parameters or {})

        # Register workflow
        self.active_workflows[workflow_plan.id] = workflow_plan

        self.logger.info(
            f"Created workflow {workflow_plan.id} of type {workflow_type.value}"
        )

        return workflow_plan

    async def execute_workflow(
        self, workflow_id: str, context: ConversationContext
    ) -> Dict[str, Any]:
        """
        Execute a workflow plan.

        Args:
            workflow_id: ID of workflow to execute
            context: Conversation context

        Returns:
            Execution results
        """
        if workflow_id not in self.active_workflows:
            raise ValueError(f"Workflow {workflow_id} not found")

        workflow = self.active_workflows[workflow_id]
        workflow.status = WorkflowStatus.EXECUTING

        start_time = datetime.now()
        step_results = {}
        completed_steps = set()

        try:
            # Execute steps according to dependencies
            while len(completed_steps) < len(workflow.steps):
                # Find ready steps
                ready_steps = [
                    step
                    for step in workflow.steps
                    if step.id not in completed_steps
                    and all(dep in completed_steps for dep in step.dependencies)
                ]

                if not ready_steps:
                    raise RuntimeError("Workflow deadlock detected")

                # Execute ready steps
                for step in ready_steps:
                    try:
                        step_result = await self._execute_workflow_step(
                            step, context, step_results
                        )
                        step_results[step.id] = step_result
                        completed_steps.add(step.id)

                    except Exception as e:
                        self.logger.error(f"Step {step.id} failed: {e}")

                        # Handle retries
                        if step.retry_count < step.max_retries:
                            step.retry_count += 1
                            self.logger.info(
                                f"Retrying step {step.id} (attempt {step.retry_count})"
                            )
                            # Remove from completed to retry
                            if step.id in completed_steps:
                                completed_steps.remove(step.id)
                        else:
                            # Critical path failure
                            if step.critical_path:
                                workflow.status = WorkflowStatus.FAILED
                                raise RuntimeError(
                                    f"Critical step {step.id} failed: {e}"
                                )
                            else:
                                # Non-critical failure, continue
                                step_results[step.id] = {
                                    "status": "failed",
                                    "error": str(e),
                                }
                                completed_steps.add(step.id)

            workflow.status = WorkflowStatus.COMPLETED
            execution_time = (datetime.now() - start_time).total_seconds()

            # Evaluate success criteria
            success_evaluation = self._evaluate_workflow_success(workflow, step_results)

            return {
                "workflow_id": workflow_id,
                "status": "completed",
                "execution_time": execution_time,
                "completed_steps": len(completed_steps),
                "total_steps": len(workflow.steps),
                "step_results": step_results,
                "success_evaluation": success_evaluation,
            }

        except Exception as e:
            workflow.status = WorkflowStatus.FAILED
            execution_time = (datetime.now() - start_time).total_seconds()

            self.logger.error(f"Workflow {workflow_id} failed: {e}")

            return {
                "workflow_id": workflow_id,
                "status": "failed",
                "execution_time": execution_time,
                "completed_steps": len(completed_steps),
                "total_steps": len(workflow.steps),
                "step_results": step_results,
                "error": str(e),
            }

    async def _execute_workflow_step(
        self,
        step: WorkflowStep,
        context: ConversationContext,
        previous_results: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute a single workflow step."""

        # Get the agent for this step
        agent = self.agent_registry.get_agent_by_id(step.agent_id)
        if not agent:
            raise RuntimeError(f"Agent {step.agent_id} not found")

        # Prepare context with previous results
        enriched_context = context
        if previous_results:
            # Add workflow context to conversation (simplified for now)
            pass

        # Execute with agent
        result = await self.agent_registry.execute_with_agent(
            agent, step.task_description, enriched_context
        )

        return result

    def _evaluate_workflow_success(
        self, workflow: WorkflowPlan, step_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate if workflow met success criteria."""

        successful_steps = sum(
            1
            for result in step_results.values()
            if isinstance(result, dict) and result.get("status") == "success"
        )

        success_rate = successful_steps / len(workflow.steps)

        # Basic success evaluation
        overall_success = success_rate >= 0.8  # 80% success rate threshold

        return {
            "overall_success": overall_success,
            "success_rate": success_rate,
            "successful_steps": successful_steps,
            "total_steps": len(workflow.steps),
            "criteria_met": overall_success,
            "recommendations": self._generate_improvement_recommendations(
                workflow, step_results
            ),
        }

    def _generate_improvement_recommendations(
        self, workflow: WorkflowPlan, step_results: Dict[str, Any]
    ) -> List[str]:
        """Generate recommendations for workflow improvement."""
        recommendations = []

        # Analyze failed steps
        failed_steps = [
            step_id
            for step_id, result in step_results.items()
            if isinstance(result, dict) and result.get("status") != "success"
        ]

        if failed_steps:
            recommendations.append(
                f"Review and improve {len(failed_steps)} failed steps"
            )

        # Analyze execution time
        total_duration = sum(
            result.get("execution_time", 0)
            for result in step_results.values()
            if isinstance(result, dict)
        )

        if total_duration > workflow.estimated_duration * 1.5:
            recommendations.append("Consider optimizing step execution times")

        return recommendations

    # Workflow template creators
    async def _create_comprehensive_optimization_workflow(
        self, request: str, context: ConversationContext, parameters: Dict[str, Any]
    ) -> WorkflowPlan:
        """Create comprehensive optimization workflow."""

        workflow_id = f"comp_opt_{datetime.now().timestamp()}"

        steps = [
            WorkflowStep(
                id="analyze_current_state",
                agent_id="schedule_optimizer",
                task_description="Analyze current schedule state and identify optimization opportunities",
                critical_path=True,
            ),
            WorkflowStep(
                id="analyze_employees",
                agent_id="employee_manager",
                task_description="Analyze employee data and requirements",
                dependencies=["analyze_current_state"],
            ),
            WorkflowStep(
                id="optimize_schedule",
                agent_id="schedule_optimizer",
                task_description="Optimize schedule based on analysis findings",
                dependencies=["analyze_current_state", "analyze_employees"],
                critical_path=True,
            ),
            WorkflowStep(
                id="validate_solution",
                agent_id="schedule_optimizer",
                task_description="Validate the optimized solution",
                dependencies=["optimize_schedule"],
                critical_path=True,
            ),
        ]

        return WorkflowPlan(
            id=workflow_id,
            workflow_type=WorkflowType.COMPREHENSIVE_OPTIMIZATION,
            description=f"Comprehensive optimization workflow for: {request[:100]}",
            steps=steps,
            estimated_duration=300,  # 5 minutes
            critical_path_steps=[
                "analyze_current_state",
                "optimize_schedule",
                "validate_solution",
            ],
        )

    async def _create_constraint_solving_workflow(
        self, request: str, context: ConversationContext, parameters: Dict[str, Any]
    ) -> WorkflowPlan:
        """Create constraint solving workflow."""

        workflow_id = f"constraint_{datetime.now().timestamp()}"

        steps = [
            WorkflowStep(
                id="identify_constraints",
                agent_id="schedule_optimizer",
                task_description="Identify all scheduling constraints and conflicts",
            ),
            WorkflowStep(
                id="prioritize_constraints",
                agent_id="schedule_optimizer",
                task_description="Prioritize constraints by importance and impact",
                dependencies=["identify_constraints"],
            ),
            WorkflowStep(
                id="solve_constraints",
                agent_id="schedule_optimizer",
                task_description="Solve constraints in priority order",
                dependencies=["prioritize_constraints"],
                critical_path=True,
            ),
        ]

        return WorkflowPlan(
            id=workflow_id,
            workflow_type=WorkflowType.MULTI_CONSTRAINT_SOLVING,
            description=f"Constraint solving workflow for: {request[:100]}",
            steps=steps,
            estimated_duration=240,
            critical_path_steps=["solve_constraints"],
        )

    async def _create_employee_integration_workflow(
        self, request: str, context: ConversationContext, parameters: Dict[str, Any]
    ) -> WorkflowPlan:
        """Create employee integration workflow."""

        workflow_id = f"emp_int_{datetime.now().timestamp()}"

        steps = [
            WorkflowStep(
                id="analyze_employee_needs",
                agent_id="employee_manager",
                task_description="Analyze employee availability, skills, and preferences",
            ),
            WorkflowStep(
                id="optimize_assignments",
                agent_id="employee_manager",
                task_description="Optimize employee assignments",
                dependencies=["analyze_employee_needs"],
            ),
            WorkflowStep(
                id="integrate_with_schedule",
                agent_id="schedule_optimizer",
                task_description="Integrate employee assignments with schedule optimization",
                dependencies=["optimize_assignments"],
                critical_path=True,
            ),
        ]

        return WorkflowPlan(
            id=workflow_id,
            workflow_type=WorkflowType.EMPLOYEE_SCHEDULE_INTEGRATION,
            description=f"Employee integration workflow for: {request[:100]}",
            steps=steps,
            estimated_duration=180,
            critical_path_steps=["integrate_with_schedule"],
        )

    async def _create_scenario_planning_workflow(
        self, request: str, context: ConversationContext, parameters: Dict[str, Any]
    ) -> WorkflowPlan:
        """Create scenario planning workflow."""

        workflow_id = f"scenario_{datetime.now().timestamp()}"

        steps = [
            WorkflowStep(
                id="create_baseline_scenario",
                agent_id="schedule_optimizer",
                task_description="Create baseline scenario from current state",
            ),
            WorkflowStep(
                id="generate_alternative_scenarios",
                agent_id="schedule_optimizer",
                task_description="Generate alternative scheduling scenarios",
                dependencies=["create_baseline_scenario"],
            ),
            WorkflowStep(
                id="compare_scenarios",
                agent_id="schedule_optimizer",
                task_description="Compare and evaluate different scenarios",
                dependencies=["generate_alternative_scenarios"],
                critical_path=True,
            ),
        ]

        return WorkflowPlan(
            id=workflow_id,
            workflow_type=WorkflowType.SCENARIO_PLANNING,
            description=f"Scenario planning workflow for: {request[:100]}",
            steps=steps,
            estimated_duration=200,
            critical_path_steps=["compare_scenarios"],
        )

    async def _create_improvement_workflow(
        self, request: str, context: ConversationContext, parameters: Dict[str, Any]
    ) -> WorkflowPlan:
        """Create continuous improvement workflow."""

        workflow_id = f"improve_{datetime.now().timestamp()}"

        steps = [
            WorkflowStep(
                id="analyze_performance",
                agent_id="schedule_optimizer",
                task_description="Analyze current performance metrics",
            ),
            WorkflowStep(
                id="identify_improvements",
                agent_id="schedule_optimizer",
                task_description="Identify improvement opportunities",
                dependencies=["analyze_performance"],
            ),
            WorkflowStep(
                id="implement_improvements",
                agent_id="schedule_optimizer",
                task_description="Implement identified improvements",
                dependencies=["identify_improvements"],
                critical_path=True,
            ),
        ]

        return WorkflowPlan(
            id=workflow_id,
            workflow_type=WorkflowType.CONTINUOUS_IMPROVEMENT,
            description=f"Improvement workflow for: {request[:100]}",
            steps=steps,
            estimated_duration=160,
            critical_path_steps=["implement_improvements"],
        )
