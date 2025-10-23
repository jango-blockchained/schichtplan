from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Import models after db is defined to avoid circular imports
from .absence import Absence  # noqa: E402
from .ai_models import (  # noqa: E402
    AIAgentMetrics,
    AIConversation,
    AIMessage,
    AIWorkflowExecution,
    ConversationStatus,
    MCPToolUsage,
    MessageType,
    WorkflowStatus,
)
from .coverage import Coverage  # noqa: E402
from .coverage_profile import CoverageProfile  # noqa: E402
from .employee import (  # noqa: E402
    Employee,
    EmployeeAvailability,
    EmployeeGroup,
)
from .fixed_shift import ShiftTemplate, ShiftType  # noqa: E402
from .schedule import (  # noqa: E402
    Schedule,
    ScheduleStatus,
    ScheduleVersionMeta,
)
from .settings import Settings  # noqa: E402
from .user import User, UserRole  # noqa: E402

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
    "CoverageProfile",
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
