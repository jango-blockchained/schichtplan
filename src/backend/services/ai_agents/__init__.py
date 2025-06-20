"""
AI Agents Package for Conversational Scheduling

This package contains specialized AI agents that can handle different aspects
of schedule management through sophisticated conversation flows.
"""

from .agent_registry import AgentRegistry
from .base_agent import AgentCapability, BaseAgent
from .employee_manager_agent import EmployeeManagerAgent
from .schedule_optimizer_agent import ScheduleOptimizerAgent
from .workflow_coordinator import WorkflowCoordinator

__all__ = [
    "AgentRegistry",
    "BaseAgent",
    "AgentCapability",
    "ScheduleOptimizerAgent",
    "EmployeeManagerAgent",
    "WorkflowCoordinator",
]
