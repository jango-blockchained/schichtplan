"""
MCP Tools modules for the Schichtplan application.
"""

from src.backend.services.mcp_tools.ai_schedule_generation import (
    AIScheduleGenerationTools,
)
from src.backend.services.mcp_tools.coverage_optimization import (
    CoverageOptimizationTools,
)
from src.backend.services.mcp_tools.crud_operations import CRUDOperationsTools
from src.backend.services.mcp_tools.employee_management import EmployeeManagementTools
from src.backend.services.mcp_tools.ml_optimization import MLOptimizationTools
from src.backend.services.mcp_tools.schedule_analysis import ScheduleAnalysisTools
from src.backend.services.mcp_tools.schedule_scenario import ScheduleScenarioTools
from src.backend.services.mcp_tools.settings_management import SettingsManagementTools
from src.backend.services.mcp_tools.shift_changes import ShiftChangesTools
from src.backend.services.mcp_tools.vacation_management import VacationManagementTools

__all__ = [
    "AIScheduleGenerationTools",
    "CoverageOptimizationTools",
    "CRUDOperationsTools",
    "EmployeeManagementTools",
    "MLOptimizationTools",
    "ScheduleAnalysisTools",
    "ScheduleScenarioTools",
    "SettingsManagementTools",
    "ShiftChangesTools",
    "VacationManagementTools",
]

