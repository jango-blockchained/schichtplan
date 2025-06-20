from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models after db is defined to avoid circular imports
from .absence import Absence
from .ai_models import (
    AIAgentMetrics,
    AIConversation,
    AIMessage,
    AIWorkflowExecution,
    ConversationStatus,
    MCPToolUsage,
    MessageType,
    WorkflowStatus,
)
from .coverage import Coverage
from .employee import Employee, EmployeeAvailability, EmployeeGroup
from .fixed_shift import ShiftTemplate, ShiftType
from .schedule import Schedule, ScheduleStatus, ScheduleVersionMeta
from .settings import Settings
from .user import User, UserRole

__all__ = [
    "db",
    "Settings",
    "ShiftTemplate",
    "ShiftType",
    "Employee",
    "Schedule",
    "ScheduleVersionMeta",
    "ScheduleStatus",
    "EmployeeAvailability",
    "EmployeeGroup",
    "Absence",
    "Coverage",
    "User",
    "UserRole",
    "AIConversation",
    "AIMessage",
    "AIAgentMetrics",
    "AIWorkflowExecution",
    "MCPToolUsage",
    "ConversationStatus",
    "MessageType",
    "WorkflowStatus",
]
