"""
Enhanced Agent Registry with configuration management and performance tracking.
"""

import threading
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from src.backend.utils.logger import logger


class AgentStatus(Enum):
    """Agent status enumeration."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    BUSY = "busy"
    ERROR = "error"
    MAINTENANCE = "maintenance"


class AgentCapability(Enum):
    """Agent capability enumeration."""

    SCHEDULE_OPTIMIZATION = "schedule_optimization"
    CONFLICT_RESOLUTION = "conflict_resolution"
    WORKLOAD_ANALYSIS = "workload_analysis"
    COVERAGE_ANALYSIS = "coverage_analysis"
    EMPLOYEE_MANAGEMENT = "employee_management"
    REPORTING = "reporting"
    DATA_ANALYSIS = "data_analysis"


@dataclass
class AgentPerformanceMetric:
    """Performance metric for an agent."""

    timestamp: datetime
    execution_time: float
    success: bool
    task_type: str
    error_message: Optional[str] = None
    result_quality_score: Optional[float] = None  # 0.0 to 1.0


@dataclass
class AgentConfiguration:
    """Configuration for an AI agent."""

    agent_id: str
    name: str
    description: str
    capabilities: List[AgentCapability]
    status: AgentStatus = AgentStatus.INACTIVE
    priority: int = 1  # 1 = highest priority
    max_concurrent_tasks: int = 1
    timeout_seconds: int = 300
    retry_attempts: int = 3
    configuration_params: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


class AgentPerformanceTracker:
    """Tracks agent performance metrics and statistics."""

    def __init__(self):
        self.metrics: Dict[str, List[AgentPerformanceMetric]] = defaultdict(list)
        self.task_assignments: Dict[str, int] = defaultdict(
            int
        )  # agent_id -> current tasks
        self._lock = threading.RLock()

    def record_performance(self, agent_id: str, metric: AgentPerformanceMetric):
        """Record a performance metric for an agent."""
        with self._lock:
            self.metrics[agent_id].append(metric)

            # Keep only last 1000 metrics per agent
            if len(self.metrics[agent_id]) > 1000:
                self.metrics[agent_id] = self.metrics[agent_id][-1000:]

    def assign_task(self, agent_id: str):
        """Record task assignment to an agent."""
        with self._lock:
            self.task_assignments[agent_id] += 1

    def complete_task(self, agent_id: str):
        """Record task completion for an agent."""
        with self._lock:
            if self.task_assignments[agent_id] > 0:
                self.task_assignments[agent_id] -= 1

    def get_agent_stats(self, agent_id: str, hours: int = 24) -> Dict[str, Any]:
        """Get performance statistics for an agent."""
        with self._lock:
            cutoff = datetime.now() - timedelta(hours=hours)
            recent_metrics = [
                m for m in self.metrics[agent_id] if m.timestamp >= cutoff
            ]

            if not recent_metrics:
                return {
                    "agent_id": agent_id,
                    "total_tasks": 0,
                    "success_rate": 0.0,
                    "avg_execution_time": 0.0,
                    "current_load": self.task_assignments[agent_id],
                }

            total_tasks = len(recent_metrics)
            successful_tasks = sum(1 for m in recent_metrics if m.success)
            success_rate = successful_tasks / total_tasks if total_tasks > 0 else 0.0

            execution_times = [m.execution_time for m in recent_metrics if m.success]
            avg_execution_time = (
                sum(execution_times) / len(execution_times) if execution_times else 0.0
            )

            # Calculate quality score average
            quality_scores = [
                m.result_quality_score
                for m in recent_metrics
                if m.result_quality_score is not None and m.success
            ]
            avg_quality = (
                sum(quality_scores) / len(quality_scores) if quality_scores else None
            )

            return {
                "agent_id": agent_id,
                "total_tasks": total_tasks,
                "successful_tasks": successful_tasks,
                "success_rate": success_rate,
                "avg_execution_time": avg_execution_time,
                "avg_quality_score": avg_quality,
                "current_load": self.task_assignments[agent_id],
                "recent_errors": [
                    m.error_message
                    for m in recent_metrics
                    if not m.success and m.error_message
                ][-5:],  # Last 5 errors
            }

    def get_system_stats(self) -> Dict[str, Any]:
        """Get overall system performance statistics."""
        with self._lock:
            total_agents = len(self.metrics)
            total_active_tasks = sum(self.task_assignments.values())

            # Calculate overall statistics
            all_metrics = []
            for agent_metrics in self.metrics.values():
                all_metrics.extend(agent_metrics)

            cutoff = datetime.now() - timedelta(hours=24)
            recent_metrics = [m for m in all_metrics if m.timestamp >= cutoff]

            if not recent_metrics:
                return {
                    "total_agents": total_agents,
                    "total_active_tasks": total_active_tasks,
                    "overall_success_rate": 0.0,
                    "total_tasks_24h": 0,
                }

            total_tasks_24h = len(recent_metrics)
            successful_tasks_24h = sum(1 for m in recent_metrics if m.success)
            overall_success_rate = (
                successful_tasks_24h / total_tasks_24h if total_tasks_24h > 0 else 0.0
            )

            return {
                "total_agents": total_agents,
                "total_active_tasks": total_active_tasks,
                "overall_success_rate": overall_success_rate,
                "total_tasks_24h": total_tasks_24h,
                "successful_tasks_24h": successful_tasks_24h,
            }


class AgentLoadBalancer:
    """Load balancer for distributing tasks among agents."""

    def __init__(self, performance_tracker: AgentPerformanceTracker):
        self.performance_tracker = performance_tracker
        self._lock = threading.RLock()

    def select_best_agent(
        self,
        required_capabilities: List[AgentCapability],
        available_agents: List[AgentConfiguration],
    ) -> Optional[AgentConfiguration]:
        """Select the best agent for a task based on capabilities and performance."""
        with self._lock:
            # Filter agents by capabilities
            capable_agents = [
                agent
                for agent in available_agents
                if agent.status == AgentStatus.ACTIVE
                and all(cap in agent.capabilities for cap in required_capabilities)
            ]

            if not capable_agents:
                return None

            # Filter by current load
            available_agents_filtered = [
                agent
                for agent in capable_agents
                if self.performance_tracker.task_assignments[agent.agent_id]
                < agent.max_concurrent_tasks
            ]

            if not available_agents_filtered:
                # All agents are at capacity, return the one with least load
                return min(
                    capable_agents,
                    key=lambda a: self.performance_tracker.task_assignments[a.agent_id],
                )

            # Score agents based on performance and current load
            scored_agents = []
            for agent in available_agents_filtered:
                stats = self.performance_tracker.get_agent_stats(agent.agent_id)

                # Calculate score (higher is better)
                success_rate = stats["success_rate"]
                load_factor = 1.0 - (stats["current_load"] / agent.max_concurrent_tasks)
                priority_factor = (
                    1.0 / agent.priority
                )  # Lower priority number = higher factor

                # Execution time factor (favor faster agents)
                time_factor = 1.0
                if stats["avg_execution_time"] > 0:
                    time_factor = 1.0 / (
                        1.0 + stats["avg_execution_time"] / 60.0
                    )  # Normalize to minutes

                score = (
                    success_rate * 0.4
                    + load_factor * 0.3
                    + priority_factor * 0.2
                    + time_factor * 0.1
                )

                scored_agents.append((agent, score))

            # Return agent with highest score
            return max(scored_agents, key=lambda x: x[1])[0]


class EnhancedAgentRegistry:
    """Enhanced agent registry with configuration management and performance tracking."""

    def __init__(self):
        self.agents: Dict[str, AgentConfiguration] = {}
        self.performance_tracker = AgentPerformanceTracker()
        self.load_balancer = AgentLoadBalancer(self.performance_tracker)
        self._lock = threading.RLock()

        # Initialize with default agents
        self._initialize_default_agents()

    def _initialize_default_agents(self):
        """Initialize the registry with default agents."""
        default_agents = [
            AgentConfiguration(
                agent_id="schedule_optimizer",
                name="Schedule Optimizer Agent",
                description="Specialized in schedule optimization and conflict resolution",
                capabilities=[
                    AgentCapability.SCHEDULE_OPTIMIZATION,
                    AgentCapability.CONFLICT_RESOLUTION,
                ],
                priority=1,
                max_concurrent_tasks=2,
                tags=["optimization", "scheduling"],
            ),
            AgentConfiguration(
                agent_id="workload_analyzer",
                name="Workload Analysis Agent",
                description="Analyzes workload distribution and employee utilization",
                capabilities=[
                    AgentCapability.WORKLOAD_ANALYSIS,
                    AgentCapability.DATA_ANALYSIS,
                ],
                priority=2,
                max_concurrent_tasks=3,
                tags=["analysis", "workload"],
            ),
            AgentConfiguration(
                agent_id="coverage_optimizer",
                name="Coverage Optimization Agent",
                description="Ensures optimal coverage across all shifts and departments",
                capabilities=[
                    AgentCapability.COVERAGE_ANALYSIS,
                    AgentCapability.SCHEDULE_OPTIMIZATION,
                ],
                priority=1,
                max_concurrent_tasks=1,
                tags=["coverage", "optimization"],
            ),
            AgentConfiguration(
                agent_id="employee_manager",
                name="Employee Management Agent",
                description="Handles employee-related scheduling tasks and availability",
                capabilities=[
                    AgentCapability.EMPLOYEE_MANAGEMENT,
                    AgentCapability.DATA_ANALYSIS,
                ],
                priority=3,
                max_concurrent_tasks=2,
                tags=["employees", "management"],
            ),
        ]

        for agent in default_agents:
            self.agents[agent.agent_id] = agent

    def register_agent(self, agent_config: AgentConfiguration) -> bool:
        """Register a new agent or update existing one."""
        with self._lock:
            agent_config.updated_at = datetime.now()
            if agent_config.agent_id not in self.agents:
                agent_config.created_at = datetime.now()

            self.agents[agent_config.agent_id] = agent_config
            logger.info(f"Agent {agent_config.agent_id} registered successfully")
            return True

    def unregister_agent(self, agent_id: str) -> bool:
        """Unregister an agent."""
        with self._lock:
            if agent_id in self.agents:
                del self.agents[agent_id]
                logger.info(f"Agent {agent_id} unregistered")
                return True
            return False

    def update_agent_status(self, agent_id: str, status: AgentStatus) -> bool:
        """Update an agent's status."""
        with self._lock:
            if agent_id in self.agents:
                self.agents[agent_id].status = status
                self.agents[agent_id].updated_at = datetime.now()
                logger.info(f"Agent {agent_id} status updated to {status.value}")
                return True
            return False

    def get_agent(self, agent_id: str) -> Optional[AgentConfiguration]:
        """Get an agent configuration."""
        return self.agents.get(agent_id)

    def list_agents(
        self,
        status_filter: Optional[AgentStatus] = None,
        capability_filter: Optional[List[AgentCapability]] = None,
    ) -> List[AgentConfiguration]:
        """List agents with optional filtering."""
        agents = list(self.agents.values())

        if status_filter:
            agents = [a for a in agents if a.status == status_filter]

        if capability_filter:
            agents = [
                a
                for a in agents
                if any(cap in a.capabilities for cap in capability_filter)
            ]

        return agents

    def assign_task(
        self, required_capabilities: List[AgentCapability], task_description: str = ""
    ) -> Optional[str]:
        """Assign a task to the best available agent."""
        available_agents = self.list_agents(status_filter=AgentStatus.ACTIVE)

        best_agent = self.load_balancer.select_best_agent(
            required_capabilities, available_agents
        )

        if best_agent:
            self.performance_tracker.assign_task(best_agent.agent_id)
            logger.info(
                f"Task assigned to agent {best_agent.agent_id}: {task_description}"
            )
            return best_agent.agent_id

        logger.warning(
            f"No available agent found for capabilities: {required_capabilities}"
        )
        return None

    def complete_task(
        self,
        agent_id: str,
        success: bool,
        execution_time: float,
        task_type: str = "unknown",
        error_message: Optional[str] = None,
        quality_score: Optional[float] = None,
    ):
        """Record task completion."""
        metric = AgentPerformanceMetric(
            timestamp=datetime.now(),
            execution_time=execution_time,
            success=success,
            task_type=task_type,
            error_message=error_message,
            result_quality_score=quality_score,
        )

        self.performance_tracker.record_performance(agent_id, metric)
        self.performance_tracker.complete_task(agent_id)

        logger.info(
            f"Task completed by agent {agent_id}: success={success}, time={execution_time:.2f}s"
        )

    def get_agent_performance(self, agent_id: str) -> Dict[str, Any]:
        """Get performance statistics for an agent."""
        return self.performance_tracker.get_agent_stats(agent_id)

    def get_system_performance(self) -> Dict[str, Any]:
        """Get overall system performance statistics."""
        return self.performance_tracker.get_system_stats()

    def get_registry_status(self) -> Dict[str, Any]:
        """Get comprehensive registry status."""
        with self._lock:
            agents_by_status = defaultdict(int)
            agents_by_capability = defaultdict(int)

            for agent in self.agents.values():
                agents_by_status[agent.status.value] += 1
                for capability in agent.capabilities:
                    agents_by_capability[capability.value] += 1

            return {
                "total_agents": len(self.agents),
                "agents_by_status": dict(agents_by_status),
                "agents_by_capability": dict(agents_by_capability),
                "system_performance": self.get_system_performance(),
                "load_distribution": {
                    agent_id: self.performance_tracker.task_assignments[agent_id]
                    for agent_id in self.agents.keys()
                },
            }


# Global enhanced agent registry instance
enhanced_agent_registry = EnhancedAgentRegistry()
